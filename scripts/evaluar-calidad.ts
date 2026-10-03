import fs from "node:fs";
import path from "node:path";
import type { ImagenAnalisis } from "../src/lib/gemini";
import {
  acierta,
  resumirEvaluacion,
  resultadoDe,
  type CasoEvaluable,
  type ResultadoCaso,
} from "../src/lib/evaluacion";

/**
 * Evaluación agronómica reproducible.
 *
 * Por defecto NO llama a ningún proveedor: valida los casos y muestra qué se
 * ejecutaría. Con --ejecutar lanza el pipeline sobre cada caso con imagen y
 * escribe un informe Markdown en evaluacion/informes/ para revisión humana.
 *
 * Objetivo: medir desacuerdos con el criterio del técnico por cultivo y tipo de
 * síntoma, no "aprobar" la IA. Las imágenes deben ser propias o con autorización.
 *
 * El informe incluye, además del acuerdo global: desglose por cultivo y por
 * tipo esperado, tramos de confianza (¿los casos con más confianza aciertan
 * más?) y el balance de requiere_experto (falsos positivos y negativos).
 */

interface Caso extends CasoEvaluable {
  contexto?: { municipio?: string; duracion?: string; variedad?: string };
  imagenes: string[];
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

function pct(parte: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((parte / total) * 100)}%`;
}

function lineaGrupo(grupos: { clave: string; total: number; acuerdos: number }[]): string {
  return grupos
    .map((g) => `| ${g.clave} | ${g.acuerdos}/${g.total} (${pct(g.acuerdos, g.total)}) |`)
    .join("\n");
}

function seccionResumen(resultados: ResultadoCaso[]): string {
  const resumen = resumirEvaluacion(resultados);
  const exp = resumen.requiereExperto;
  return [
    `Acuerdos globales: ${resumen.acuerdos}/${resumen.total} (${pct(resumen.acuerdos, resumen.total)})`,
    "",
    "### Por cultivo",
    "| Cultivo | Acuerdos |",
    "| --- | --- |",
    lineaGrupo(resumen.porCultivo),
    "",
    "### Por tipo esperado",
    "| Tipo | Acuerdos |",
    "| --- | --- |",
    lineaGrupo(resumen.porTipoEsperado),
    "",
    "### Calibración de la confianza",
    "| Tramo | Acuerdos |",
    "| --- | --- |",
    resumen.calibracion
      .map((t) => `| ${t.tramo} | ${t.acuerdos}/${t.casos} (${pct(t.acuerdos, t.casos)}) |`)
      .join("\n"),
    "",
    "### Balance de requiere_experto",
    `Verdaderos positivos: ${exp.tp} · Verdaderos negativos: ${exp.tn} · Falsos positivos (deriva sin necesidad): ${exp.fp} · Falsos negativos (pasa por alto un caso grave): ${exp.fn}`,
    "",
  ].join("\n");
}

function seccionCasos(resultados: ResultadoCaso[]): string {
  return resultados
    .map((r) => {
      if (r.error) {
        return `## ${r.casoId} — ERROR\n- ${r.error}\n`;
      }
      return [
        `## ${r.casoId} — ${r.acuerdo ? "acuerdo" : "DESACUERDO"}`,
        `- Cultivo: ${r.cultivo || "—"} · Síntoma: ${r.sintoma || "—"}`,
        `- Esperado: tipo=${r.tipoEsperado ?? "—"} requiere_experto=${r.requiereEsperado ?? "—"}`,
        `- Obtenido: tipo=${r.tipoObtenido} nombre="${r.nombreObtenido}" requiere_experto=${r.requiereObtenido}`,
        `- Confianza: ${r.confianza ?? "—"}`,
        "",
      ].join("\n");
    })
    .join("\n");
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

  const resultados: ResultadoCaso[] = [];

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
      resultados.push(resultadoDe(caso, respuesta));
    } catch (error) {
      resultados.push(resultadoDe(caso, undefined, error instanceof Error ? error.message : "error"));
    }
  }

  fs.mkdirSync(DIR_INFORMES, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  const ruta = path.join(DIR_INFORMES, `informe-${proveedor}-${sello}.md`);
  const cabecera = [
    `# Evaluación agronómica (${proveedor})`,
    "",
    `Fecha: ${new Date().toISOString()}`,
    `Casos evaluables: ${evaluables.length}`,
    "",
    seccionResumen(resultados),
    "---",
    "",
  ].join("\n");
  fs.writeFileSync(ruta, cabecera + seccionCasos(resultados), "utf8");

  const resumen = resumirEvaluacion(resultados);
  console.log(`\nAcuerdos: ${resumen.acuerdos}/${resumen.total}. Informe: ${path.relative(RAIZ, ruta)}`);
}

void main();
