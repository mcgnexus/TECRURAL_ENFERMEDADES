import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * El guard que impide que aplicarMigraciones() toque datos.
 *
 * Se prueba lanzándolo como proceso, porque lo que hay que garantizar es su
 * código de salida: si devuelve 0 cuando debería fallar, el build pasa y un
 * borrado llega a producción.
 *
 * Los casos están elegidos por lo que costó acertarlos: el guard falló en su
 * primera versión por dos motivos, y ambos se cubren aquí.
 */

const SCRIPT = path.resolve(process.cwd(), "scripts/comprobar-esquema-sin-borrados.mjs");
const DB_REAL = path.resolve(process.cwd(), "src/lib/database.ts");

let tmp: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "guard-esquema-"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Escribe un fixture con la forma de database.ts y devuelve su ruta. */
function fixture(nombre: string, inyeccion: string): string {
  const contenido = `async function getSql() { return null; }
function aplicarMigraciones(): Promise<void> {
  const db = getSql();
  return (async () => {
  await db\`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY,
      diagnostico_id UUID REFERENCES diagnosticos(id) ON DELETE SET NULL
    )
  \`;
${inyeccion}
  })();
}
export async function initDatabase() { return aplicarMigraciones(); }
`;
  const ruta = path.join(tmp, `${nombre}.ts`);
  fs.writeFileSync(ruta, contenido, "utf8");
  return ruta;
}

/** Ejecuta el guard y devuelve código de salida y salida combinada. */
function ejecutar(ruta: string): { codigo: number; salida: string } {
  try {
    const salida = execFileSync(process.execPath, [SCRIPT, ruta], { encoding: "utf8" });
    return { codigo: 0, salida };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { codigo: err.status ?? -1, salida: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("detecta operaciones destructivas", () => {
  const casos: [string, string, string][] = [
    ["DELETE", "  await db`DELETE FROM diagnosticos WHERE usuario_id = 'x'`;", "DELETE"],
    ["TRUNCATE", "  await db`TRUNCATE TABLE diagnosticos`;", "TRUNCATE"],
    ["DROP", "  await db`DROP TABLE diagnosticos`;", "DROP"],
    ["UPDATE", "  await db`UPDATE diagnosticos SET especie = 'x'`;", "UPDATE"],
  ];

  for (const [nombre, sql, palabra] of casos) {
    it(`falla con un ${nombre}`, () => {
      const { codigo, salida } = ejecutar(fixture(`detecta-${palabra}`, sql));
      expect(codigo).not.toBe(0);
      expect(salida).toContain(palabra);
    });
  }

  it("informa de la línea del problema", () => {
    const { salida } = ejecutar(fixture("linea", "  await db`DELETE FROM diagnosticos`;"));
    expect(salida).toMatch(/línea \d+/);
  });
});

describe("no da falsos positivos", () => {
  it("un DELETE dentro de un comentario no cuenta", () => {
    // Este caso es real: database.ts documenta en un comentario el DELETE que
    // hubo. Sin quitar los comentarios, el guard fallaba por su propia
    // documentación.
    const { codigo, salida } = ejecutar(
      fixture("comentario", "  // Aquí antes había un DELETE FROM diagnosticos")
    );
    expect(codigo).toBe(0);
    expect(salida).toContain("OK");
  });

  it("ON DELETE SET NULL es una acción referencial, no un borrado", () => {
    // También real: la clave foránea de leads lo lleva. Un chequeo ingenuo
    // fallaría aquí y el guard sería inservible.
    const { codigo } = ejecutar(fixture("on-delete", ""));
    expect(codigo).toBe(0);
  });

  it("ON UPDATE CASCADE tampoco cuenta", () => {
    const { codigo } = ejecutar(
      fixture(
        "on-update",
        "  await db`ALTER TABLE leads ADD COLUMN y UUID REFERENCES diagnosticos(id) ON UPDATE CASCADE`;"
      )
    );
    expect(codigo).toBe(0);
  });

  it("un CREATE TABLE normal pasa", () => {
    const { codigo } = ejecutar(
      fixture("crear", "  await db`CREATE TABLE IF NOT EXISTS t (id UUID PRIMARY KEY)`;")
    );
    expect(codigo).toBe(0);
  });
});

describe("contra el fichero real", () => {
  it("database.ts pasa la comprobación", () => {
    const { codigo, salida } = ejecutar(DB_REAL);
    expect(salida).toContain("OK: solo esquema");
    expect(codigo).toBe(0);
  });

  it("detecta la función aunque esté bien delimitada", () => {
    const { salida } = ejecutar(DB_REAL);
    expect(salida).toMatch(/cuerpo: \d+ líneas/);
  });

  it("si no encuentra la función, falla en vez de pasar en silencio", () => {
    // Una comprobación que no comprueba da falsa seguridad.
    const ruta = path.join(tmp, "sin-funcion.ts");
    fs.writeFileSync(ruta, "export const nada = 1;\n", "utf8");
    const { codigo, salida } = ejecutar(ruta);
    expect(codigo).not.toBe(0);
    expect(salida).toContain("No se pudo delimitar");
  });
});
