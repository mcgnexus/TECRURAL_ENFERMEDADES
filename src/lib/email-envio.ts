/**
 * Entrega del enlace de recuperación del informe por Resend.
 *
 * Decisiones que no se pueden cambiar sin revisar la política de privacidad:
 *
 * - El correo solo lleva un enlace. Nunca el contenido clínico del informe:
 *   ni patología, ni materia activa, ni dosis. El buzón no debe acumular datos
 *   agronómicos.
 * - Solo se considera aceptado cuando Resend responde 2xx y devuelve un `id`.
 *   Un 202 sin id, un 4xx o un timeout son fallos: la pantalla debe seguir
 *   ofreciendo el informe y un reintento.
 * - No se registra el destinatario en logs. La política del repositorio es no
 *   sacar datos personales a los registros.
 * - La clave de idempotencia incluye el intento para que un reintento real
 *   vuelva a enviar, pero dos peticiones del mismo intento no dupliquen correo.
 */

const ENDPOINT = "https://api.resend.com/emails";
const SITIO_POR_DEFECTO = "https://diagnostico.tecrural.es";
const ESPERA_MS = 10_000;

export function envioInformeHabilitado(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim()
  );
}

export function urlInforme(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || SITIO_POR_DEFECTO).replace(
    /\/+$/,
    ""
  );
  return `${base}/informe/${encodeURIComponent(token)}`;
}

export interface CorreoInforme {
  asunto: string;
  texto: string;
  html: string;
  url: string;
}

/**
 * Contenido neutro del correo. Es una función pura y exportada para poder
 * comprobar en una prueba que no contiene ni el diagnóstico ni la dosis.
 */
export function construirCorreoInforme(token: string): CorreoInforme {
  const url = urlInforme(token);
  const asunto = "Tu informe de TecRural está listo — enlace válido 90 días";
  const texto = [
    "Hola:",
    "",
    "El informe que pediste en TecRural ya está disponible.",
    "Puedes abrirlo desde este enlace, válido durante 90 días:",
    url,
    "",
    "El enlace es personal: cualquiera que lo tenga puede abrir el informe.",
    "Si no solicitaste este informe, puedes ignorar este mensaje.",
    "",
    "TecRural · Orientación agronómica",
  ].join("\n");

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2a22;line-height:1.6;max-width:560px">',
    "<p>Hola:</p>",
    "<p>El informe que pediste en TecRural ya está disponible. Puedes abrirlo desde este enlace, válido durante 90 días:</p>",
    `<p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#2f6b3a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold">Abrir el informe</a></p>`,
    `<p style="font-size:13px;color:#5b6b5e">Si el botón no funciona, copia esta dirección:<br>${url}</p>`,
    '<p style="font-size:13px;color:#5b6b5e">El enlace es personal: cualquiera que lo tenga puede abrir el informe. Si no solicitaste este informe, puedes ignorar este mensaje.</p>',
    "<p>TecRural · Orientación agronómica</p>",
    "</div>",
  ].join("");

  return { asunto, texto, html, url };
}

export type ResultadoEnvioInforme =
  | { aceptado: true; id: string }
  | { aceptado: false; motivo: string };

export interface DatosEnvioInforme {
  to: string;
  token: string;
  /** Identificador del diagnóstico e intento, solo para la clave de idempotencia. */
  diagnosticoId?: string;
  intento?: number;
}

export async function enviarEnlaceInforme({
  to,
  token,
  diagnosticoId,
  intento,
}: DatosEnvioInforme): Promise<ResultadoEnvioInforme> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) return { aceptado: false, motivo: "no_configurado" };

  const correo = construirCorreoInforme(token);
  const idempotencia =
    diagnosticoId && intento !== undefined
      ? `${diagnosticoId}:${intento}`
      : `informe:${token}`;

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencia,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: correo.asunto,
        text: correo.texto,
        html: correo.html,
        ...(process.env.RESEND_REPLY_TO?.trim()
          ? { reply_to: process.env.RESEND_REPLY_TO.trim() }
          : {}),
      }),
      signal: AbortSignal.timeout(ESPERA_MS),
    });
  } catch {
    return { aceptado: false, motivo: "red" };
  }

  const datos = (await response.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof datos?.id === "string" ? datos.id : "";

  if (response.status >= 200 && response.status < 300 && id) {
    return { aceptado: true, id };
  }

  // Sin destinatario ni cuerpo en el log: solo el estado técnico.
  console.warn("Resend no aceptó el envío del informe:", response.status);
  return { aceptado: false, motivo: `resend_${response.status}` };
}
