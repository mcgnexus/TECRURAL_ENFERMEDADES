#!/usr/bin/env node
/**
 * Limpieza puntual: borra los diagnósticos de las pruebas de desarrollo.
 *
 * CONTEXTO
 *
 * `initDatabase()` ejecutaba antes un `DELETE FROM diagnosticos WHERE
 * usuario_id = 'usuario_demo'` en cada arranque en frío. Era una operación
 * destructiva metida en la inicialización del esquema, y la inicialización
 * corre desde las peticiones. Se ha sacado de ahí.
 *
 * Los registros que borra son de cuando el cliente enviaba el identificador de
 * visitante en el cuerpo de la petición y estaba fijado a "usuario_demo". Eso
 * ya no es posible: el identificador lo emite el proxy como UUID y el cuerpo ya
 * no se acepta, así que esos registros no pueden reaparecer. Por eso la
 * limpieza solo hace falta una vez.
 *
 * USO
 *
 *   node db/one-off/limpiar-usuario-demo.mjs              # solo muestra qué borraría
 *   node db/one-off/limpiar-usuario-demo.mjs --aplicar    # borra
 *
 * Sin `--aplicar` no modifica nada. Hay que leer la previsualización y decidir.
 *
 * La variable DATABASE_URL se toma del entorno o, si no está, de .env.local.
 */

import fs from "node:fs";
import path from "node:path";

const IDENTIFICADOR = "usuario_demo";
const APLICAR = process.argv.includes("--aplicar");

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

/** Host sin credenciales, para dejar constancia de sobre qué base se actúa. */
function describeDestino(url) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(no se pudo interpretar DATABASE_URL)";
  }
}

console.log(`Limpieza puntual de diagnósticos de prueba ('${IDENTIFICADOR}')`);
console.log(`Base de datos: ${describeDestino(process.env.DATABASE_URL)}\n`);

// Todo va en una función, y al terminar se devuelve en vez de llamar a
// process.exit(): salir de golpe con una conexión HTTP abierta (neon usa fetch)
// provoca un fallo de libuv en Windows — "Assertion failed: !(handle->flags &
// UV_HANDLE_CLOSING)" — porque se cierra el proceso con handles vivos.
async function main() {
  // -------------------------------------------------------------------------
  // Previsualización: qué se borraría y qué se vería afectado
  // -------------------------------------------------------------------------

  const filas = await sql`
    SELECT COUNT(*)::int AS total,
           MIN(created_at)::text AS desde,
           MAX(created_at)::text AS hasta
    FROM diagnosticos
    WHERE usuario_id = ${IDENTIFICADOR}
  `;
  const total = filas[0]?.total ?? 0;

  if (total === 0) {
    console.log(`No hay diagnósticos con usuario_id = '${IDENTIFICADOR}'. Nada que hacer.`);
    return;
  }

  console.log(`Registros en diagnosticos con usuario_id = '${IDENTIFICADOR}': ${total}`);
  console.log(`  rango de fechas: ${filas[0].desde} -> ${filas[0].hasta}`);

  // Efecto colateral: los leads apuntan al diagnóstico con ON DELETE SET NULL,
  // así que si alguno estuviera enlazado perdería la referencia. Hay que saberlo
  // ANTES de borrar, no después.
  const enlazados = await sql`
    SELECT COUNT(*)::int AS total
    FROM leads
    WHERE diagnostico_id IN (
      SELECT id FROM diagnosticos WHERE usuario_id = ${IDENTIFICADOR}
    )
  `;
  const leadsAfectados = enlazados[0]?.total ?? 0;
  console.log(`Leads que perderían su diagnostico_id (quedarían a NULL): ${leadsAfectados}`);

  const muestra = await sql`
    SELECT id, especie, created_at::text AS creado
    FROM diagnosticos
    WHERE usuario_id = ${IDENTIFICADOR}
    ORDER BY created_at
    LIMIT 5
  `;
  console.log("\nPrimeros registros que se borrarían:");
  for (const f of muestra) {
    console.log(`  ${f.id}  ${f.especie}  ${f.creado}`);
  }
  if (total > muestra.length) console.log(`  ... y ${total - muestra.length} más`);

  console.log("\nEsta operación es IRREVERSIBLE.");

  if (!APLICAR) {
    console.log("\nModo previsualización: no se ha borrado nada.");
    console.log(`Para ejecutarla:  node db/one-off/limpiar-usuario-demo.mjs --aplicar`);
    return;
  }

  // -------------------------------------------------------------------------
  // Ejecución
  // -------------------------------------------------------------------------

  console.log("\n--aplicar detectado. Borrando...");
  const borradas = await sql`
    DELETE FROM diagnosticos
    WHERE usuario_id = ${IDENTIFICADOR}
    RETURNING id
  `;
  console.log(`Borrados ${borradas.length} diagnósticos.`);

  const restantes = await sql`
    SELECT COUNT(*)::int AS total FROM diagnosticos WHERE usuario_id = ${IDENTIFICADOR}
  `;
  console.log(`Quedan con ese identificador: ${restantes[0]?.total ?? 0}`);
}

await main();
