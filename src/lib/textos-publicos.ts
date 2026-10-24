/**
 * Textos críticos compartidos entre la portada, el resultado y el formulario.
 *
 * Están aquí por el mismo motivo que `textos-lead.ts`: son promesas que se
 * repiten en varias pantallas (límite de análisis, propósito del correo,
 * revisión técnica) y se contradijeron entre sí. Centralizadas y puras, se
 * pueden comprobar con una prueba y no se les puede escapar una palabra de
 * jerga o un compromiso que el servicio no puede cumplir.
 */

/** Límite gratuito que se muestra antes de subir la foto. */
export const LIMITE_GRATIS = "1 análisis gratis cada 7 días";

/** Límite tras vincular un contacto (correo o teléfono). */
export const LIMITE_AMPLIADO = "6 análisis cada 7 días";

/** Sin cuenta: el primer análisis no pide registro. */
export const SIN_REGISTRO = "sin registro";

/**
 * Propósito del correo en el informe: el informe se abre en pantalla y, si la
 * entrega está configurada, se envía un enlace de recuperación. La redacción es
 * condicional porque sin RESEND_API_KEY no existe envío y prometerlo sería falso.
 */
export const PROPOSITO_CORREO =
  "El informe se abre aquí mismo, en esta pantalla. Si el envío por correo está disponible, te enviamos además un enlace para recuperarlo; no te adjuntamos el informe ni usamos el correo para publicidad.";

/** Compromiso de la revisión técnica: opcional, sin coste, 48 horas máximo. */
export const REVISION_TECNICA =
  "La revisión de un técnico es opcional y no tiene coste: si la pides, responde en un máximo de 48 horas por el canal que elijas.";

/** Tiempo orientativo del análisis, tal como lo garantiza la operación actual. */
export const TIEMPO_ANALISIS = "Suele tardar 10-20 segundos";

/** Identidad visible del servicio. */
export const IDENTIDAD = {
  responsable: "Manuel Carrasco García",
  ubicacion: "Huéscar (Granada)",
  correo: "mcgnexus@gmail.com",
};

/** Límites honestos que se muestran en el bloque de confianza. */
export const LIMITES_HONESTOS =
  "No te llamamos para vender, no compartimos tu foto salvo que pidas revisión y, si la foto no basta, te lo decimos.";
