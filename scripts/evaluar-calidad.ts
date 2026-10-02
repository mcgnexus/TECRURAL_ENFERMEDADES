import fs from "node:fs";
import path from "node:path";
import type { ImagenAnalisis } from "../src/lib/gemini";

/**
 * Evaluación agronómica reproducible.
 *
 * Por defecto NO llama a ningún proveedor: valida los casos y muestra qué se
 * ejecutaría. Con --ejecutar lanza el pipeline sobre cada caso con imagen y
 * escribe un informe Markdown en evaluacion/informes/ para revisión humana.
 *
 * Objetivo: medir desacuerdos con el criterio del técnico por cultivo y tipo de
 * síntoma, no "aprobar" la IA. Las imágenes deben ser propias o con autorización.
 */

interface Caso {
  id: string;
  cultivo?: string;
  sintoma?: string;
  contexto?: { municipio?: string; duracion?: string; variedad?: string };
  imagenes: string[];
  esperado?: {
    tipo?: "enfermedad" | "deficiencia_nutricional" | "plaga" | "sano";
    categoriaAceptable?: string[];
    requiereExperto?: boolean;
    nota?: string;
  };
  esValidoParaEvaluar?: boolean;
}

const RAIZ = process.cwd();
const RUTA_CASOS = path.join(RAIZ, "evaluacion", "casos.json");
const DIR_INFORMES = path.join(RAIZ, "evaluacion", "informes");
const ejecutar = process.argv.includes("--ejecutar");
const proveedor = process.argv.includes("--deepseek") ? "deepseek" : "gemini";

function mimeDe(ruta: string): string {
  const ext = path.extname(ruta).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function cargarCaso(caso: Caso): ImagenAnalisis[] {
  return caso.imagenes.map((rel) => {
    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs)) throw new Error(`No existe la imagen ${rel}`);
    return { base64: fs.readFileSync(abs).toString("base64"), mimeType: mimeDe(abs) };
  });
}

function acierta(
  caso: Caso,
  respuesta: { diagnostico: { tipo: string; nombre: string }; requiere_experto?: boolean },
): boolean {
  const esperado = caso.esperado;
  if (!esperado) return false;
  if (esperado.tipo && respuesta.diagnostico.tipo !== esperado.tipo) return false;
  if (esperado.categoriaAceptable?.length) {
    const nombre = respuesta.diagnostico.nombre.toLowerCase();
    if (!esperado.categoriaAceptable.some((c) => nombre.includes(c.toLowerCase()))) return false;
  }
  if (esperado.requiereExperto !== undefined && Boolean(respuesta.requiere_experto) !== esperado.requiereExperto) {
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  const crudo = JSON.parse(fs.readFileSync(RUTA_CASOS, "utf8")) as { casos: Caso[] };
  const casos = crudo.casos ?? [];
  const evaluables = casos.filter((c) => c.esValidoParaEvaluar !== false);

  console.log(`Casos totales: ${casos.length}. Evaluables: ${evaluables.length}.`);
  console.log(`Proveedor: ${proveedor}. Modo: ${ejecutar ? "EJECUCIÓN REAL" : "simulación (usa --ejecutar)"}.`);

  for (const caso of casos) {
    const imagenesOk = caso.imagenes.every((rel) => fs.existsSync(path.join(RAIZ, rel)));
    console.log(`  ${caso.esValidoParaEvaluar === false ? "[marcador]" : "[evaluable]"} ${caso.id} — imágenes ${imagenesOk ? "ok" : "FALTAN"}`);
  }

  if (!ejecutar) {
    console.log("\nNo se ha llamado a ningún proveedor. Añade --ejecutar para lanzar la evaluación.");
    return;
  }

  if (evaluables.some((c) => c.imagenes.some((rel) => !fs.existsSync(path.join(RAIZ, rel))))) {
    console.error("\nHay casos evaluables sin imagen. Complétalos antes de ejecutar.");
    process.exit(1);
  }

  const resultados: string[] = [];
  let aciertos = 0;

  // Los proveedores se cargan solo en modo ejecución: en simulación evita exigir
  // claves de API y mantiene el script sin dependencias externas.
  const { analizarConReintento } = await import("../src/lib/gemini");
  const { analizarConReintentoDeepSeek } = await import("../src/lib/deepseek");

  for (const caso of evaluables) {
    const imagenes = cargarCaso(caso);
    const contexto = {
      cultivo: caso.cultivo,
      municipio: caso.contexto?.municipio,
      sintoma: caso.sintoma,
      duracion: caso.contexto?.duracion,
      variedad: caso.contexto?.variedad,
    };
    try {
      const respuesta =
        proveedor === "deepseek"
          ? await analizarConReintentoDeepSeek(imagenes, contexto)
          : await analizarConReintento(imagenes, contexto);
      const ok = acierta(caso, respuesta);
      if (ok) aciertos++;
      resultados.push(
        [
          `## ${caso.id} — ${ok ? "acuerdo" : "DESACUERDO"}`,
          `- Cultivo: ${caso.cultivo ?? "—"} · Síntoma: ${caso.sintoma ?? "—"}`,
          `- Esperado: ${JSON.stringify(caso.esperado ?? {})}`,
          `- Obtenido: tipo=${respuesta.diagnostico.tipo} nombre="${respuesta.diagnostico.nombre}" requiere_experto=${respuesta.requiere_experto}`,
          `- Confianza: ${respuesta.diagnostico.confianza} · Identificación: ${respuesta.confianza_identificacion}`,
          "",
        ].join("\n"),
      );
    } catch (error) {
      resultados.push(`## ${caso.id} — ERROR\n- ${error instanceof Error ? error.message : "error"}\n`);
    }
  }

  fs.mkdirSync(DIR_INFORMES, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  const ruta = path.join(DIR_INFORMES, `informe-${proveedor}-${sello}.md`);
  const cabecera = `# Evaluación agronómica (${proveedor})\n\nFecha: ${new Date().toISOString()}\nCasos evaluables: ${evaluables.length}\nAcuerdos: ${aciertos}/${evaluables.length}\n\n`;
  fs.writeFileSync(ruta, cabecera + resultados.join("\n"), "utf8");
  console.log(`\nAcuerdos: ${aciertos}/${evaluables.length}. Informe: ${path.relative(RAIZ, ruta)}`);
}

void main();
