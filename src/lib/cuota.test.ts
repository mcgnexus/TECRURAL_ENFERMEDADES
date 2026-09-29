import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * Cuotas de uso.
 *
 * Estas pruebas tocan Postgres DE VERDAD, porque lo que verifican es el
 * comportamiento del SQL: que el incremento sea atómico con peticiones
 * simultáneas, que la ventana se renueve sola, y que un rechazo no consuma el
 * tope global. Con un doble en memoria se probaría mi copia de la lógica, no la
 * que se ejecuta.
 *
 * Por eso exigen TEST_DATABASE_URL y se NIEGAN a correr si coincide con
 * DATABASE_URL: borran la tabla `cuotas` entre pruebas y no deben hacerlo nunca
 * sobre producción.
 *
 * Para ejecutarlas, apunta TEST_DATABASE_URL a una rama de Neon o a otra base:
 *   TEST_DATABASE_URL="postgres://..." npm test
 */

const testUrl = process.env.TEST_DATABASE_URL;
const esDistintaDeProduccion = Boolean(testUrl) && testUrl !== process.env.DATABASE_URL;
const contraProduccion = process.env.PERMITIR_TESTS_EN_PRODUCCION === "1";
const disponible = esDistintaDeProduccion || contraProduccion;

if (esDistintaDeProduccion) {
  // cuota.ts y database.ts leen DATABASE_URL, pero abren la conexión de forma
  // perezosa en la primera consulta. Redirigirla aquí, antes de que ninguna
  // prueba la ejecute, hace que todo apunte a la base de pruebas.
  process.env.DATABASE_URL = testUrl;
} else if (contraProduccion) {
  console.warn(
    "\n  ATENCIÓN: pruebas de cuota contra la base de DATABASE_URL.\n" +
      "  Solo tocan la tabla `cuotas`, así que no borran leads, diagnósticos ni\n" +
      "  eventos, pero SÍ reinician los contadores de cuota del día. Si eso no\n" +
      "  es aceptable, apunta TEST_DATABASE_URL a una rama de Neon y quita\n" +
      "  PERMITIR_TESTS_EN_PRODUCCION.\n"
  );
} else if (!testUrl) {
  console.warn(
    "\n  Pruebas de cuota SALTADAS: falta TEST_DATABASE_URL.\n" +
      "  Opciones:\n" +
      "    - Apunta TEST_DATABASE_URL a una base de pruebas (recomendado).\n" +
      "    - O ejecuta con PERMITIR_TESTS_EN_PRODUCCION=1, sabiendo que reinicia\n" +
      "      los contadores de cuota del día. No borra datos de usuarios.\n"
  );
} else {
  console.warn(
    "\n  Pruebas de cuota SALTADAS: TEST_DATABASE_URL es igual que DATABASE_URL.\n" +
      "  Si es intencionado, usa PERMITIR_TESTS_EN_PRODUCCION=1 para confirmarlo.\n"
  );
}

// Los imports que abren conexión van después del cambio de variable; por eso
// se cargan de forma dinámica dentro del describe.
describe.skipIf(!disponible)("cuotas", () => {
  let mod: typeof import("./cuota");
  // Igual que en database.ts: sin fijar el tipo, el resultado de la plantilla
  // es una unión y TypeScript no deja indexarlo.
  let sql: import("@neondatabase/serverless").NeonQueryFunction<false, false>;
  let LIMITES: typeof import("./cuota").LIMITES;

  const dia = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const claveVisita = (ambito: string, uid: string) => `${ambito}:${uid}:${dia()}`;
  const claveGlobal = (ambito: string) => `${ambito}:global:${dia()}`;

  const contador = async (clave: string): Promise<string> => {
    const r = await sql`SELECT contador, limite FROM cuotas WHERE clave = ${clave}`;
    return r.length ? `${r[0].contador}/${r[0].limite}` : "(sin fila)";
  };

  beforeAll(async () => {
    const { neon } = await import("@neondatabase/serverless");
    mod = await import("./cuota");
    LIMITES = mod.LIMITES;
    sql = neon(process.env.DATABASE_URL!);
    const { initDatabase } = await import("./database");
    await initDatabase();
  });

  beforeEach(async () => {
    await sql`DELETE FROM cuotas`;
  });

  afterAll(async () => {
    await sql`DELETE FROM cuotas`;
  });

  it("rechaza si no hay identificador de visitante", async () => {
    const r = await mod.consumirUso("diag", null);
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("sin_identificar");
    expect(await contador(claveGlobal("diag"))).toBe("(sin fila)");
  });

  it("permite hasta el límite del visitante y luego rechaza", async () => {
    const uid = randomUUID();
    let permitidos = 0;
    for (let i = 0; i < LIMITES.diag.porVisitante; i++) {
      if ((await mod.consumirUso("diag", uid)).permitido) permitidos++;
    }
    expect(permitidos).toBe(LIMITES.diag.porVisitante);

    const extra = await mod.consumirUso("diag", uid);
    expect(extra.permitido).toBe(false);
    expect(extra.motivo).toBe("visitante");
    expect(extra.mensaje).toMatch(/límite/i);
  });

  it("reintentar una vez en el tope no lo libera", async () => {
    const uid = randomUUID();
    for (let i = 0; i < LIMITES.diag.porVisitante; i++) await mod.consumirUso("diag", uid);
    const a = await mod.consumirUso("diag", uid);
    const b = await mod.consumirUso("diag", uid);
    expect(a.permitido).toBe(false);
    expect(b.permitido).toBe(false);
  });

  it("informa de los usos restantes", async () => {
    const uid = randomUUID();
    const r = await mod.consumirUso("diag", uid);
    expect(r.restantes).toBe(LIMITES.diag.porVisitante - 1);
  });

  it("un visitante no consume el límite de otro", async () => {
    const a = randomUUID();
    const b = randomUUID();
    for (let i = 0; i < LIMITES.diag.porVisitante; i++) await mod.consumirUso("diag", a);
    const r = await mod.consumirUso("diag", b);
    expect(r.permitido).toBe(true);
    expect(r.restantes).toBe(LIMITES.diag.porVisitante - 1);
  });

  it("el contador es atómico con peticiones simultáneas", async () => {
    // Si el contador no fuera atómico (leer y luego escribir), las 25 leerían el
    // mismo valor y pasarían todas.
    const uid = randomUUID();
    const resultados = await Promise.all(
      Array.from({ length: 25 }, () => mod.consumirUso("diag", uid))
    );
    const permitidos = resultados.filter((r) => r.permitido).length;
    expect(permitidos).toBe(LIMITES.diag.porVisitante);
    expect(await contador(claveVisita("diag", uid))).toBe(
      `${LIMITES.diag.porVisitante}/${LIMITES.diag.porVisitante}`
    );
  });

  it("un rechazo por cuota de visitante NO consume el tope global", async () => {
    // Este fue un fallo real: los dos contadores se incrementaban en la misma
    // sentencia, así que una petición rechazada gastaba igualmente una unidad
    // del tope global. Quien agotara su cuota podía seguir enviando peticiones
    // hasta vaciar los 500 diarios y dejar sin servicio a todo el mundo.
    const uid = randomUUID();
    for (let i = 0; i < LIMITES.diag.porVisitante; i++) await mod.consumirUso("diag", uid);
    const globalTrasAgotar = await contador(claveGlobal("diag"));

    for (let i = 0; i < 20; i++) await mod.consumirUso("diag", uid);

    expect(await contador(claveGlobal("diag"))).toBe(globalTrasAgotar);
    expect(globalTrasAgotar).toBe(`${LIMITES.diag.porVisitante}/500`);
  });

  it("con el tope global agotado rechaza por global y no cobra al visitante", async () => {
    const uid = randomUUID();
    await sql`
      INSERT INTO cuotas (clave, contador, limite, resets_en)
      VALUES (${claveGlobal("diag")}, ${LIMITES.diag.global}, ${LIMITES.diag.global}, NOW() + interval '1 day')`;

    const r = await mod.consumirUso("diag", uid);
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("global");

    // La unidad consumida antes de descubrir el tope global se devuelve, así que
    // el visitante conserva sus usos para cuando el servicio se recupere.
    const fila = await contador(claveVisita("diag", uid));
    expect(fila === "(sin fila)" || fila === "0/10").toBe(true);
  });

  it("la ventana vencida se renueva sola, sin tarea programada", async () => {
    const uid = randomUUID();
    // Dejar la clave global vencida y en el tope: debe renovarse al consultarla.
    await sql`
      INSERT INTO cuotas (clave, contador, limite, resets_en)
      VALUES (${claveGlobal("diag")}, ${LIMITES.diag.global}, ${LIMITES.diag.global}, NOW() - interval '1 hour')`;

    const r = await mod.consumirUso("diag", uid);
    expect(r.permitido).toBe(true);
  });

  it("la cuota por IP limita los leads", async () => {
    const ip = "9.9.9.9";
    let permitidos = 0;
    for (let i = 0; i < 8; i++) {
      if ((await mod.consumirUsoPorClave("lead", ip, 5)).permitido) permitidos++;
    }
    expect(permitidos).toBe(5);
  });
});
