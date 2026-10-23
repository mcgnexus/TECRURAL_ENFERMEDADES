import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { TEXTOS_COMERCIALES } from "@/lib/consentimiento-comercial";
import type { LeadFila } from "@/types/lead";

/**
 * Integración del POST de leads.
 *
 * El bug original no estaba en el esquema sino en cómo se derivaba el canal
 * comercial al guardar. Por eso estos casos ejecutan `POST` de verdad (con la
 * base de datos y los avisos mockeados) y miran lo que recibe `guardarLead`.
 */

const mocks = vi.hoisted(() => ({
  guardarLead: vi.fn(),
  obtenerMetricasCaptacion: vi.fn(),
  obtenerLeads: vi.fn(),
  actualizarEstadoLead: vi.fn(),
  guardarNotaLead: vi.fn(),
  obtenerMetricasEmbudo: vi.fn(),
  obtenerAccesos: vi.fn(),
  borrarLead: vi.fn(),
  borrarLeads: vi.fn(),
  obtenerDiagnosticosPanel: vi.fn(),
  notificarLeadNuevo: vi.fn(),
  consumirUsoPorClave: vi.fn(),
  contactoCuota: vi.fn(),
  hashContactoCuota: vi.fn(),
  vincularContactoCuota: vi.fn(),
  uidDeVisitante: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  guardarLead: mocks.guardarLead,
  obtenerMetricasCaptacion: mocks.obtenerMetricasCaptacion,
  obtenerLeads: mocks.obtenerLeads,
  actualizarEstadoLead: mocks.actualizarEstadoLead,
  guardarNotaLead: mocks.guardarNotaLead,
  obtenerMetricasEmbudo: mocks.obtenerMetricasEmbudo,
  obtenerAccesos: mocks.obtenerAccesos,
  borrarLead: mocks.borrarLead,
  borrarLeads: mocks.borrarLeads,
  obtenerDiagnosticosPanel: mocks.obtenerDiagnosticosPanel,
}));

vi.mock("@/lib/notificar", () => ({
  notificarLeadNuevo: mocks.notificarLeadNuevo,
}));

vi.mock("@/lib/cuota", () => ({
  consumirUsoPorClave: mocks.consumirUsoPorClave,
  contactoCuota: mocks.contactoCuota,
  hashContactoCuota: mocks.hashContactoCuota,
  vincularContactoCuota: mocks.vincularContactoCuota,
  estadoCuotas: vi.fn(async () => []),
}));

vi.mock("@/lib/identidad", () => ({
  uidDeVisitante: mocks.uidDeVisitante,
}));

// `after()` ejecuta el aviso fuera de la respuesta; aquí se ignora para que el
// test no dependa de un callback en segundo plano.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});

const { POST } = await import("./route");

const UID = "11111111-1111-4111-8111-111111111111";

function leadFila(parcial: Partial<LeadFila> = {}): LeadFila {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    diagnostico_id: null,
    nombre: "Sin nombre",
    telefono: "600123456",
    email: "campo@correo.es",
    municipio: null,
    cultivo: null,
    sintoma: null,
    hectareas: null,
    mensaje: null,
    origen: "post_diagnostico",
    canal_contacto: null,
    solicitud_revision: false,
    prioridad: "media",
    puntuacion: 10,
    estado: "nuevo",
    contexto_diagnostico: null,
    consentimiento_comercial: false,
    consentimiento_comercial_fecha: null,
    consentimiento_texto_version: null,
    canal_comercial: null,
    consentimientos_comerciales: [],
    consentimiento_fuente: "ninguno",
    baja_comercial: false,
    num_imagenes: 0,
    origen_campana: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    primera_response_at: null,
    notas: null,
    created_at: "2026-10-23T10:00:00.000Z",
    ...parcial,
  };
}

function peticion(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.7",
    },
    body: JSON.stringify(body),
  });
}

function consentimiento(canal: "correo" | "whatsapp") {
  return { canal, texto_version: TEXTOS_COMERCIALES[canal].version };
}

const guardado = () => mocks.guardarLead.mock.calls[0]?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guardarLead.mockImplementation(async () => leadFila());
  mocks.obtenerMetricasCaptacion.mockResolvedValue({});
  mocks.notificarLeadNuevo.mockResolvedValue(undefined);
  mocks.consumirUsoPorClave.mockResolvedValue({ permitido: true, restantes: 1 });
  mocks.contactoCuota.mockReturnValue("correo:campo@correo.es");
  mocks.hashContactoCuota.mockReturnValue("hash");
  mocks.vincularContactoCuota.mockResolvedValue(undefined);
  mocks.uidDeVisitante.mockResolvedValue(UID);
});

describe("POST /api/leads: consentimiento comercial", () => {
  it("teléfono para la revisión + novedades por correo: el comercial es correo", async () => {
    const r = await POST(
      peticion({
        origen: "post_diagnostico",
        solicitud_respuesta: true,
        telefono: "600123456",
        email: "campo@correo.es",
        canal_contacto: "llamada",
        consentimientos_comerciales: [consentimiento("correo")],
      })
    );

    expect(r.status).toBe(200);
    const datos = guardado();
    expect(datos.solicitudRevision).toBe(true);
    expect(datos.canalContacto).toBe("llamada");
    expect(datos.consentimientosComerciales).toHaveLength(1);

    const comercial = datos.consentimientosComerciales[0];
    expect(comercial.canal).toBe("correo");
    expect(comercial.texto_version).toBe(TEXTOS_COMERCIALES.correo.version);
    expect(comercial.origen).toBe("post_diagnostico");
    expect(typeof comercial.aceptado_en).toBe("string");
    expect(datos.consentimientosComerciales.some((c: { canal: string }) => c.canal === "whatsapp")).toBe(false);
  });

  it("teléfono sin novedades: revisión intacta y cero consentimientos", async () => {
    const r = await POST(
      peticion({
        origen: "post_diagnostico",
        solicitud_respuesta: true,
        telefono: "600123456",
        email: "campo@correo.es",
        canal_contacto: "whatsapp",
      })
    );

    expect(r.status).toBe(200);
    const datos = guardado();
    expect(datos.solicitudRevision).toBe(true);
    expect(datos.canalContacto).toBe("whatsapp");
    expect(datos.consentimientosComerciales).toEqual([]);
  });

  it("solo informe, sin revisión: no hay canal de revisión ni fotos ni consentimiento", async () => {
    const r = await POST(
      peticion({
        origen: "post_diagnostico",
        solicitud_respuesta: false,
        email: "campo@correo.es",
      })
    );

    expect(r.status).toBe(200);
    const datos = guardado();
    expect(datos.solicitudRevision).toBe(false);
    expect(datos.canalContacto).toBeUndefined();
    expect(datos.imagenes).toBeUndefined();
    expect(datos.consentimientosComerciales).toEqual([]);
  });

  it("revisión sin novedades: conserva el canal elegido y no suscribe", async () => {
    const r = await POST(
      peticion({
        origen: "post_diagnostico",
        solicitud_respuesta: true,
        telefono: "600123456",
        canal_contacto: "llamada",
      })
    );

    expect(r.status).toBe(200);
    const datos = guardado();
    expect(datos.solicitudRevision).toBe(true);
    expect(datos.canalContacto).toBe("llamada");
    expect(datos.consentimientosComerciales).toEqual([]);
  });

  it("contacto directo con WhatsApp: comercial WhatsApp y revisión por el canal elegido", async () => {
    const r = await POST(
      peticion({
        origen: "contacto_directo",
        solicitud_respuesta: true,
        telefono: "600123456",
        canal_contacto: "whatsapp",
        consentimientos_comerciales: [consentimiento("whatsapp")],
      })
    );

    expect(r.status).toBe(200);
    const datos = guardado();
    expect(datos.solicitudRevision).toBe(true);
    expect(datos.canalContacto).toBe("whatsapp");
    expect(datos.consentimientosComerciales[0].canal).toBe("whatsapp");
  });

  it("rechaza WhatsApp en el formulario del informe sin guardar nada", async () => {
    const r = await POST(
      peticion({
        origen: "post_diagnostico",
        solicitud_respuesta: true,
        telefono: "600123456",
        email: "campo@correo.es",
        consentimientos_comerciales: [consentimiento("whatsapp")],
      })
    );

    expect(r.status).toBe(400);
    expect(mocks.guardarLead).not.toHaveBeenCalled();
  });

  it("rechaza correo en contacto directo: no se mostró", async () => {
    const r = await POST(
      peticion({
        origen: "contacto_directo",
        solicitud_respuesta: true,
        email: "campo@correo.es",
        consentimientos_comerciales: [consentimiento("correo")],
      })
    );

    expect(r.status).toBe(400);
    expect(mocks.guardarLead).not.toHaveBeenCalled();
  });

  it("rechaza el correo comercial sin dirección de correo", async () => {
    const r = await POST(
      peticion({
        origen: "post_diagnostico",
        solicitud_respuesta: true,
        telefono: "600123456",
        consentimientos_comerciales: [consentimiento("correo")],
      })
    );

    expect(r.status).toBe(400);
    expect(mocks.guardarLead).not.toHaveBeenCalled();
  });

  it("payload legacy del informe con teléfono: guarda correo, nunca WhatsApp", async () => {
    const r = await POST(
      peticion({
        origen: "post_diagnostico",
        solicitud_respuesta: true,
        telefono: "600123456",
        email: "campo@correo.es",
        consentimiento_comercial: true,
      })
    );

    expect(r.status).toBe(200);
    const datos = guardado();
    const comercial = datos.consentimientosComerciales[0];
    expect(comercial.canal).toBe("correo");
    expect(comercial.compatibilidad).toBe(true);
    expect(comercial.texto_version).toBe("v1-2026-09");
  });
});
