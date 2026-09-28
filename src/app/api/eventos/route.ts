import { NextRequest, NextResponse } from "next/server";
import { initDatabase, registrarEvento } from "@/lib/database";
import type { NombreEvento } from "@/lib/analitica";

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

export async function POST(request: NextRequest) {
  try {
    const uid = request.cookies.get("tr_uid")?.value;
    if (!uid) {
      // Sin cookie no hay contra quién contar. Se responde 204 para no delatar
      // nada y no generar ruido en el cliente.
      return new NextResponse(null, { status: 204 });
    }

    const cuerpo = (await request.json()) as {
      eventos?: { nombre: string; params?: Record<string, unknown> }[];
    };

    const lista = Array.isArray(cuerpo.eventos) ? cuerpo.eventos : [];
    if (lista.length === 0) return new NextResponse(null, { status: 204 });

    // Se filtran por lista blanca y se limita el tamaño: nadie debe poder
    // inyectar un nombre de evento arbitrario ni mandar mil filas de golpe.
    const validos = lista
      .filter((e): e is { nombre: NombreEvento; params?: Record<string, unknown> } =>
        PERMITIDOS.includes(e.nombre as NombreEvento)
      )
      .slice(0, 10);

    if (validos.length === 0) return new NextResponse(null, { status: 204 });

    await initDatabase();
    for (const e of validos) {
      await registrarEvento(uid, e.nombre, e.params);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // La analítica nunca debe romper la navegación del agricultor.
    console.warn("No se pudieron registrar los eventos:", error);
    return new NextResponse(null, { status: 204 });
  }
}
