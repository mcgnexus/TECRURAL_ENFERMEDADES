/**
 * Datos de contacto de TecRural.
 *
 * El número de WhatsApp NO está hardcodeado: se toma de la variable de entorno
 * NEXT_PUBLIC_TECRURAL_WHATSAPP (formato internacional, solo dígitos, ej:
 * "34600111222"). Si no está configurada, la función de WhatsApp se oculta y
 * el formulario de leads sigue siendo el canal principal.
 */

function limpiarNumero(valor: string | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

export const WHATSAPP_NUMERO = limpiarNumero(process.env.NEXT_PUBLIC_TECRURAL_WHATSAPP);

export const whatsappDisponible = WHATSAPP_NUMERO.length >= 8;

export function urlWhatsApp(mensaje?: string): string {
  if (!whatsappDisponible) return "#";
  const base = `https://wa.me/${WHATSAPP_NUMERO}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
