#!/usr/bin/env node
/**
 * Auditoría de solo lectura de consentimientos comerciales históricos.
 *
 * CONTEXTO
 *
 * La app anterior calculaba el canal comercial con `datos.telefono ?
 * "whatsapp" : "correo"` para los dos formularios. En el formulario del
 * informe la casilla mostrada era de correo, así que un lead con teléfono de
 * revisión podía quedar guardado como consentimiento de WhatsApp. Este script
 * identifica esos casos; NO los corrige y NO concede consentimientos nuevos.
 *
 * USO
 *
 *   node db/one-off/auditar-consentimientos-comerciales.mjs
 *
 * Es de solo lectura: no tiene `--aplicar` y no ejecuta ninguna escritura.
 * La variable DATABASE_URL se toma del entorno o, si no está, de .env.local.
 */

import fs from "node:fs";
import path from "node:path";

// Carga de .env.local solo para uso local; en producción se espera que
// DATABASE_URL venga del entorno y este archivo no exista.
const rutaEnv = path.resolve(process.cwd(), ".env.local");
if (!process.env.DATABASE_URL && fs.existsSync(rutaEnv)) {
  for (const linea of fs.readFileSync(rutaEnv, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. Defínela en el entorno o en .env.local.");
  process.exit(1);
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

function describeDestino(url) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(no se pudo interpretar DATABASE_URL)";
  }
}

/**
 * Cada consulta es una forma distinta de mirar el mismo problema histórico.
 * `where` es SQL fijo de este archivo (nunca datos del usuario) y se interpola
 * con `sql.unsafe`, la vía que ofrece el driver para fragmentos.
 */
const CONSULTAS = [
  {
    titulo: "Legacy sin registro explícito (booleano antiguo, array vacío)",
    where: `consentimiento_comercial = TRUE
        AND (consentimientos_comerciales IS NULL
             OR jsonb_array_length(consentimientos_comerciales) = 0)`,
  },
  {
    titulo: "Posible canal incorrecto: informe con teléfono marcado como WhatsApp",
    where: `consentimiento_comercial = TRUE
        AND origen = 'post_diagnostico'
        AND btrim(telefono) <> ''
        AND canal_comercial = 'whatsapp'`,
  },
  {
    titulo: "Contacto directo sin teléfono (canal WhatsApp no mostrado)",
    where: `consentimiento_comercial = TRUE
        AND origen = 'contacto_directo'
        AND btrim(telefono) = ''`,
  },
  {
    titulo: "Consentimiento sin canal",
    where: `consentimiento_comercial = TRUE
        AND canal_comercial IS NULL`,
  },
];

async function main() {
  console.log("Auditoría de consentimientos comerciales históricos (solo lectura)");
  console.log(`Base de datos: ${describeDestino(process.env.DATABASE_URL)}\n`);

  for (const { titulo, where } of CONSULTAS) {
    const totales = await sql`
      SELECT COUNT(*)::int AS total,
             MIN(created_at)::text AS desde,
             MAX(created_at)::text AS hasta
      FROM leads
      WHERE ${sql.unsafe(where)}
    `;
    const total = totales[0]?.total ?? 0;

    console.log(`- ${titulo}: ${total}`);
    if (total > 0) {
      console.log(
        `  rango: ${totales[0].desde ?? "—"} -> ${totales[0].hasta ?? "—"}`
      );
    }

    if (total > 0) {
      const muestra = await sql`
        SELECT id, origen, canal_comercial, created_at::text AS creado
        FROM leads
        WHERE ${sql.unsafe(where)}
        ORDER BY created_at
        LIMIT 10
      `;
      for (const fila of muestra) {
        console.log(
          `  ${fila.id}  ${fila.origen}  canal=${fila.canal_comercial ?? "—"}  ${fila.creado}`
        );
      }
      if (total > muestra.length) {
        console.log(`  ... y ${total - muestra.length} más`);
      }
    }
    console.log("");
  }

  console.log("No se ha modificado ningún registro; estos casos requieren revisión manual.");
  console.log(
    "Enviar publicidad a un contacto histórico sin consentimiento verificado sigue siendo un riesgo legal."
  );
}

await main();
