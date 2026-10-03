import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const testUrl = process.env.TEST_DATABASE_URL;
const disponible = Boolean(testUrl) && testUrl !== process.env.DATABASE_URL;
if (disponible) process.env.DATABASE_URL = testUrl;
process.env.CUOTA_TELEFONO_SECRET = "vitest-secret-for-quota-tests";

if (!disponible) {
  console.warn("\n  Pruebas SQL de cuotas SALTADAS: configura TEST_DATABASE_URL distinto de DATABASE_URL.\n");
}

describe.skipIf(!disponible)("cuotas móviles", () => {
  let mod: typeof import("./cuota");
  let sql: import("@neondatabase/serverless").NeonQueryFunction<false, false>;

  beforeAll(async () => {
    const { neon } = await import("@neondatabase/serverless");
    mod = await import("./cuota");
    sql = neon(process.env.DATABASE_URL!);
    const { initDatabase } = await import("./database");
    await initDatabase();
  });

  beforeEach(async () => {
    await sql`DELETE FROM cuota_usos`;
    await sql`DELETE FROM cuota_telefonos`;
  });

  afterAll(async () => {
    await sql`DELETE FROM cuota_usos`;
    await sql`DELETE FROM cuota_telefonos`;
  });

  it("permite dos análisis anónimos dentro de la ventana semanal y después pide teléfono", async () => {
    const uid = randomUUID();
    expect((await mod.consumirUso("diag", uid)).permitido).toBe(true);
    expect((await mod.consumirUso("diag", uid)).permitido).toBe(true);
    const bloqueado = await mod.consumirUso("diag", uid);
    expect(bloqueado.permitido).toBe(false);
    expect(bloqueado.requiereTelefono).toBe(true);
  });

  it("cuenta los análisis anónimos previos dentro de los seis semanales", async () => {
    const uid = randomUUID();
    await mod.consumirUso("diag", uid);
    await mod.consumirUso("diag", uid);
    const hash = mod.hashTelefonoCuota("+34600123456");
    await mod.vincularTelefonoCuota(uid, hash);

    for (let i = 0; i < 4; i++) expect((await mod.consumirUso("diag", uid)).permitido).toBe(true);
    const limite = await mod.consumirUso("diag", uid);
    expect(limite.permitido).toBe(false);
    expect(limite.requiereTelefono).toBe(false);
  });

  it("usa una ventana móvil: el consumo de hace ocho días ya no cuenta", async () => {
    const uid = randomUUID();
    for (let i = 0; i < 2; i++) {
      await sql`
        INSERT INTO cuota_usos (ambito, sujeto, visitor_id, creado_en)
        VALUES ('diag', ${`visitante:${uid}`}, ${uid}, NOW() - INTERVAL '8 days')
      `;
    }
    expect((await mod.consumirUso("diag", uid)).permitido).toBe(true);
  });

  it("no supera la cuota anónima con peticiones simultáneas", async () => {
    const uid = randomUUID();
    const resultados = await Promise.all(Array.from({ length: 20 }, () => mod.consumirUso("diag", uid)));
    expect(resultados.filter((resultado) => resultado.permitido)).toHaveLength(2);
  });

  it("aplica también un límite móvil por IP", async () => {
    const ip = "9.9.9.9";
    let permitidos = 0;
    for (let i = 0; i < 8; i++) {
      if ((await mod.consumirUsoPorClave("lead", ip, 5, 60 * 60 * 1000, ip)).permitido) permitidos++;
    }
    expect(permitidos).toBe(5);
  });

  it("bloquea por conexión (IP) aunque el visitante sea nuevo", async () => {
    const ip = "8.8.8.8";
    for (let i = 0; i < mod.LIMITES.ipDiag; i++) {
      await sql`
        INSERT INTO cuota_usos (ambito, sujeto, ip, creado_en)
        VALUES ('diag', ${`diag:ip:${ip}`}, ${ip}, NOW())
      `;
    }
    const r = await mod.consumirUso("diag", randomUUID(), ip);
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("red");
  });
});
