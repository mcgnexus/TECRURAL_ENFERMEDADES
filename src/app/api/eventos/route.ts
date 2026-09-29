import { NextRequest, NextResponse } from "next/server";
import { initDatabase, registrarEvento } from "@/lib/database";
import { consumirUsoPorClave } from "@/lib/cuota";
import { ipCliente } from "@/lib/ip-request";
import type { NombreEvento } from "@/lib/analitica";
import { z } from "zod";

/**
 * Persistencia de eventos del embudo.
 *
 * Antes, los eventos de `analitica.ts` iban solo a GA4 y a un buffer de
 * localStorage. Eso dejaba dos problemas: si el agricultor no aceptaba
 * cookies de terceros no había ni una métrica, y aunque los aceptara había que
 * entrar en GA4 para ver el embudo, con lo que el panel no era autosuficiente
 * para tomar decisiones comerciales.
 *
 * Aquí se guardan en la base de datos, en first party, así que el embudo se
 * cuenta igual con o sin consentimiento de terceros.
 *
 * Decisiones:
 * - Sin IP, sin user agent, sin geolocalización. Solo el UUID de la cookie
 *   httpOnly, que es un identificador aleatorio por dispositivo. Nada de esto
 *   permite identificar a una persona.
 * - Un evento por visitante y paso y día. El embudo se mide por personas: si
 *   alguien pulsa "analizar" seis veces en un día, sigue siendo un visitante.
 * - Nunca lanza: si el registro falla, la navegación del agricultor continúa.
 * - Un mismo request puede traer varios eventos: se agrupan en una sola
 *   llamada para no multiplicar las peticiones.
 */

export const runtime = "nodejs";

/** Eventos que se aceptan. Lista cerrada: no se guarda lo que llegue. */
const PERMITIDOS: NombreEvento[] = [
  "portada_vista",
  "captura_realizada",
  "analisis_iniciado",
  "analisis_completado",
  "analisis_error",
  "resultado_visto",
  "cta_revision_abierto",
  "lead_enviado",
  "lead_error",
  "whatsapp_click",
];

const eventoSchema = z.object({
  nombre: z.enum(PERMITIDOS),
}).strip();
const loteSchema = z.object({
  eventos: z.array(eventoSchema).max(10),
}).strip();
const MAX_CUERPO = 16 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function leerCuerpoLimitado(request: NextRequest): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;

  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CUERPO) {
      await reader.cancel();
      return null;
    }
    partes.push(value);
  }

  const cuerpo = new Uint8Array(total);
  let offset = 0;
  for (const parte of partes) {
    cuerpo.set(parte, offset);
    offset += parte.byteLength;
  }
  return new TextDecoder().decode(cuerpo);
}

export async function POST(request: NextRequest) {
  try {
    const uid = request.cookies.get("tr_uid")?.value;
    if (!uid || !UUID_RE.test(uid)) {
      // Sin cookie no hay contra quién contar. Se responde 204 para no delatar
      // nada y no generar ruido en el cliente.
      return new NextResponse(null, { status: 204 });
    }

    const largo = Number(request.headers.get("content-length") ?? 0);
    if (largo > MAX_CUERPO) return new NextResponse(null, { status: 413 });

    let json: unknown;
    try {
      json = JSON.parse((await leerCuerpoLimitado(request)) ?? "");
    } catch {
      return new NextResponse(null, { status: 400 });
    }
    const parseado = loteSchema.safeParse(json);
    if (!parseado.success || parseado.data.eventos.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    await initDatabase();

    // IP de cliente asignada por Vercel: evita que identidades de cookie
    // arbitrarias permitan generar escrituras ilimitadas en la tabla.
    const cuota = await consumirUsoPorClave("lead", `eventos:${ipCliente(request)}`, 120);
    if (!cuota.permitido) return new NextResponse(null, { status: 429 });

    for (const e of parseado.data.eventos) {
      // Se persiste solo el nombre permitido; nunca parámetros arbitrarios del
      // cliente, que podrían contener texto de cultivo u otros datos personales.
      await registrarEvento(uid, e.nombre);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // La analítica nunca debe romper la navegación del agricultor.
    console.warn("No se pudieron registrar los eventos.");
    return new NextResponse(null, { status: 204 });
  }
}
