import { createHmac } from "node:crypto";
import type { LeadFila, MetricasCaptacion } from "@/types/lead";

/**
 * Aviso inmediato al técnico cuando entra un lead.
 *
 * Sin esto el lead solo existe en la tabla y hay que acordarse de abrir
 * /admin. Para captación comercial eso significa perder la mayoría de las
 * oportunidades: el interés del agricultor decae en horas, no en días.
 *
 * Hay dos destinos, ambos por configuración y sin tocar código:
 *
 * - Telegram (preferido). Es el canal que el técnico mira con el móvil, así
 *   que un lead que llega al Telegram se atiende en segundos. Envía un
 *   mensaje con el resumen y un botón al panel.
 * - Webhook genérico. Para cuando el destino sea la API de WhatsApp Business,
 *   n8n/Make/Zapier o un endpoint propio: recibe el payload completo en JSON.
 *
 * Reglas:
 * - Nunca bloquea ni falla el envío del lead. El lead ya está guardado; que el
 *   aviso falle solo significa que no hay notificación.
 * - Timeout corto (4 s) y un reintento. El usuario está viendo un spinner.
 * - Si no hay nada configurado, no se hace nada.
 */

const TIMEOUT_MS = 4000;
const MAX_INTENTOS = 2;
const ESPERA_REINTENTO_MS = 800;

export function webhookConfigurado(): boolean {
  return Boolean(process.env.LEAD_WEBHOOK_URL);
}

export function telegramConfigurado(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
  );
}

function firmarCuerpo(cuerpo: string): string | null {
  const secreto = process.env.LEAD_WEBHOOK_SECRET;
  if (!secreto) return null;
  return createHmac("sha256", secreto).update(cuerpo).digest("hex");
}

interface PayloadNotificacion {
  evento: "lead_nuevo";
  id: string;
  prioridad: PrioridadLead;
  puntuacion: number;
  estado: string;
  origen: string;
  nombre: string;
  telefono: string;
  municipio: string | null;
  cultivo: string | null;
  sintoma: string | null;
  mensaje: string | null;
  fotos: number;
  gravedad?: string;
  especie?: string;
  requiere_experto?: boolean;
  campaña: string | null;
  utm_source: string | null;
  url_admin: string;
  recibido_en: string;
}

type PrioridadLead = "alta" | "media" | "baja";

function urlBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://tecrural-diagnostico.vercel.app";
}

function construirPayload(lead: LeadFila): PayloadNotificacion {
  const ctx = lead.contexto_diagnostico ?? undefined;

  return {
    evento: "lead_nuevo",
    id: lead.id,
    prioridad: lead.prioridad,
    puntuacion: lead.puntuacion,
    estado: lead.estado,
    origen: lead.origen,
    nombre: lead.nombre,
    telefono: lead.telefono,
    municipio: lead.municipio,
    cultivo: lead.cultivo,
    sintoma: lead.sintoma,
    mensaje: lead.mensaje,
    fotos: lead.num_imagenes,
    gravedad: ctx?.gravedad,
    especie: ctx?.especie,
    requiere_experto: ctx?.requiere_experto,
    campaña: lead.utm_campaign ?? lead.origen_campana,
    utm_source: lead.utm_source,
    url_admin: `${urlBase()}/admin`,
    recibido_en: new Date().toISOString(),
  };
}

/** Resumen de una línea, para destinos que solo aceptan texto. */
function resumenTexto(p: PayloadNotificacion): string {
  const donde = [p.municipio, p.cultivo]
    .filter((v): v is string => Boolean(v))
    .join(" · ");
  const caso = p.sintoma ?? p.mensaje ?? "sin descripción";
  return (
    `Lead ${p.prioridad.toUpperCase()} (${p.puntuacion} pts)\n` +
    `${p.nombre} · ${p.telefono}\n` +
    (donde ? `${donde}\n` : "") +
    `${caso}\n` +
    (p.origen === "post_diagnostico" && p.especie
      ? `Diagnóstico: ${p.especie}${p.gravedad ? ` (${p.gravedad})` : ""}\n`
      : "") +
    (p.fotos > 0 ? `Fotos adjuntas: ${p.fotos}\n` : "") +
    p.url_admin
  );
}

// ---------------------------------------------------------------------------
// TELEGRAM
// ---------------------------------------------------------------------------

/** Escapa los tres caracteres que Telegram interpreta en parse_mode HTML. */
function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const ICONO_PRIORIDAD: Record<PrioridadLead, string> = {
  alta: "\u{1F534}",
  media: "\u{1F7E1}",
  baja: "\u{1F7E2}",
};

const ICONO_ORIGEN: Record<string, string> = {
  post_diagnostico: "\u{1F4F7}",
  contacto_directo: "\u{1F4E7}",
};

const ETIQUETA_ORIGEN: Record<string, string> = {
  post_diagnostico: "Tras diagnóstico",
  contacto_directo: "Contacto directo",
};

/** Telegram corta a 4096 caracteres por mensaje. */
const LIMITE_TELEGRAM = 4000;

function mensajeTelegram(p: PayloadNotificacion): string {
  const lineas: string[] = [];

  lineas.push(
    `${ICONO_PRIORIDAD[p.prioridad]} <b>LEAD ${p.prioridad.toUpperCase()}</b> · ${p.puntuacion} pts`
  );
  lineas.push(`${ICONO_ORIGEN[p.origen] ?? ""} ${ETIQUETA_ORIGEN[p.origen] ?? p.origen}`.trim());
  lineas.push("");

  lineas.push(`<b>${escaparHtml(p.nombre)}</b>`);
  lineas.push(`Tel: <code>${escaparHtml(p.telefono)}</code>`);

  const zona = [p.municipio, p.cultivo]
    .filter((v): v is string => Boolean(v))
    .map(escaparHtml)
    .join(" · ");
  if (zona) lineas.push(`Zona: ${zona}`);

  const caso = p.sintoma ?? p.mensaje;
  if (caso) lineas.push(`\u{1F9E0} ${escaparHtml(caso)}`);

  if (p.origen === "post_diagnostico") {
    const partes: string[] = [];
    if (p.especie) partes.push(escaparHtml(p.especie));
    if (p.gravedad) partes.push(`gravedad ${p.gravedad}`);
    if (p.requiere_experto) partes.push("requiere técnico");
    if (partes.length > 0) {
      lineas.push(`\u{1F52C} Diagnóstico: ${partes.join(" · ")}`);
    }
  }

  if (p.fotos > 0) lineas.push(`\u{1F4F7} Fotos adjuntas: ${p.fotos}`);
  if (p.campaña) lineas.push(`\u{1F3AF} Campaña: ${escaparHtml(p.campaña)}`);

  const texto = lineas.join("\n");
  return texto.length > LIMITE_TELEGRAM ? `${texto.slice(0, LIMITE_TELEGRAM - 3)}...` : texto;
}

async function enviarTelegram(p: PayloadNotificacion): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const respuesta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: mensajeTelegram(p),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: "Abrir panel de leads", url: p.url_admin }]],
      },
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(`Telegram ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// WEBHOOK GENÉRICO
// ---------------------------------------------------------------------------

async function enviarWebhook(p: PayloadNotificacion, metricas?: MetricasCaptacion): Promise<void> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return;

  const cuerpo = JSON.stringify({
    ...p,
    resumen: resumenTexto(p),
    // Contexto de embudo en el momento de la entrada, por si el destino es
    // una herramienta que decide a quién avisar según la carga de trabajo.
    embudo: metricas
      ? {
          diagnosticos: metricas.diagnosticos,
          leads: metricas.leads,
          tasaConversion: metricas.tasaConversion,
          sinResponder: metricas.leadsSinResponder,
        }
      : undefined,
  });

  const firma = firmarCuerpo(cuerpo);
  const respuesta = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "tecrural-diagnostico/1",
      ...(firma ? { "X-TecRural-Signature": `sha256=${firma}` } : {}),
    },
    body: cuerpo,
  });

  if (!respuesta.ok) {
    throw new Error(`Webhook ${respuesta.status}: ${(await respuesta.text().catch(() => "")).slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// ENVÍO
// ---------------------------------------------------------------------------

async function conReintentos(canal: string, enviar: () => Promise<void>): Promise<void> {
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
    try {
      await Promise.race([
        enviar(),
        new Promise<never>((_, rechazar) =>
          controlador.signal.addEventListener("abort", () =>
            rechazar(new Error(`timeout tras ${TIMEOUT_MS} ms`))
          )
        ),
      ]);
      return;
    } catch (error) {
      console.warn(`Aviso de lead por ${canal} falló (intento ${intento}/${MAX_INTENTOS}).`);
    } finally {
      clearTimeout(temporizador);
      controlador.abort();
    }
    if (intento < MAX_INTENTOS) {
      await new Promise((r) => setTimeout(r, ESPERA_REINTENTO_MS));
    }
  }
  console.error(`No se pudo avisar del lead nuevo por ${canal}.`);
}

/**
 * Envía el aviso a los canales configurados. No lanza: el error se registra y
 * la petición del usuario continúa.
 */
export async function notificarLeadNuevo(
  lead: LeadFila,
  metricas?: MetricasCaptacion
): Promise<void> {
  const payload = construirPayload(lead);

  if (telegramConfigurado()) {
    await conReintentos("Telegram", () => enviarTelegram(payload));
  }
  if (webhookConfigurado()) {
    await conReintentos("webhook", () => enviarWebhook(payload, metricas));
  }
}

/** Comprobación de salud del canal: GET /getMe en Telegram. */
export async function comprobarTelegram(): Promise<{ ok: boolean; detalle: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, detalle: "TELEGRAM_BOT_TOKEN no configurado" };
  if (!process.env.TELEGRAM_CHAT_ID) {
    return { ok: false, detalle: "TELEGRAM_CHAT_ID no configurado" };
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const d = (await r.json()) as { ok?: boolean; result?: { username?: string } };
    return d.ok
      ? { ok: true, detalle: `Bot @${d.result?.username ?? "?"} listo` }
      : { ok: false, detalle: "Telegram rechazó la credencial" };
  } catch (e) {
    return { ok: false, detalle: e instanceof Error ? e.message : "error" };
  }
}
