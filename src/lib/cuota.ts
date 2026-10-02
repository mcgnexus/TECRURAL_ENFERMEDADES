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
  anonimos: 2,
  telefono: 6,
  global: 500,
  semanaMs: 7 * 24 * 60 * 60 * 1000,
  ventanaGlobalMs: 24 * 60 * 60 * 1000,
} as const;

export interface DecisionCuota {
  permitido: boolean;
  motivo?: "visitante" | "global" | "sin_identificar" | "database";
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
  await db`
    UPDATE cuota_usos
    SET telefono_hash = ${telefonoHash}
    WHERE visitor_id = ${uid}
      AND ambito = 'diag'
      AND telefono_hash IS NULL
      AND creado_en > NOW() - INTERVAL '7 days'
  `;
}

interface Intento {
  permitido: boolean;
  consumidos: number;
}

/**
 * Inserta un uso solo si los límites siguen disponibles. Los advisory locks se
 * toman en orden estable y permanecen hasta terminar esta única sentencia, de
 * modo que el conteo móvil y la inserción son atómicos entre instancias.
 */
async function intentarConsumo(args: {
  ambito: Ambito;
  sujeto: string;
  visitorId?: string;
  telefonoHash?: string | null;
  ip?: string;
  limite: number;
  ventanaMs: number;
  global?: { limite: number; ventanaMs: number };
}): Promise<Intento> {
  const db = getSql();
  const globalSujeto = `${args.ambito}:global`;
  const filas = await db`
    WITH purga_usos AS (
      DELETE FROM cuota_usos WHERE creado_en < NOW() - INTERVAL '31 days'
      RETURNING id
    ),
    purga_telefonos AS (
      DELETE FROM cuota_telefonos WHERE expira_en <= NOW()
      RETURNING visitor_id
    ),
    lock_keys AS MATERIALIZED (
      SELECT clave
      FROM unnest(ARRAY[${args.sujeto}, ${globalSujeto}]) AS x(clave)
      GROUP BY clave
      ORDER BY clave
    ),
    locks AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(clave, 0))
      FROM lock_keys
    ),
    conteos AS MATERIALIZED (
      SELECT
        (
          SELECT COUNT(*)::int FROM cuota_usos u
          WHERE u.ambito = ${args.ambito}
            AND (
              u.sujeto = ${args.sujeto}
              OR (
                ${Boolean(args.telefonoHash)}
                AND u.telefono_hash = ${args.telefonoHash ?? null}
                AND u.sujeto <> ${globalSujeto}
              )
            )
            AND u.creado_en > NOW() - (${args.ventanaMs}::bigint * INTERVAL '1 millisecond')
            AND EXISTS (SELECT 1 FROM locks)
        ) AS propios,
        (
          SELECT COUNT(*)::int FROM cuota_usos u
          WHERE ${Boolean(args.global)}
            AND u.ambito = ${args.ambito}
            AND u.sujeto = ${globalSujeto}
            AND u.creado_en > NOW() - (${args.global?.ventanaMs ?? 0}::bigint * INTERVAL '1 millisecond')
            AND EXISTS (SELECT 1 FROM locks)
        ) AS globales
    ),
    insertado AS (
      INSERT INTO cuota_usos (ambito, sujeto, visitor_id, telefono_hash, ip)
      SELECT ${args.ambito}, uso.sujeto, ${args.visitorId ?? null}, ${args.telefonoHash ?? null}, ${args.ip ?? null}
      FROM conteos
      CROSS JOIN LATERAL (
        SELECT ${args.sujeto}::text AS sujeto
        WHERE propios < ${args.limite}
          AND (NOT ${Boolean(args.global)} OR globales < ${args.global?.limite ?? 0})
        UNION ALL
        SELECT ${globalSujeto}::text AS sujeto
        WHERE ${Boolean(args.global)}
          AND propios < ${args.limite}
          AND globales < ${args.global?.limite ?? 0}
      ) uso
      RETURNING id
    )
    SELECT conteos.propios, COUNT(insertado.id)::int AS insertados
    FROM conteos LEFT JOIN insertado ON TRUE
    GROUP BY conteos.propios
  `;

  if (Number(filas[0]?.insertados) > 0) {
    return { permitido: true, consumidos: Number(filas[0].propios) + 1 };
  }
  return { permitido: false, consumidos: 0 };
}

export async function consumirUso(ambito: Ambito, uid: string | null): Promise<DecisionCuota> {
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

    const telefonoHash = await telefonoCuotaDeVisitante(uid);
    const sujeto = telefonoHash ? `telefono:${telefonoHash}` : `visitante:${uid}`;
    const limite = telefonoHash ? LIMITES.telefono : LIMITES.anonimos;
    const resultado = await intentarConsumo({
      ambito,
      sujeto,
      visitorId: uid,
      telefonoHash,
      limite,
      ventanaMs: LIMITES.semanaMs,
      global: { limite: LIMITES.global, ventanaMs: LIMITES.ventanaGlobalMs },
    });
    if (resultado.permitido) {
      return { permitido: true, restantes: limite - resultado.consumidos };
    }

    const conteos = await getSql()`
      SELECT
        COUNT(*) FILTER (WHERE sujeto = ${sujeto} AND creado_en > NOW() - INTERVAL '7 days')::int AS propios,
        COUNT(*) FILTER (WHERE sujeto = 'diag:global' AND creado_en > NOW() - INTERVAL '24 hours')::int AS globales
      FROM cuota_usos WHERE ambito = 'diag'
    `;
    const global = Number(conteos[0]?.globales ?? 0) >= LIMITES.global;
    const requiereTelefono = !telefonoHash && !global;
    return {
      permitido: false,
      motivo: global ? "global" : "visitante",
      mensaje: global
        ? "El servicio está muy solicitado. Inténtalo de nuevo más tarde."
        : telefonoHash
          ? "Has alcanzado los 6 análisis de esta semana. Podrás volver a analizar cuando se renueve el límite semanal."
          : "Has completado tus 2 análisis iniciales de esta semana. Si quieres ampliar el límite a 6 análisis semanales, puedes facilitar tu teléfono.",
      restantes: 0,
      requiereTelefono,
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
  ip?: string,
): Promise<{ permitido: boolean; restantes: number; motivo?: "limite" | "database" }> {
  try {
    const resultado = await intentarConsumo({
      ambito,
      sujeto: `${ambito}:${sufijo}`,
      limite: limitePorClave,
      ventanaMs,
      ip,
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
