import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initDatabase, guardarLead, obtenerLeads, actualizarEstadoLead, guardarNotaLead, obtenerMetricasCaptacion, obtenerMetricasEmbudo, obtenerAccesos } from "@/lib/database";
import { calcularPrioridadLead } from "@/lib/leads";
import { notificarLeadNuevo } from "@/lib/notificar";
import { uidDeVisitante } from "@/lib/identidad";
import { consumirUsoPorClave, estadoCuotas } from "@/lib/cuota";
import { validarDataUrlImagen } from "@/lib/imagen";
import { ipCliente } from "@/lib/ip-request";
import { ESTADOS_LEAD } from "@/types/lead";
import type { EstadoLead, PrioridadLead } from "@/types/lead";

export const runtime = "nodejs";

// Versión del texto del consentimiento comercial mostrado en el formulario.
// Actualizar si cambia la redacción; se guarda junto al lead.
const TEXTO_COMERCIAL_VERSION = "v1-2026-09";
const CANAL_COMERCIAL = "whatsapp";

const TELEFONO_REGEX = /^[+]?[\d\s().-]{9,20}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GRAVEDADES = ["leve", "moderada", "severa"] as const;
const TIPOS = ["enfermedad", "deficiencia_nutricional", "plaga", "sano"] as const;
const ORGANOS = ["hoja", "flor", "fruto", "tallo", "planta_completa"] as const;

const utmSchema = z.object({
  source: z.string().trim().max(190).optional(),
  medium: z.string().trim().max(190).optional(),
  campaign: z.string().trim().max(190).optional(),
  content: z.string().trim().max(190).optional(),
  term: z.string().trim().max(190).optional(),
});

const leadSchema = z.object({
  // El nombre es opcional; el teléfono es el canal mínimo de contacto
  nombre: z.string().trim().max(80).optional(),
  telefono: z
    .string()
    .trim()
    .regex(TELEFONO_REGEX, "Teléfono no válido. Revisa el número indicado.")
    .transform((t) => t.replace(/[\s().-]/g, "")),
  municipio: z.string().trim().max(80).optional(),
  cultivo: z.string().trim().max(80).optional(),
  sintoma: z.string().trim().max(200).optional(),
  // La superficie se acepta y se guarda, pero no puntúa: el pequeño
  // agricultor no suele conocerla en hectáreas. Ver src/lib/leads.ts.
  hectareas: z.number().min(0).max(100000).optional(),
  mensaje: z.string().trim().max(1000).optional(),
  diagnostico_id: z.string().regex(UUID_REGEX, "diagnostico_id no válido").optional(),
  origen: z.enum(["post_diagnostico", "contacto_directo"]),
  // Canal de contacto solicitado para responder a la revisión
  canal_contacto: z.string().trim().max(40).optional(),
  // Confirmación explícita de que solicita respuesta sobre este caso
  solicitud_respuesta: z.literal(true, {
    message: "Debes confirmar que solicitas respuesta sobre este caso",
  }),
  // Consentimiento comercial: opcional, separado, nunca premarcado
  consentimiento_comercial: z.boolean().optional().default(false),
  contexto: z
    .object({
      especie: z.string().trim().max(120).optional(),
      gravedad: z.enum(GRAVEDADES).optional(),
      tipo: z.enum(TIPOS).optional(),
      requiere_experto: z.boolean().optional(),
      organo: z.enum(ORGANOS).optional(),
      angulos_capturados: z.number().int().min(1).max(3).optional(),
      cultivo: z.string().trim().max(80).optional(),
      municipio: z.string().trim().max(80).optional(),
      sintoma: z.string().trim().max(120).optional(),
    })
    .optional(),
  utm: utmSchema.optional(),
  // Fotos del análisis compartidas para la revisión (data URLs JPEG/PNG/WebP)
  imagenes: z.array(z.string().max(2_400_000)).max(3).optional(),
  // Campo trampa anti-spam: si llega relleno se ignora la petición
  web: z.string().optional(),
});

// Límite de solicitudes por IP. Antes vivía en un Map del módulo, es decir en
// la memoria de la instancia: con varias instancias activas, "5 por hora" se
// convertían en 5 por instancia y el límite no protegía nada. Ahora el contador
// está en la tabla `cuotas`, que es global y sobrevive al reciclaje.
const MAX_LEADS_POR_IP_HORA = 5;

export async function POST(request: NextRequest) {
  try {
    // El cuerpo se lee antes del rate limit: si no, una petición de 8 MB con
    // fotos se gastaría un uso del contador y luego se rechazaría por datos no
    // válidos. Así solo consume cuota lo que realmente llega a guardarse.
    // Límite de tamaño del cuerpo (fotos adjuntas)
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 9 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Las fotos adjuntas son demasiado grandes. Prueba de nuevo." },
        { status: 413 }
      );
    }

    const body = await request.json();
    const parsed = leadSchema.safeParse(body);

    if (!parsed.success) {
      const primero = parsed.error.issues[0];
      return NextResponse.json(
        { error: primero?.message ?? "Datos no válidos" },
        { status: 400 }
      );
    }

    // Honeypot relleno: probable bot. Respondemos OK sin guardar nada.
    if (parsed.data.web && parsed.data.web.length > 0) {
      return NextResponse.json({ success: true });
    }

    const datos = parsed.data;

    // Validación real del contenido de cada imagen (magic bytes)
    if (datos.imagenes && datos.imagenes.length > 0) {
      for (const imagen of datos.imagenes) {
        const resultado = validarDataUrlImagen(imagen);
        if (!resultado.ok) {
          return NextResponse.json({ error: resultado.error }, { status: 400 });
        }
      }
    }

    await initDatabase();

    // Cuota por IP, ahora en la tabla `cuotas` y por tanto global entre
    // instancias. Va tras la validación del cuerpo: un envío con el teléfono
    // mal formado no debe gastar un uso de un agricultor legítimo.
    const ip = ipCliente(request);
    const cuotaIp = await consumirUsoPorClave("lead", ip, MAX_LEADS_POR_IP_HORA);
    if (!cuotaIp.permitido) {
      return NextResponse.json(
        { error: "Has enviado demasiadas solicitudes desde esta conexión. Inténtalo de nuevo más tarde." },
        { status: 429 }
      );
    }

    const { prioridad, puntuacion } = calcularPrioridadLead(datos.contexto, datos.origen);

    // Aviso de prueba del canal, sin crear lead. ?test_notificacion=1 manda un
    // mensaje de ejemplo al destino configurado para comprobar que Telegram o
    // el webhook están bien puestos. No toca la base de datos.
    if (request.nextUrl.searchParams.get("test_notificacion")) {
      const prueba = {
        ...datos,
        nombre: datos.nombre || "Prueba de canal",
        telefono: datos.telefono,
        prioridad,
        puntuacion,
        fotos: 0,
        created_at: new Date().toISOString(),
        contexto_diagnostico: datos.contexto ?? null,
        num_imagenes: 0,
        consentimiento_comercial: datos.consentimiento_comercial ?? false,
        consentimiento_texto_version: null,
        canal_comercial: null,
        baja_comercial: false,
        utm_campaign: datos.utm?.campaign ?? null,
        utm_source: datos.utm?.source ?? null,
      } as unknown as Parameters<typeof notificarLeadNuevo>[0];

      await notificarLeadNuevo(prueba);
      return NextResponse.json({ success: true, aviso: "enviado" });
    }

    // Visitante desde la cookie httpOnly del proxy, nunca desde el cuerpo: si
    // no, el lead no se puede atribuir y la conversión por personas no es
    // medible.
    const usuarioId = await uidDeVisitante();

    const guardado = await guardarLead({
      usuarioId: usuarioId ?? undefined,
      nombre: datos.nombre || "No facilitado",
      telefono: datos.telefono,
      municipio: datos.municipio || datos.contexto?.municipio || undefined,
      cultivo: datos.cultivo || datos.contexto?.cultivo || undefined,
      sintoma: datos.sintoma || datos.contexto?.sintoma || undefined,
      hectareas: datos.hectareas,
      mensaje: datos.mensaje || undefined,
      diagnosticoId: datos.diagnostico_id,
      origen: datos.origen,
      canalContacto: datos.canal_contacto,
      prioridad,
      puntuacion,
      contexto: datos.contexto,
      consentimientoComercial: datos.consentimiento_comercial,
      consentimientoTextoVersion: datos.consentimiento_comercial ? TEXTO_COMERCIAL_VERSION : undefined,
      canalComercial: datos.consentimiento_comercial ? CANAL_COMERCIAL : undefined,
      origenCampana: datos.utm?.campaign || undefined,
      utmSource: datos.utm?.source,
      utmMedium: datos.utm?.medium,
      utmCampaign: datos.utm?.campaign,
      utmContent: datos.utm?.content,
      utmTerm: datos.utm?.term,
      imagenes: datos.imagenes,
      ip,
    });

    // Aviso al técnico. Va DESPUÉS del guardado y no se espera: el usuario
    // recibe su confirmación sin depender del webhook. La consulta de métricas
    // va dentro porque tampoco debe retrasar la respuesta.
    void (async () => {
      try {
        await notificarLeadNuevo(guardado, await obtenerMetricasCaptacion());
      } catch (error) {
        console.warn("Aviso de lead nuevo no completado.");
      }
    })();

    return NextResponse.json({
      success: true,
      id: guardado.id,
      prioridad: guardado.prioridad,
    });
  } catch (error) {
    console.error("Error guardando lead.");
    const message = error instanceof Error ? error.message : "Error interno";

    if (message.includes("DATABASE_URL")) {
      return NextResponse.json(
        { error: "Ahora mismo no podemos registrar tu solicitud. Prueba de nuevo en unos minutos o escríbenos por WhatsApp." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "No se pudo enviar la solicitud. Comprueba tu conexión e inténtalo de nuevo." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const token = process.env.ADMIN_TOKEN;
  const recibido = request.headers.get("x-admin-token");

  if (!token) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }
  if (recibido !== token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    await initDatabase();
    const estado = request.nextUrl.searchParams.get("estado") as EstadoLead | null;
    const prioridad = request.nextUrl.searchParams.get("prioridad") as PrioridadLead | null;
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 100;

    // ?metricas=1 devuelve el embudo en lugar del listado. Se calcula en el
    // servidor para que el panel no tenga que traer todos los leads y
    // agregarlos en el cliente.
    if (request.nextUrl.searchParams.get("metricas")) {
      const [metricas, cuota, embudo] = await Promise.all([
        obtenerMetricasCaptacion(),
        estadoCuotas().then((c) => c[0] ?? null),
        obtenerMetricasEmbudo(),
      ]);
      return NextResponse.json({ metricas, cuota, embudo });
    }

    // ?accesos=1&dias=30 devuelve la vista de accesos: visitas anónimas,
    // embudo diario e IPs (enmascaradas) procedentes de la tabla de cuotas.
    if (request.nextUrl.searchParams.get("accesos")) {
      const dias = Number(request.nextUrl.searchParams.get("dias")) || 30;
      const accesos = await obtenerAccesos(dias);
      return NextResponse.json({ accesos });
    }

    const leads = await obtenerLeads({
      estado: estado ?? undefined,
      prioridad: prioridad ?? undefined,
      limit,
    });

    return NextResponse.json({ leads, total: leads.length });
  } catch (error) {
    console.error("Error listando leads.");
    return NextResponse.json({ error: "Error listando leads" }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().regex(UUID_REGEX, "id no válido"),
  estado: z.enum(ESTADOS_LEAD, { message: "Estado comercial no válido" }),
  notas: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: NextRequest) {
  const token = process.env.ADMIN_TOKEN;
  const recibido = request.headers.get("x-admin-token");

  if (!token) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }
  if (recibido !== token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
        { status: 400 }
      );
    }

    await initDatabase();
    if (parsed.data.notas !== undefined) {
      const anotado = await guardarNotaLead(parsed.data.id, parsed.data.notas);
      if (!anotado) {
        return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
      }
    }
    if (parsed.data.estado) {
      const actualizado = await actualizarEstadoLead(parsed.data.id, parsed.data.estado);
      if (!actualizado) {
        return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error actualizando lead.");
    return NextResponse.json({ error: "Error actualizando lead" }, { status: 500 });
  }
}
