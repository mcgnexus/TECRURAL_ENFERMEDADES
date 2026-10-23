import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardarLead, obtenerLeads, actualizarEstadoLead, guardarNotaLead, obtenerMetricasCaptacion, obtenerMetricasEmbudo, obtenerAccesos, borrarLead, borrarLeads, obtenerDiagnosticosPanel } from "@/lib/database";
import { calcularPrioridadLead } from "@/lib/leads";
import { notificarLeadNuevo } from "@/lib/notificar";
import { uidDeVisitante } from "@/lib/identidad";
import { consumirUsoPorClave, estadoCuotas, contactoCuota, hashContactoCuota, vincularContactoCuota } from "@/lib/cuota";
import { validarDataUrlImagen } from "@/lib/imagen";
import { ipCliente } from "@/lib/ip-request";
import { ESTADOS_LEAD } from "@/types/lead";
import type { ConsentimientoComercialRegistrado, EstadoLead, PrioridadLead } from "@/types/lead";
import {
  derivarConsentimientoAgregado,
  validarConsentimientosComerciales,
} from "@/lib/consentimiento-comercial";

export const runtime = "nodejs";
export const maxDuration = 30;

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

// Exportado solo para las pruebas (src/app/api/leads/route.test.ts): la regla
// "teléfono O correo" no se puede comprobar de otra forma sin llamar a la API.
export const leadSchema = z.object({
  // El nombre es opcional. Del contacto, basta con teléfono O correo: se
  // exige al menos uno en el superRefine del final, porque sin canal no hay
  // forma de entregar el informe completo ni de responder a la revisión.
  nombre: z.string().trim().max(80).optional(),
  telefono: z
    .string()
    .trim()
    .optional()
    // Cadena vacía o en blanco = sin teléfono (no rompe el superRefine final).
    .transform((t) => (t ? t.replace(/[\s().-]/g, "") : undefined))
    .refine((t) => t === undefined || TELEFONO_REGEX.test(t), {
      message: "Teléfono no válido. Revisa el número indicado.",
    }),
  // En blanco o vacío = sin correo, igual que con el teléfono: no debe tapar
  // el mensaje del superRefine final.
  email: z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v),
    z.email({ message: "Correo no válido. Revisa la dirección indicada." }).optional()
  ).transform((e) => e?.toLowerCase()),
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
  // (llamada | whatsapp | correo)
  canal_contacto: z.string().trim().max(40).optional(),
  // Confirmación explícita de que solicita respuesta sobre este caso. En el
  // flujo posterior al diagnóstico puede llegar a false: quien solo quería ver
  // el informe completo no ha pedido revisión, y su envío no genera una
  // solicitud de contacto (ni guarda fotos).
  solicitud_respuesta: z.boolean({
    message: "Falta la confirmación de la solicitud de respuesta",
  }),
  // Consentimiento comercial: opcional, separado, nunca premarcado. El formato
  // nuevo declara el canal explícito; el booleano se conserva solo para admitir
  // una PWA con JS antiguo y se mapea por origen, nunca por "hay teléfono".
  consentimiento_comercial: z.boolean().optional().default(false),
  consentimientos_comerciales: z
    .array(
      z.object({
        canal: z.enum(["correo", "whatsapp"], {
          message: "El canal de novedades no es válido.",
        }),
        texto_version: z.string().trim().min(1).max(40),
      })
    )
    .max(2)
    .optional(),
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
}).superRefine((datos, ctx) => {
  // Sin al menos un canal de contacto no hay forma de devolver el informe ni
  // de responder a la revisión, así que el envío se rechaza aquí.
  if (!datos.telefono && !datos.email) {
    ctx.addIssue({
      code: "custom",
      path: ["telefono"],
      message: "Déjanos un teléfono o un correo para recibir el informe y poder contactarte.",
    });
  }

  // La autorización comercial se valida contra el canal que se mostró en cada
  // formulario. El canal de revisión no interviene en esta comprobación.
  const consentimientos = validarConsentimientosComerciales({
    origen: datos.origen,
    email: datos.email,
    telefono: datos.telefono,
    consentimientosComerciales: datos.consentimientos_comerciales,
    consentimientoComercial: datos.consentimiento_comercial,
  });
  if (!consentimientos.ok) {
    ctx.addIssue({
      code: "custom",
      path: ["consentimientos_comerciales"],
      message: consentimientos.error ?? "No se pudo registrar la autorización de novedades.",
    });
  }
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

    // Honeypot relleno: probable bot. Se comprueba antes de validar el resto,
    // para que un envío automático con el campo de contacto vacío también
    // reciba un OK silencioso en lugar de un 400 que lo delataría.
    if (typeof body?.web === "string" && body.web.length > 0) {
      return NextResponse.json({ success: true });
    }

    const parsed = leadSchema.safeParse(body);

    if (!parsed.success) {
      const primero = parsed.error.issues[0];
      return NextResponse.json(
        { error: primero?.message ?? "Datos no válidos" },
        { status: 400 }
      );
    }

    const datos = parsed.data;

    // Minimización: las fotos son material de la revisión técnica. Si el envío
    // no la solicita, no se guardan ni se validan.
    const imagenes = datos.solicitud_respuesta ? datos.imagenes : undefined;

    // Validación real del contenido de cada imagen (magic bytes)
    if (imagenes && imagenes.length > 0) {
      for (const imagen of imagenes) {
        const resultado = validarDataUrlImagen(imagen);
        if (!resultado.ok) {
          return NextResponse.json({ error: resultado.error }, { status: 400 });
        }
      }
    }

    // Cuota por IP, ahora en la tabla `cuotas` y por tanto global entre
    // instancias. Va tras la validación del cuerpo: un envío con el teléfono
    // mal formado no debe gastar un uso de un agricultor legítimo.
    const ip = ipCliente(request);
    const cuotaIp = await consumirUsoPorClave("lead", ip, MAX_LEADS_POR_IP_HORA, 60 * 60 * 1000, ip);
    if (!cuotaIp.permitido) {
      return NextResponse.json(
        { error: cuotaIp.motivo === "database"
          ? "No podemos comprobar el límite de solicitudes ahora mismo. Inténtalo en unos minutos."
          : "Has enviado demasiadas solicitudes desde esta conexión. Inténtalo de nuevo más tarde." },
        { status: cuotaIp.motivo === "database" ? 503 : 429 }
      );
    }

    const { prioridad, puntuacion } = calcularPrioridadLead(datos.contexto, datos.origen);

    // Una única validación, también aquí, para obtener el detalle normalizado.
    // Las fechas y el origen los pone el servidor: el cliente no puede fijarlos.
    const validacion = validarConsentimientosComerciales({
      origen: datos.origen,
      email: datos.email,
      telefono: datos.telefono,
      consentimientosComerciales: datos.consentimientos_comerciales,
      consentimientoComercial: datos.consentimiento_comercial,
    });
    if (!validacion.ok) {
      return NextResponse.json(
        { error: validacion.error ?? "No se pudo registrar la autorización de novedades." },
        { status: 400 }
      );
    }

    const aceptadoEn = new Date().toISOString();
    const consentimientosComerciales: ConsentimientoComercialRegistrado[] =
      validacion.consentimientos.map((consentimiento) => ({
        canal: consentimiento.canal,
        texto_version: consentimiento.texto_version,
        aceptado_en: aceptadoEn,
        origen: datos.origen,
        revocado_en: null,
        ...(validacion.compatibilidad ? { compatibilidad: true as const } : {}),
      }));
    const agregadoComercial = derivarConsentimientoAgregado(consentimientosComerciales);

    // Aviso de prueba del canal, sin crear lead. ?test_notificacion=1 manda un
    // mensaje de ejemplo al destino configurado para comprobar que Telegram o
    // el webhook están bien puestos. No toca la base de datos.
    if (request.nextUrl.searchParams.get("test_notificacion")) {
      const prueba = {
        ...datos,
        nombre: datos.nombre || "Prueba de canal",
        telefono: datos.telefono ?? "",
        email: datos.email ?? null,
        prioridad,
        puntuacion,
        fotos: 0,
        created_at: new Date().toISOString(),
        contexto_diagnostico: datos.contexto ?? null,
        num_imagenes: 0,
        sintoma: datos.sintoma ?? null,
        municipio: datos.municipio ?? null,
        cultivo: datos.cultivo ?? null,
        mensaje: datos.mensaje ?? null,
        origen_campana: datos.utm?.campaign ?? null,
        utm_source: datos.utm?.source ?? null,
        utm_campaign: datos.utm?.campaign ?? null,
        canal_contacto: datos.canal_contacto ?? null,
        consentimiento_comercial: agregadoComercial.consentimiento_comercial,
        consentimiento_comercial_fecha: agregadoComercial.consentimiento_comercial_fecha,
        consentimiento_texto_version: agregadoComercial.consentimiento_texto_version,
        canal_comercial: agregadoComercial.canal_comercial,
        consentimientos_comerciales: consentimientosComerciales,
        consentimiento_fuente: consentimientosComerciales.length > 0 ? "explicito" : "ninguno",
        baja_comercial: false,
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
      // Cadena vacía si solo dejó correo: la columna es NOT NULL (ver migración 0010).
      telefono: datos.telefono ?? "",
      email: datos.email,
      municipio: datos.municipio || datos.contexto?.municipio || undefined,
      cultivo: datos.cultivo || datos.contexto?.cultivo || undefined,
      sintoma: datos.sintoma || datos.contexto?.sintoma || undefined,
      hectareas: datos.hectareas,
      mensaje: datos.mensaje || undefined,
      diagnosticoId: datos.diagnostico_id,
      origen: datos.origen,
      solicitudRevision: datos.solicitud_respuesta,
      canalContacto: datos.canal_contacto,
      prioridad,
      puntuacion,
      contexto: datos.contexto,
      consentimientosComerciales: consentimientosComerciales,
      origenCampana: datos.utm?.campaign || undefined,
      utmSource: datos.utm?.source,
      utmMedium: datos.utm?.medium,
      utmCampaign: datos.utm?.campaign,
      utmContent: datos.utm?.content,
      utmTerm: datos.utm?.term,
      imagenes,
      ip,
    });

    // Ampliación de cuota en la misma operación: el formulario del informe
    // promete "con tu contacto amplías el límite a 6 análisis semanales", así
    // que la vinculación debe completarse ANTES de confirmar el éxito, no en
    // una segunda petición. Solo en el flujo posterior al diagnóstico (su
    // casilla de autorización cubre esta finalidad; el contacto directo no la
    // menciona). Si falla, el lead ya está guardado: se registra y se sigue,
    // porque el informe sí se ha entregado.
    if (datos.origen === "post_diagnostico" && usuarioId) {
      try {
        const contacto = contactoCuota(datos.email, datos.telefono);
        if (contacto) {
          await vincularContactoCuota(usuarioId, hashContactoCuota(contacto));
        }
      } catch (error) {
        // Un dispositivo con otro contacto ya vinculado no debe romper el envío.
        console.warn("No se pudo vincular la ampliación de cuota del lead.");
      }
    }

    // Next mantiene este trabajo dentro del ciclo de vida de la petición aunque
    // la respuesta al agricultor ya se haya enviado (Next `after()`; maxDuration
    // se aplica también al callback). Así no dependemos de una promesa suelta.
    after(async () => {
      try {
        await notificarLeadNuevo(guardado, await obtenerMetricasCaptacion());
      } catch (error) {
        console.warn("Aviso de lead nuevo no completado.");
      }
    });

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

    // ?diagnosticos=1&dias=90&limit=200 devuelve los análisis con su resultado
    // (tipo, enfermedad, gravedad, confianza, recomendación) más el recuento de
    // intentos, iniciados y errores. Nunca trae la foto: `imagen_url` se guarda
    // vacío porque las imágenes no se persisten.
    if (request.nextUrl.searchParams.get("diagnosticos")) {
      const dias = Number(request.nextUrl.searchParams.get("dias")) || 90;
      const limit = Number(request.nextUrl.searchParams.get("limit")) || 200;
      const diagnosticos = await obtenerDiagnosticosPanel(dias, limit);
      return NextResponse.json({ diagnosticos });
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

// Borrado definitivo de leads desde el panel. Es la única operación destructiva
// de la API: por eso exige el mismo ADMIN_TOKEN que el resto y se limita a
// identificadores UUID validados (nunca SQL dinámico). Las fotos se van con la
// fila (viven en leads.imagenes) y el diagnóstico asociado no se borra (la FK
// usa ON DELETE SET NULL).
const borradoSchema = z.object({
  ids: z
    .array(z.string().regex(UUID_REGEX, "id no válido"))
    .min(1, "No se indicó ningún lead")
    .max(500, "Demasiados leads en una sola operación"),
});

export async function DELETE(request: NextRequest) {
  const token = process.env.ADMIN_TOKEN;
  const recibido = request.headers.get("x-admin-token");

  if (!token) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }
  if (recibido !== token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const parsed = borradoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
        { status: 400 }
      );
    }

    const borrados =
      parsed.data.ids.length === 1
        ? Number(await borrarLead(parsed.data.ids[0]))
        : await borrarLeads(parsed.data.ids);

    return NextResponse.json({ success: true, borrados });
  } catch (error) {
    console.error("Error borrando leads.");
    return NextResponse.json({ error: "Error borrando leads" }, { status: 500 });
  }
}
