import type {
  ContextoDiagnosticoLead,
  PrioridadLead,
} from "@/types/lead";

/**
 * Cualificación de leads.
 *
 * El objetivo del negocio no es el número bruto de formularios, sino el coste
 * por lead cualificado. Esta puntuación ordena los contactos para que TecRural
 * atienda primero los casos con mayor probabilidad de convertirse en servicio:
 * - Problemas confirmados con gravedad alta o revisión experta recomendada.
 * - Explotaciones con superficie relevante (umbral ajustable abajo).
 *
 * La puntuación se calcula SIEMPRE en el servidor a partir del contexto del
 * diagnóstico guardado y de los datos del formulario; el cliente no puede
 * enviar una prioridad impuesta.
 *
 * Umbrales (hectáreas, cortes de puntuación): decisiones de producto
 * documentadas, ajustables aquí sin tocar el resto del flujo.
 */

const PESOS = {
  gravedad_severa: 4,
  gravedad_moderada: 1,
  requiere_experto: 2,
  problema_confirmado: 1,
  hectareas_grandes: 2,
  hectareas_medianas: 1,
} as const;

const UMBRAL_HECTAREAS_GRANDES = 2;
const UMBRAL_HECTAREAS_MEDIANAS = 0.5;

const CORTE_ALTA = 4;
const CORTE_MEDIA = 2;

export function calcularPrioridadLead(
  contexto: ContextoDiagnosticoLead | undefined,
  hectareas?: number
): { prioridad: PrioridadLead; puntuacion: number } {
  let puntuacion = 0;

  if (contexto) {
    if (contexto.gravedad === "severa") puntuacion += PESOS.gravedad_severa;
    else if (contexto.gravedad === "moderada") puntuacion += PESOS.gravedad_moderada;

    if (contexto.requiere_experto) puntuacion += PESOS.requiere_experto;

    if (contexto.tipo && contexto.tipo !== "sano") {
      puntuacion += PESOS.problema_confirmado;
    }
  }

  if (typeof hectareas === "number" && Number.isFinite(hectareas) && hectareas > 0) {
    if (hectareas >= UMBRAL_HECTAREAS_GRANDES) puntuacion += PESOS.hectareas_grandes;
    else if (hectareas >= UMBRAL_HECTAREAS_MEDIANAS) puntuacion += PESOS.hectareas_medianas;
  }

  const prioridad: PrioridadLead =
    puntuacion >= CORTE_ALTA ? "alta" : puntuacion >= CORTE_MEDIA ? "media" : "baja";

  return { prioridad, puntuacion };
}

/** Decide si tras un diagnóstico conviene ofrecer el siguiente paso comercial. */
export function debeOfrecerRevision(ctx: ContextoDiagnosticoLead): boolean {
  if (ctx.requiere_experto) return true;
  if (ctx.gravedad === "severa") return true;
  if (ctx.gravedad === "moderada" && ctx.tipo && ctx.tipo !== "sano") return true;
  return false;
}
