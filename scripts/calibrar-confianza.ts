import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

/**
 * Informe de calibración a partir de los diagnósticos reales guardados en BD.
 *
 * La confianza que devuelve el modelo no está calibrada: los umbrales de
 * route.ts (0.3/0.4/0.6/0.8) se fijaron a ojo. Este informe, SOLO LECTURA,
 * muestra cómo se comportan en la práctica:
 *
 * - distribución de la confianza por proveedor;
 * - % de `requiere_experto` en cada tramo de confianza;
 * - casos con feedback del usuario (el mejor termómetro de error disponible).
 *
 * No escribe nada en la base. Requiere DATABASE_URL.
 */

const TRAMOS = [
  { etiqueta: "0.0-0.4", min: 0, max: 0.4 },
  { etiqueta: "0.4-0.6", min: 0.4, max: 0.6 },
  { etiqueta: "0.6-0.8", min: 0.6, max: 0.8 },
  { etiqueta: "0.8-1.0", min: 0.8, max: 1.01 },
] as const;

interface Fila {
  proveedor: string | null;
  confianza: number | null;
  confianza_identificacion: number | null;
  tipo: string | null;
  requiere_experto: boolean | null;
  feedback_usuario: string | null;
  created_at: Date;
}

function pct(parte: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((parte / total) * 100)}%`;
}

function tramoDe(confianza: number | null): string | undefined {
  if (confianza === null || Number.isNaN(confianza)) return undefined;
  return TRAMOS.find((t) => confianza >= t.min && confianza < t.max)?.etiqueta;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL. No se ha consultado nada.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // Solo lectura: 180 días de historia basta para ver tendencias sin arrastrar
  // épocas en las que el prompt era otro.
  const filas = (await sql`
    SELECT proveedor,
           (diagnostico_json->'diagnostico'->>'confianza')::numeric AS confianza,
           (diagnostico_json->>'confianza_identificacion')::numeric AS confianza_identificacion,
           diagnostico_json->'diagnostico'->>'tipo' AS tipo,
           (diagnostico_json->>'requiere_experto')::boolean AS requiere_experto,
           feedback_usuario,
           created_at
    FROM diagnosticos
    WHERE created_at > now() - interval '180 days'
    ORDER BY created_at DESC
    LIMIT 5000
  `) as unknown as Fila[];

  if (filas.length === 0) {
    console.log("No hay diagnósticos en los últimos 180 días. Nada que calibrar todavía.");
    return;
  }

  const conConfianza = filas.filter((f) => f.confianza !== null);
  const conFeedback = filas.filter((f) => f.feedback_usuario && f.feedback_usuario.trim() !== "");

  const porProveedor = new Map<string, number>();
  for (const f of filas) {
    const clave = f.proveedor ?? "desconocido";
    porProveedor.set(clave, (porProveedor.get(clave) ?? 0) + 1);
  }

  const lineas: string[] = [
    "# Calibración de confianza (informe de solo lectura)",
    "",
    `Fecha: ${new Date().toISOString()}`,
    `Diagnósticos analizados: ${filas.length} (con confianza: ${conConfianza.length})`,
    `Con feedback del usuario: ${conFeedback.length}`,
    "",
    "## Por proveedor",
    "",
    ...[...porProveedor.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([proveedor, total]) => `- ${proveedor}: ${total} (${pct(total, filas.length)})`),
    "",
    "## Distribución de confianza y derivación a experto",
    "",
    "| Tramo | Casos | requiere_experto | % derivados |",
    "| --- | --- | --- | --- |",
    ...TRAMOS.map((t) => {
      const delTramo = conConfianza.filter((f) => tramoDe(f.confianza) === t.etiqueta);
      const derivados = delTramo.filter((f) => f.requiere_experto).length;
      return `| ${t.etiqueta} | ${delTramo.length} | ${derivados} | ${pct(derivados, delTramo.length)} |`;
    }),
    "",
    "Si un tramo alto (0.6-0.8, 0.8-1.0) deriva casi siempre, el umbral de 0.4 de",
    "route.ts no está haciendo trabajo real; si un tramo bajo apenas deriva, es",
    "demasiado optimista. Ajustar solo con estos datos, nunca a ojo.",
    "",
  ];

  if (conFeedback.length > 0) {
    lineas.push(
      "## Casos con feedback del usuario",
      "",
      ...conFeedback.slice(0, 50).map(
        (f) =>
          `- ${f.created_at.toISOString().slice(0, 10)} · ${f.tipo ?? "?"} · confianza ${f.confianza ?? "—"} · "${f.feedback_usuario?.trim().slice(0, 120)}"`
      ),
      ""
    );
  }

  const DIR_INFORMES = path.join(process.cwd(), "evaluacion", "informes");
  fs.mkdirSync(DIR_INFORMES, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  const ruta = path.join(DIR_INFORMES, `calibracion-${sello}.md`);
  fs.writeFileSync(ruta, lineas.join("\n"), "utf8");

  console.log(lineas.join("\n"));
  console.log(`\nInforme guardado en ${path.relative(process.cwd(), ruta)}`);
}

void main();
