import { createHmac } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL no configurada");
    sql = neon(url);
  }
  return sql;
}

export type Ambito = "diag" | "lead";

export const LIMITES = {
  /** Análisis sin datos de contacto, por visitante y ventana móvil de 7 días. */
  anonimos: 2,
  /** Análisis por teléfono vinculado y ventana móvil de 7 días (incluye los anónimos). */
  telefono: 6,
  /** Tope total de la app cada 24 h, red de seguridad frente a coste desbocado. */
  global: 500,
  /**
   * Límite complementario por conexión (IP) cada 24 h. No identifica a la
   * persona: es una red secundaria para frenar el reinicio de cookie o el uso
   * automatizado. Se deja holgado porque varias personas pueden compartir IP
   * (red móvil, wifi de cooperativa).
   */
  ipDiag: 12,
  semanaMs: 7 * 24 * 60 * 60 * 1000,
  diaMs: 24 * 60 * 60 * 1000,
} as const;

export interface DecisionCuota {
  permitido: boolean;
  motivo?: "visitante" | "global" | "red" | "sin_identificar" | "database";
  mensaje?: string;
  restantes: number;
  requiereTelefono?: boolean;
}

export function hashTelefonoCuota(telefono: string): string {
  const secreto = process.env.CUOTA_TELEFONO_SECRET;
  if (!secreto) throw new Error("CUOTA_TELEFONO_SECRET no configurado");
  return createHmac("sha256", secreto).update(telefono).digest("hex");
}

export async function telefonoCuotaDeVisitante(uid: string): Promise<string | null> {
  const rows = await getSql()`
    SELECT telefono_hash FROM cuota_telefonos
    WHERE visitor_id = ${uid} AND expira_en > NOW()
  `;
  return rows[0]?.telefono_hash ? String(rows[0].telefono_hash) : null;
}

/**
 * Vincula una cuota semanal al visitante sin conservar el teléfono en claro.
 * Los análisis anónimos de los últimos siete días cuentan dentro del máximo
 * semanal al vincular el teléfono.
 */
export async function vincularTelefonoCuota(uid: string, telefonoHash: string): Promise<void> {
  const db = getSql();
  const insertado = await db`
    INSERT INTO cuota_telefonos (visitor_id, telefono_hash, expira_en)
    VALUES (${uid}, ${telefonoHash}, NOW() + INTERVAL '180 days')
    ON CONFLICT (visitor_id) DO NOTHING
    RETURNING visitor_id
  `;
  if (!insertado.length) {
    const existente = await db`
      SELECT telefono_hash FROM cuota_telefonos WHERE visitor_id = ${uid}
    `;
    if (existente[0]?.telefono_hash !== telefonoHash) {
      throw new Error("Este dispositivo ya tiene un teléfono vinculado.");
    }
  }
  // Solo se etiquetan los usos anónimos del propio visitante, no las filas de
  // límites secundarios (global/IP), que no deben contarse dos veces.
  await db`
    UPDATE cuota_usos
    SET telefono_hash = ${telefonoHash}
    WHERE visitor_id = ${uid}
      AND ambito = 'diag'
      AND telefono_hash IS NULL
      AND sujeto LIKE 'visitante:%'
      AND creado_en > NOW() - INTERVAL '7 days'
  `;
}

interface LimiteSecundario {
  sujeto: string;
  limite: number;
  ventanaMs: number;
}

interface Intento {
  permitido: boolean;
  consumidos: number;
}

/**
 * Inserta un uso solo si TODOS los límites siguen disponibles: el primario
 * (visitante o teléfono) y cada uno de los secundarios (global, IP) que se
 * pasen. Cuando se permite, inserta una fila por cada límite en la MISMA
 * sentencia, de forma atómica.
 *
 * Los advisory locks se toman en orden estable sobre todos los sujetos
 * implicados y permanecen hasta terminar esta única sentencia, de modo que el
 * conteo móvil y la inserción no tienen ventana entre instancias.
 */
async function intentarConsumo(args: {
  ambito: Ambito;
  sujeto: string;
  visitorId?: string;
  telefonoHash?: string | null;
  ip?: string | null;
  limite: number;
  ventanaMs: number;
  secundarios?: LimiteSecundario[];
}): Promise<Intento> {
  const db = getSql();
  const secundarios: LimiteSecundario[] = args.secundarios ?? [];
  const secundariosJson = JSON.stringify(
    secundarios.map((s) => ({ sujeto: s.sujeto, limite: s.limite, ventana_ms: s.ventanaMs })),
  );

  const filas = await db`
    WITH purga_usos AS (
      DELETE FROM cuota_usos WHERE creado_en < NOW() - INTERVAL '31 days'
      RETURNING id
    ),
    purga_telefonos AS (
      DELETE FROM cuota_telefonos WHERE expira_en <= NOW()
      RETURNING visitor_id
    ),
    sec_defs AS (
      SELECT sujeto, limite, ventana_ms
      FROM jsonb_to_recordset(${secundariosJson}::jsonb)
        AS x(sujeto text, limite int, ventana_ms bigint)
    ),
    lock_keys AS MATERIALIZED (
      SELECT clave FROM (
        SELECT ${args.sujeto}::text AS clave
        UNION
        SELECT sujeto AS clave FROM sec_defs
      ) t
      GROUP BY clave
      ORDER BY clave
    ),
    locks AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(clave, 0))
      FROM lock_keys
    ),
    conteos AS MATERIALIZED (
      SELECT (
        SELECT COUNT(*)::int FROM cuota_usos u
        WHERE u.ambito = ${args.ambito}
          AND (
            u.sujeto = ${args.sujeto}
            OR (
              ${Boolean(args.telefonoHash)}
              AND u.telefono_hash = ${args.telefonoHash ?? null}
              AND u.sujeto LIKE 'visitante:%'
            )
          )
          AND u.creado_en > NOW() - (${args.ventanaMs}::bigint * INTERVAL '1 millisecond')
          AND EXISTS (SELECT 1 FROM locks)
      ) AS propios
    ),
    sec_conteos AS MATERIALIZED (
      SELECT d.sujeto, d.limite,
        (
          SELECT COUNT(*)::int FROM cuota_usos u
          WHERE u.ambito = ${args.ambito}
            AND u.sujeto = d.sujeto
            AND u.creado_en > NOW() - (d.ventana_ms * INTERVAL '1 millisecond')
            AND EXISTS (SELECT 1 FROM locks)
        ) AS consumidos
      FROM sec_defs d
    ),
    permitido AS MATERIALIZED (
      SELECT
        (SELECT propios FROM conteos) AS propios,
        (SELECT propios FROM conteos) < ${args.limite}
          AND NOT EXISTS (SELECT 1 FROM sec_conteos WHERE consumidos >= limite) AS ok
    ),
    insertado AS (
      INSERT INTO cuota_usos (ambito, sujeto, visitor_id, telefono_hash, ip)
      SELECT
        ${args.ambito},
        uso.sujeto,
        ${args.visitorId ?? null},
        CASE WHEN uso.es_principal THEN ${args.telefonoHash ?? null} ELSE NULL END,
        ${args.ip ?? null}
      FROM permitido
      CROSS JOIN LATERAL (
        SELECT ${args.sujeto}::text AS sujeto, true AS es_principal WHERE permitido.ok
        UNION ALL
        SELECT sc.sujeto, false FROM sec_conteos sc WHERE permitido.ok
      ) uso
      RETURNING id
    )
    SELECT permitido.propios, COUNT(insertado.id)::int AS insertados
    FROM permitido LEFT JOIN insertado ON TRUE
    GROUP BY permitido.propios
  `;

  if (Number(filas[0]?.insertados) > 0) {
    return { permitido: true, consumidos: Number(filas[0].propios) + 1 };
  }
  return { permitido: false, consumidos: 0 };
}

/** IP válida para límites; descarta el centinela cuando el cliente no la trae. */
function ipParaLimite(ip: string | null | undefined): string | null {
  return ip && ip !== "desconocida" ? ip : null;
}

export async function consumirUso(
  ambito: Ambito,
  uid: string | null,
  ip?: string | null,
): Promise<DecisionCuota> {
  if (!uid) {
    return {
      permitido: false,
      motivo: "sin_identificar",
      mensaje: "No hemos podido identificar este dispositivo. Recarga la página e inténtalo de nuevo.",
      restantes: 0,
    };
  }

  try {
    if (ambito !== "diag") {
      const porClave = await consumirUsoPorClave(ambito, uid, 5, 60 * 60 * 1000);
      return {
        permitido: porClave.permitido,
        restantes: porClave.restantes,
        ...(porClave.permitido ? {} : porClave.motivo === "database" ? { motivo: "database" as const } : { motivo: "visitante" as const }),
        mensaje: porClave.permitido
          ? undefined
          : porClave.motivo === "database"
            ? "No podemos comprobar el límite de uso ahora mismo. Inténtalo de nuevo en unos minutos."
            : "Has alcanzado el límite de solicitudes de este dispositivo. Espera un rato antes de volver a intentarlo.",
      };
    }

    const ipValida = ipParaLimite(ip);
    const telefonoHash = await telefonoCuotaDeVisitante(uid);
    const sujeto = telefonoHash ? `telefono:${telefonoHash}` : `visitante:${uid}`;
    const limite = telefonoHash ? LIMITES.telefono : LIMITES.anonimos;

    const secundarios: LimiteSecundario[] = [
      { sujeto: "diag:global", limite: LIMITES.global, ventanaMs: LIMITES.diaMs },
    ];
    if (ipValida) {
      secundarios.push({ sujeto: `diag:ip:${ipValida}`, limite: LIMITES.ipDiag, ventanaMs: LIMITES.diaMs });
    }

    const resultado = await intentarConsumo({
      ambito,
      sujeto,
      visitorId: uid,
      telefonoHash,
      ip: ipValida,
      limite,
      ventanaMs: LIMITES.semanaMs,
      secundarios,
    });
    if (resultado.permitido) {
      return { permitido: true, restantes: limite - resultado.consumidos };
    }

    // Bloqueado: se averigua qué límite saltó para dar el mensaje correcto y no
    // ofrecer el teléfono cuando el problema es la conexión o el servicio.
    const ipSujeto = ipValida ? `diag:ip:${ipValida}` : null;
    const conteos = await getSql()`
      SELECT
        (
          SELECT COUNT(*)::int FROM cuota_usos
          WHERE ambito = 'diag'
            AND (
              sujeto = ${sujeto}
              OR (
                ${Boolean(telefonoHash)}
                AND telefono_hash = ${telefonoHash ?? null}
                AND sujeto LIKE 'visitante:%'
              )
            )
            AND creado_en > NOW() - INTERVAL '7 days'
        ) AS propios,
        (
          SELECT COUNT(*)::int FROM cuota_usos
          WHERE ambito = 'diag' AND sujeto = 'diag:global'
            AND creado_en > NOW() - INTERVAL '24 hours'
        ) AS globales,
        (
          SELECT COUNT(*)::int FROM cuota_usos
          WHERE ambito = 'diag' AND sujeto = ${ipSujeto}
            AND creado_en > NOW() - INTERVAL '24 hours'
        ) AS por_ip
    `;
    const propios = Number(conteos[0]?.propios ?? 0);
    const globales = Number(conteos[0]?.globales ?? 0);
    const porIp = Number(conteos[0]?.por_ip ?? 0);

    if (globales >= LIMITES.global) {
      return {
        permitido: false,
        motivo: "global",
        mensaje: "El servicio está muy solicitado. Inténtalo de nuevo más tarde.",
        restantes: 0,
      };
    }
    if (ipValida && porIp >= LIMITES.ipDiag) {
      return {
        permitido: false,
        motivo: "red",
        mensaje: "Se han alcanzado los análisis permitidos desde esta conexión. Si no eres tú, inténtalo más tarde o desde otra red.",
        restantes: 0,
      };
    }
    return {
      permitido: false,
      motivo: "visitante",
      mensaje: telefonoHash
        ? "Has alcanzado los 6 análisis de esta semana. Podrás volver a analizar cuando se renueve el límite semanal."
        : "Has completado tus 2 análisis iniciales de esta semana. Si quieres ampliar el límite a 6 análisis semanales, puedes facilitar tu teléfono.",
      restantes: 0,
      requiereTelefono: !telefonoHash,
    };
  } catch {
    console.error("No se pudo comprobar la cuota de análisis.");
    return {
      permitido: false,
      motivo: "database",
      mensaje: "No podemos comprobar el límite de uso ahora mismo. Inténtalo de nuevo en unos minutos.",
      restantes: 0,
    };
  }
}

export async function consumirUsoPorClave(
  ambito: Ambito,
  sufijo: string,
  limitePorClave: number,
  ventanaMs = 60 * 60 * 1000,
  ip?: string | null,
): Promise<{ permitido: boolean; restantes: number; motivo?: "limite" | "database" }> {
  try {
    const resultado = await intentarConsumo({
      ambito,
      sujeto: `${ambito}:${sufijo}`,
      limite: limitePorClave,
      ventanaMs,
      ip: ipParaLimite(ip),
    });
    return {
      permitido: resultado.permitido,
      restantes: resultado.permitido ? limitePorClave - resultado.consumidos : 0,
      ...(resultado.permitido ? {} : { motivo: "limite" as const }),
    };
  } catch {
    console.error("No se pudo comprobar el límite de peticiones.");
    return { permitido: false, restantes: 0, motivo: "database" };
  }
}

export interface CuotaGlobal {
  ambito: Ambito;
  consumidos: number;
  limite: number;
  resetsEn: string;
  restantes: number;
}

export async function estadoCuotas(): Promise<CuotaGlobal[]> {
  try {
    const filas = await getSql()`
      SELECT COUNT(*)::int AS consumidos,
             (SELECT MIN(creado_en) + INTERVAL '24 hours'
              FROM cuota_usos
              WHERE ambito = 'diag' AND sujeto = 'diag:global'
                AND creado_en > NOW() - INTERVAL '24 hours') AS resets_en
      FROM cuota_usos
      WHERE ambito = 'diag' AND sujeto = 'diag:global'
        AND creado_en > NOW() - INTERVAL '24 hours'
    `;
    const consumidos = Number(filas[0]?.consumidos ?? 0);
    if (!consumidos) return [];
    return [{
      ambito: "diag",
      consumidos,
      limite: LIMITES.global,
      resetsEn: new Date(filas[0].resets_en as string).toISOString(),
      restantes: Math.max(0, LIMITES.global - consumidos),
    }];
  } catch {
    console.error("No se pudo leer el estado de las cuotas.");
    return [];
  }
}
