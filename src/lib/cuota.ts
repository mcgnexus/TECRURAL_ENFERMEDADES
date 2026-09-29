import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Cuotas de uso, en base de datos y no en memoria.
 *
 * Por qué aquí y no en un Map del módulo: en Vercel cada instancia de
 * serverless tiene su propia memoria, así que un límite en memoria se
 * multiplica por el número de instancias (con ocho, "5 por hora" son 40) y
 * desaparece en cuanto reciclan una instancia. Una fila en Postgres es un
 * límite global, persistente y además consultable desde /admin.
 *
 * Dos propiedades que importan y que se pierden fácil en un contador ingenuo:
 *
 * 1. El incremento es ATÓMICO. Se hace con `contador = contador + 1` dentro del
 *    propio UPDATE y el RETURNING devuelve el valor ya incrementado. Si se
 *    leyera primero y se escribiera después, dos peticiones simultáneas pasarían
 *    las dos la comprobación y las dos consumirían. Aquí no hay ventana.
 *
 * 2. La ventana se renueva solo si ya venció. Nunca se resetea al alcanzar el
 *    límite: si se reiniciara al llegar al tope, quien lo alcanzara se
 *    auto-liberaría y la cuota no valdría para nada.
 *
 * El consumo se descuenta ANTES de llamar al proveedor. Si el análisis falla
 * después, el uso se cuenta igual, porque el dinero ya se ha gastado en la
 * llamada: es preferible contar de más que dejar el reintento sin coste.
 */

let sql: NeonQueryFunction<false, false> | null = null;

/** Conección perezosa: se abre en la primera consulta, no al importar. */
function getSql(): NeonQueryFunction<false, false> {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL no configurada");
    sql = neon(url);
  }
  return sql;
}

export type Ambito = "diag" | "lead";

export interface Limites {
  /** Usos por visitante en la ventana. */
  porVisitante: number;
  /** Tope total de la ventana para toda la app. */
  global: number;
  /** Duración de la ventana. */
  ventanaMs: number;
}

export const LIMITES: Record<Ambito, Limites> = {
  // Un agricultor de campo hace unos pocos análisis al día, y el que lleva
  // varios días con la misma planta ya lo tiene en el historial. Diez por hora
  // deja margen de sobra a un usuario legítimo y corta en seco a un script. El
  // tope global es la red de seguridad que el proveedor no te da.
  diag: { porVisitante: 10, global: 500, ventanaMs: 24 * 60 * 60 * 1000 },
  lead: { porVisitante: 5, global: 200, ventanaMs: 24 * 60 * 60 * 1000 },
};

export interface DecisionCuota {
  permitido: boolean;
  /** Motivo legible, ya en español para el agricultor. */
  motivo?: "visitante" | "global" | "sin_identificar";
  /** Texto que se muestra cuando se rechaza. */
  mensaje?: string;
  /** Aviso técnico para el log. */
  detalle?: string;
  restantes: number;
}

function dia(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function claveVisitante(ambito: Ambito, sufijo: string, ventana: Date): string {
  return `${ambito}:${sufijo}:${dia(ventana)}`;
}

function claveGlobal(ambito: Ambito, ventana: Date): string {
  return `${ambito}:global:${dia(ventana)}`;
}

function mensaje(ambito: Ambito, motivo: "visitante" | "global"): string {
  if (motivo === "global") {
    return "El servicio está muy saturado en este momento. Inténtalo de nuevo en unos minutos.";
  }
  return ambito === "diag"
    ? "Has alcanzado el límite de análisis de este dispositivo. Espera un rato y vuelve a intentarlo: tu historial se conserva."
    : "Has enviado demasiadas solicitudes desde este dispositivo. Espera un rato antes de volver a enviar una.";
}

/**
 * Intenta consumir un uso. Devuelve la decisión sin lanzar: un fallo de base de
 * datos NUNCA debe dejar al agricultor sin servicio. En ese caso se permite el
 * análisis y se avisa por log, porque una cuota que bloquea a usuarios
 * legítimos cuando la base de datos tiene un problema es peor que una cuota que
 * se pierde durante la incidencia.
 */
/**
 * Intenta consumir una unidad de una clave. Atómico.
 *
 * El CASE distingue los dos casos:
 *   - ventana vencida  -> el contador vuelve a 1 (se renueva sola, sin tarea)
 *   - ventana vigente  -> contador + 1
 * y el WHERE es la condición de permiso: renovar siempre, incrementar solo si
 * no está topado. Si la clave no cumple el WHERE, su fila no aparece en el
 * RETURNING, y esa ausencia es la señal de "en el tope".
 *
 * Dos detalles que costaron sangre y conviene no deshacer:
 *
 * 1. El WHERE va con OR, no con AND. Con `resets_en <= NOW() AND contador <
 *    limite` una fila recién insertada (resets_en en el futuro) nunca cumpliría
 *    la primera condición y no se incrementaría nunca.
 *
 * 2. La tabla se califica con un ALIAS (`AS c`). Calificarla con el nombre real
 *    (`cuotas.`) falla al insertar varias filas en una sentencia: Postgres da
 *    "missing FROM-clause entry for table cuotas", porque con más de una fila
 *    de VALUES la referencia al nombre no resuelve.
 */
async function intentarConsumir(
  clave: string,
  limite: number,
  fin: Date
): Promise<{ permitido: boolean; contador: number }> {
  const filas = await getSql()`
    INSERT INTO cuotas AS c (clave, contador, limite, resets_en)
    VALUES (${clave}, 1, ${limite}, ${fin})
    ON CONFLICT (clave) DO UPDATE
      SET contador = CASE
                        WHEN c.resets_en <= NOW() THEN 1
                        ELSE c.contador + 1
                      END,
          limite = EXCLUDED.limite,
          resets_en = EXCLUDED.resets_en,
          actualizado_en = NOW()
      WHERE c.resets_en <= NOW()
         OR c.contador < c.limite
    RETURNING contador, limite
  `;

  if (filas.length === 0) return { permitido: false, contador: 0 };
  return { permitido: true, contador: Number(filas[0].contador) };
}

/**
 * Devuelve una unidad consumida, para compensar un rechazo posterior.
 *
 * Solo se usa cuando el primer contador ya se consumió y el segundo rechaza:
 * sin esta compensación, al visitante se le cobraría un uso por una petición
 * que no se atendió. GREATEST(..., 0) evita que un contador quede negativo si
 * algo va mal.
 */
async function devolverUnidad(clave: string): Promise<void> {
  try {
    await getSql()`
      UPDATE cuotas SET contador = GREATEST(contador - 1, 0) WHERE clave = ${clave}
    `;
  } catch (error) {
    // La compensación es best-effort: perder una unidad es mucho menos grave
    // que propagar un error por ella.
    console.warn("No se pudo devolver la unidad de cuota.");
  }
}

export async function consumirUso(
  ambito: Ambito,
  uid: string | null
): Promise<DecisionCuota> {
  const limites = LIMITES[ambito];

  if (!uid) {
    // Sin identificador no hay contra quién contar, así que no se puede
    // aplicar una cuota. Se rechaza: permitir sería devolver el endpoint a un
    // consumo ilimitado, que es justo lo que se viene a cerrar.
    return {
      permitido: false,
      motivo: "sin_identificar",
      mensaje:
        "No hemos podido identificar este dispositivo para aplicar el límite de uso. Revisa que aceptes cookies y vuelve a intentarlo.",
      detalle: `petición sin uid para ${ambito}`,
      restantes: 0,
    };
  }

  try {
    const ahora = new Date();
    const fin = new Date(ahora.getTime() + limites.ventanaMs);
    const cVisita = claveVisitante(ambito, uid, ahora);
    const cGlobal = claveGlobal(ambito, ahora);

    // El contador del visitante va PRIMERO, y esto es lo que impide la denegación
    // de servicio. Cuando los dos contadores se incrementaban en la misma
    // sentencia, una petición rechazada por cuota de visitante consumía de todos
    // modos una unidad del tope global: quien hubiera agotado su cuota podía
    // seguir enviando peticiones y vaciar los 500 diarios globales, dejando sin
    // servicio a todo el mundo. Comprobado contra la base de datos real: un solo
    // rechazo dejaba el contador global en 1.
    //
    // Ahora, si el visitante ya está en el tope, se corta aquí y el contador
    // global no se toca.
    const visita = await intentarConsumir(cVisita, limites.porVisitante, fin);
    if (!visita.permitido) {
      return {
        permitido: false,
        motivo: "visitante",
        mensaje: mensaje(ambito, "visitante"),
        detalle: `${cVisita} en tope`,
        restantes: 0,
      };
    }

    const global = await intentarConsumir(cGlobal, limites.global, fin);
    if (!global.permitido) {
      // El tope global bloquea a un visitante que sí tenía margen: se le
      // devuelve la unidad para que no la pierda por una petición no atendida.
      await devolverUnidad(cVisita);
      return {
        permitido: false,
        motivo: "global",
        mensaje: mensaje(ambito, "global"),
        detalle: `${cGlobal} en tope`,
        restantes: 0,
      };
    }

    return { permitido: true, restantes: limites.porVisitante - visita.contador };
  } catch (error) {
    console.error("Fallo al comprobar la cuota; se permite el uso para no bloquear al usuario.");
    return { permitido: true, restantes: -1 };
  }
}

/**
 * Contador por clave arbitraria, para límites que no son de visitante.
 *
 * El caso que motiva esto: los leads se limitaban antes por IP con un Map en
 * memoria, que en Vercel solo existe en la instancia que atiende. Con ocho
 * instancias, "5 por hora" eran cuarenta. Aquí la IP cuenta igual de bien que
 * el uid, pero en la tabla y por tanto de forma global.
 */
export async function consumirUsoPorClave(
  ambito: Ambito,
  sufijo: string,
  limitePorClave: number
): Promise<{ permitido: boolean; restantes: number }> {
  try {
    const ahora = new Date();
    const fin = new Date(ahora.getTime() + LIMITES[ambito].ventanaMs);
    const clave = `${ambito}:ip:${sufijo}:${dia(ahora)}`;

    const r = await intentarConsumir(clave, limitePorClave, fin);
    if (!r.permitido) return { permitido: false, restantes: 0 };
    return { permitido: true, restantes: limitePorClave - r.contador };
  } catch (error) {
    console.error("Fallo al comprobar la cuota por clave; se permite.");
    return { permitido: true, restantes: -1 };
  }
}

export interface CuotaGlobal {
  ambito: Ambito;
  consumidos: number;
  limite: number;
  resetsEn: string;
  restantes: number;
}

/** Lectura sin incremento, para el panel de administración. */
export async function estadoCuotas(): Promise<CuotaGlobal[]> {
  try {
    const filas = await getSql()`
      SELECT clave, contador, limite, resets_en
      FROM cuotas
      WHERE resets_en > NOW()
        AND clave LIKE 'diag:global:%'
      ORDER BY resets_en ASC
      LIMIT 1
    `;
    if (filas.length === 0) return [];
    const f = filas[0];
    return [
      {
        ambito: "diag",
        consumidos: Number(f.contador),
        limite: Number(f.limite),
        resetsEn: new Date(f.resets_en as string).toISOString(),
        restantes: Math.max(0, Number(f.limite) - Number(f.contador)),
      },
    ];
  } catch (error) {
    console.error("Fallo al leer el estado de las cuotas.");
    return [];
  }
}

/** Lectura del detalle por visitante, para depurar un abuso concreto. */
export async function topConsumidores(limite = 10) {
  try {
    const filas = await getSql()`
      SELECT clave, contador, resets_en
      FROM cuotas
      WHERE resets_en > NOW() AND clave LIKE 'diag:%' AND clave NOT LIKE '%:global:%'
      ORDER BY contador DESC
      LIMIT ${limite}
    `;
    return filas.map((f) => ({
      uid: String(f.clave).split(":")[1],
      consumidos: Number(f.contador),
      resetsEn: new Date(f.resets_en as string).toISOString(),
    }));
  } catch (error) {
    console.error("Fallo al leer top consumidores.");
    return [];
  }
}
