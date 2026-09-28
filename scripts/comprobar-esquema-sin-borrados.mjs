#!/usr/bin/env node
/**
 * Comprobación: la inicialización de la base de datos no puede tocar datos.
 *
 * POR QUÉ EXISTE
 *
 * `aplicarMigraciones()` llegó a incluir un `DELETE FROM diagnosticos ...`. Esa
 * función corre desde las peticiones, así que un borrado de datos dependía de
 * que alguien hiciera una petición, y se ejecutaba en el arranque en frío de
 * cada instancia. Se sacó de ahí, pero nada impedía que volviera a colarse.
 *
 * Esta comprobación lo impide. Se ejecuta sola antes de cada build (gancho
 * `prebuild` de package.json), así que si alguien mete una operación
 * destructiva en esa función, el build falla y el despliegue no sale.
 *
 * QUÉ SE CONSIDERA DESTRUCTIVO
 *
 * DELETE (borra filas), TRUNCATE (vacía tablas), DROP (elimina objetos) y
 * UPDATE (modifica filas). El UPDATE entra en la lista aunque no borre: una
 * modificación de datos en la inicialización se reejecuta en cada arranque, que
 * es exactamente el mismo problema.
 *
 * LAS DOS TRAMPAS
 *
 * 1. Los COMENTARIOS. Este mismo archivo explica en un comentario que antes
 *    había un DELETE. Sin quitarlos, la comprobación fallaría por su propia
 *    documentación.
 *
 * 2. Las ACCIONES REFERENCIALES. `ON DELETE SET NULL` en una clave foránea no
 *    es un borrado, es una regla del esquema. Y hay uno en la definición de la
 *    tabla leads. Se descartan antes de buscar.
 *
 * LÍMITE CONOCIDO
 *
 * Es un análisis por texto, no un intérprete de SQL. Detecta la reintroducción
 * accidental, que es el caso real; no detiene a alguien que quiera engañarlo a
 * propósito construyendo la sentencia en tiempo de ejecución.
 */

import fs from "node:fs";
import path from "node:path";

// La ruta se puede pasar como argumento, sobre todo para poder probar esta
// misma comprobación contra una copia modificada.
const RUTA = path.resolve(process.cwd(), process.argv[2] ?? "src/lib/database.ts");
const FUNCION = "aplicarMigraciones";

const PROHIBIDAS = [
  { clave: "DELETE", motivo: "borra filas" },
  { clave: "TRUNCATE", motivo: "vacía tablas" },
  { clave: "DROP", motivo: "elimina objetos del esquema" },
  { clave: "UPDATE", motivo: "modifica filas existentes" },
];

if (!fs.existsSync(RUTA)) {
  console.error(`No se encuentra ${RUTA}. ¿Se ha movido el archivo?`);
  process.exit(1);
}

const codigo = fs.readFileSync(RUTA, "utf8");

/**
 * Extrae el cuerpo de una función contando llaves solo en código, y saltando
 * comentarios, cadenas y plantillas. Sin esto, una llave suelta dentro de un
 * texto rompería el recuento y el cuerpo quedaría mal delimitado.
 */
function extraerCuerpo(src, nombre) {
  const inicioFn = src.indexOf(`function ${nombre}`);
  if (inicioFn === -1) return null;

  const inicio = src.indexOf("{", inicioFn);
  if (inicio === -1) return null;

  let profundidad = 0;
  let estado = "codigo";
  let cierreCadena = "";

  for (let i = inicio; i < src.length; i++) {
    const c = src[i];
    const siguiente = src[i + 1];

    if (estado === "linea") {
      if (c === "\n") estado = "codigo";
      continue;
    }
    if (estado === "bloque") {
      if (c === "*" && siguiente === "/") {
        estado = "codigo";
        i++;
      }
      continue;
    }
    if (estado === "cadena") {
      if (c === "\\") i++;
      else if (c === cierreCadena) estado = "codigo";
      continue;
    }
    if (estado === "plantilla") {
      if (c === "\\") i++;
      else if (c === "`") estado = "codigo";
      continue;
    }

    // estado === "codigo"
    if (c === "/" && siguiente === "/") {
      estado = "linea";
      i++;
    } else if (c === "/" && siguiente === "*") {
      estado = "bloque";
      i++;
    } else if (c === '"' || c === "'") {
      estado = "cadena";
      cierreCadena = c;
    } else if (c === "`") {
      estado = "plantilla";
    } else if (c === "{") {
      profundidad++;
    } else if (c === "}") {
      profundidad--;
      if (profundidad === 0) return { cuerpo: src.slice(inicio, i + 1), offset: inicio };
    }
  }

  return null; // nunca se cerró la llave
}

/**
 * Quita los comentarios conservando el resto del código. Mantiene el número de
 * líneas para poder informar de la línea exacta del problema.
 */
function sinComentarios(src) {
  let salida = "";
  let estado = "codigo";
  let cierreCadena = "";

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const siguiente = src[i + 1];

    if (estado === "linea") {
      if (c === "\n") {
        estado = "codigo";
        salida += c;
      } else {
        salida += " ";
      }
      continue;
    }
    if (estado === "bloque") {
      if (c === "*" && siguiente === "/") {
        estado = "codigo";
        salida += "  ";
        i++;
      } else {
        salida += c === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (estado === "cadena") {
      salida += c;
      if (c === "\\") {
        salida += siguiente ?? "";
        i++;
      } else if (c === cierreCadena) {
        estado = "codigo";
      }
      continue;
    }
    if (estado === "plantilla") {
      salida += c;
      if (c === "\\") {
        salida += siguiente ?? "";
        i++;
      } else if (c === "`") {
        estado = "codigo";
      }
      continue;
    }

    if (c === "/" && siguiente === "/") {
      estado = "linea";
      salida += "  ";
      i++;
    } else if (c === "/" && siguiente === "*") {
      estado = "bloque";
      salida += "  ";
      i++;
    } else if (c === '"' || c === "'") {
      estado = "cadena";
      cierreCadena = c;
      salida += c;
    } else if (c === "`") {
      estado = "plantilla";
      salida += c;
    } else {
      salida += c;
    }
  }
  return salida;
}

const extraido = extraerCuerpo(codigo, FUNCION);
if (!extraido) {
  // Si no se puede delimitar la función, no se puede comprobar. Fallar es lo
  // correcto: una comprobación que no comprueba da falsa seguridad.
  console.error(
    `No se pudo delimitar el cuerpo de ${FUNCION}() en ${RUTA}.\n` +
      `Si la función se ha renombrado o reformateado, actualiza este script.`
  );
  process.exit(1);
}

const { cuerpo, offset } = extraido;
const lineaInicial = codigo.slice(0, offset).split("\n").length;
const limpio = sinComentarios(cuerpo);

// Se descartan las acciones referenciales ANTES de buscar: `ON DELETE SET NULL`
// es una regla de la clave foránea, no un borrado.
const sinReferenciales = limpio
  .replace(/\bON\s+DELETE\b/gi, "          ")
  .replace(/\bON\s+UPDATE\b/gi, "          ");

const problemas = [];
for (const { clave, motivo } of PROHIBIDAS) {
  const re = new RegExp(`\\b${clave}\\b`, "g");
  let m;
  while ((m = re.exec(sinReferenciales)) !== null) {
    const linea = lineaInicial + sinReferenciales.slice(0, m.index).split("\n").length - 1;
    problemas.push({ clave, motivo, linea });
  }
}

console.log(`Comprobando ${FUNCION}() en src/lib/database.ts`);
console.log(`  cuerpo: ${cuerpo.split("\n").length} líneas (desde la ${lineaInicial})`);
console.log(`  operaciones destructivas prohibidas: ${PROHIBIDAS.map((p) => p.clave).join(", ")}`);

if (problemas.length > 0) {
  console.error(`\nFALLO: ${FUNCION}() contiene operaciones sobre datos.\n`);
  for (const p of problemas) {
    console.error(`  línea ${p.linea}: ${p.clave} — ${p.motivo}`);
  }
  console.error(
    `\n${FUNCION}() corre desde las peticiones y en el arranque en frío de cada\n` +
      `instancia. Solo puede crear y alterar esquema. Una operación sobre datos\n` +
      `que deba hacerse una vez va en db/one-off/, con previsualización y\n` +
      `confirmación explícita.`
  );
  process.exit(1);
}

console.log("  OK: solo esquema, ninguna operación sobre datos.");
