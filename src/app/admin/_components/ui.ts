import type { EstadoLead } from "@/types/lead";

/**
 * Constantes visuales y utilidades de formato compartidas por el panel.
 *
 * Se centralizan aquí para que las pestañas y los gráficos usen exactamente los
 * mismos colores, etiquetas y clases que el resto de la aplicación (tokens de
 * `globals.css`), sin duplicarlos.
 */

export const btnBase =
  "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold transition-all duration-200 ";
export const btnPrimary = `${btnBase} bg-tr-green-strong text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
export const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
export const btnDanger = `${btnBase} bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
export const btnMini =
  "inline-flex items-center justify-center px-2.5 py-1.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-surface text-tr-ink text-caption font-semibold hover:bg-tr-paper disabled:opacity-50 disabled:cursor-not-allowed";

export const cardStyles =
  "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";
export const inputCls =
  "w-full px-3 py-2.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink font-body text-body focus:border-tr-brand-green ";
export const inputMini =
  "w-full px-2.5 py-2 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink text-small focus:border-tr-brand-green ";

export const ESTADO_LABELS: Record<EstadoLead, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  cualificado: "Cualificado",
  presupuesto: "Presupuesto",
  ganado: "Ganado",
  perdido: "Perdido",
};

export const ESTADO_COLORES: Record<EstadoLead, string> = {
  nuevo: "text-tr-cyan-text",
  contactado: "text-tr-warning-text",
  cualificado: "text-tr-green-strong",
  presupuesto: "text-tr-forest",
  ganado: "text-green-700",
  perdido: "text-red-600",
};

/**
 * Paleta para los gráficos. Recharts necesita colores en cadena, así que se
 * repiten aquí los valores de los tokens de marca (un único punto de verdad
 * para el panel).
 */
export const COLOR = {
  forest: "#164B3B",
  brandGreen: "#208C46",
  greenStrong: "#177A44",
  leaf: "#54834C",
  lime: "#D7E6A1",
  cyan: "#02B2EB",
  cyanText: "#006989",
  warning: "#D69D52",
  warningText: "#8A5A1E",
  muted: "#56655B",
  line: "#E3E8DE",
  ink: "#1D2B25",
  ganado: "#15803d",
  perdido: "#dc2626",
} as const;

/** Color de cada estado comercial, para el donut y las barras. */
export const COLOR_ESTADO: Record<EstadoLead, string> = {
  nuevo: COLOR.cyan,
  contactado: COLOR.warning,
  cualificado: COLOR.greenStrong,
  presupuesto: COLOR.forest,
  ganado: COLOR.ganado,
  perdido: COLOR.perdido,
};

export const COLOR_PRIORIDAD = {
  alta: COLOR.perdido,
  media: COLOR.warning,
  baja: COLOR.leaf,
} as const;

export function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCorto(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fecha corta `dd/mm` a partir de un día `YYYY-MM-DD`, para ejes de gráficos. */
export function formatDia(dia: string): string {
  const [, mes, d] = dia.split("-");
  return `${d}/${mes}`;
}

export function pct(valor: number | null): string {
  return valor === null ? "—" : `${(valor * 100).toFixed(1)} %`;
}

export function horasLegibles(horas: number | null): string {
  if (horas === null) return "—";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} días`;
}

export function formatNumero(valor: number): string {
  return valor.toLocaleString("es-ES");
}

/** Etiquetas humanas de cada paso del embudo. */
export const ETIQUETAS_EMBUDO: Record<string, string> = {
  portada_vista: "Llegan a la portada",
  captura_realizada: "Cargan una foto",
  analisis_iniciado: "Pulsan analizar",
  analisis_completado: "Reciben el análisis",
  resultado_visto: "Ven el resultado",
  cta_revision_abierto: "Abren el formulario",
  lead_enviado: "Envían el contacto",
};

export const ETIQUETAS_EVENTO: Record<string, string> = {
  portada_vista: "Portada",
  captura_realizada: "Foto",
  analisis_iniciado: "Analizar",
  analisis_completado: "Análisis",
  analisis_error: "Error",
  resultado_visto: "Resultado",
  cta_revision_abierto: "Formulario",
  lead_enviado: "Contacto",
  lead_error: "Error contacto",
  whatsapp_click: "WhatsApp",
};

export const ETIQUETAS_ORIGEN: Record<string, string> = {
  post_diagnostico: "Tras diagnóstico",
  contacto_directo: "Contacto directo",
};

export const ETIQUETAS_CANAL: Record<string, string> = {
  whatsapp: "WhatsApp",
  llamada: "Llamada",
};

export function etiquetaCanal(canal: string | null): string {
  if (!canal) return "—";
  return ETIQUETAS_CANAL[canal] ?? canal;
}
