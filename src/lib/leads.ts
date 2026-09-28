import type {
  ContextoDiagnosticoLead,
  OrigenLead,
  PrioridadLead,
} from "@/types/lead";

/**
 * Cualificación de leads.
 *
 * El objetivo del negocio no es el número bruto de formularios, sino el coste
 * por lead cualificado. Esta puntuación ordena los contactos para que TecRural
 * atienda primero los casos con mayor probabilidad de convertirse en servicio.
 *
 * Se puntúan dos cosas distintas y conviene no confundirlas:
 * - Gravedad del problema (severidad, requiere_experto, problema confirmado):
 *   viene del diagnóstico y describe cómo de urgente es el caso.
 * - Intención del contacto (origen): describe cuánto se ha implicado la
 *   persona. Quien va directamente a la página de contacto y deja su teléfono
 *   ya ha hecho el esfuerzo que en el otro flujo pide una foto y 15 segundos de
 *   espera, así que no puede quedarse en "baja" por falta de diagnóstico.
 *
 * La puntuación se calcula SIEMPRE en el servidor a partir del contexto del
 * diagnóstico guardado y del propio envío; el cliente no puede enviar una
 * prioridad impuesta.
 *
 * Umbrales: decisiones de producto documentadas, ajustables aquí sin tocar el
 * resto del flujo.
 */

const PESOS = {
  gravedad_severa: 4,
  gravedad_moderada: 1,
  requiere_experto: 2,
  problema_confirmado: 1,
  origen_contacto_directo: 3,
} as const;

const CORTE_ALTA = 4;
const CORTE_MEDIA = 2;

export function calcularPrioridadLead(
  contexto: ContextoDiagnosticoLead | undefined,
  origen: OrigenLead | undefined
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

  // Nota: la superficie en hectáreas se guarda en el lead pero NO puntúa. El
  // usuario objetivo es el pequeño agricultor, que rara vez conoce su
  // superficie exacta en ha, así que exigirla solo genera campos vacíos o
  // inventados. La escala del negocio se captura con la gravedad.
  if (origen === "contacto_directo") {
    puntuacion += PESOS.origen_contacto_directo;
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
