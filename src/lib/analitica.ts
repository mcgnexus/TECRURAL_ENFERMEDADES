/**
 * Analítica de conversión en el cliente.
 *
 * Reenvía eventos a gtag (GA4) si está instalado (ver NEXT_PUBLIC_GA_ID en
 * layout.tsx) y guarda además un buffer local en localStorage para depuración
 * sin dependencias externas.
 *
 * Eventos del embudo (métrica principal: coste por lead cualificado):
 * - captura_realizada: el usuario obtuvo/cargó una foto
 * - analisis_iniciado / analisis_completado / analisis_error
 * - resultado_visto: con gravedad y si requiere experto (cualidad del lead)
 * - cta_revision_abierto: abrió el formulario de contacto tras diagnóstico
 * - lead_enviado / lead_error: formulario enviado
 * - whatsapp_click: contacto por WhatsApp
 */

export type NombreEvento =
  | "captura_realizada"
  | "analisis_iniciado"
  | "analisis_completado"
  | "analisis_error"
  | "resultado_visto"
  | "cta_revision_abierto"
  | "lead_enviado"
  | "lead_error"
  | "whatsapp_click";

const CLAVE_BUFFER = "tr-eventos";

interface GtagWindow {
  gtag?: (...args: unknown[]) => void;
}

export function trackEvento(nombre: NombreEvento, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;

  try {
    const w = window as unknown as GtagWindow;
    if (typeof w.gtag === "function") {
      w.gtag("event", nombre, params);
    }

    const buffer = JSON.parse(localStorage.getItem(CLAVE_BUFFER) || "[]");
    buffer.push({ nombre, params, t: Date.now() });
    localStorage.setItem(CLAVE_BUFFER, JSON.stringify(buffer.slice(-100)));
  } catch {
    // La analítica nunca debe romper el flujo del usuario
  }
}
