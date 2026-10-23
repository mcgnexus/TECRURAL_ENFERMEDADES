import { describe, expect, it } from "vitest";
import type { LeadFila } from "@/types/lead";
import {
  FILTROS_VACIOS,
  aplicarFiltros,
  campanasUnicas,
  diaLead,
  hayFiltrosActivos,
  horasRespuesta,
  opcionesUnicas,
  ordenarLeads,
  paginar,
  resumenComercial,
} from "./filtros";

function lead(parcial: Partial<LeadFila> & { id: string }): LeadFila {
  return {
    diagnostico_id: null,
    nombre: "Sin nombre",
    telefono: "600000000",
    email: null,
    municipio: null,
    cultivo: null,
    sintoma: null,
    hectareas: null,
    mensaje: null,
    origen: "post_diagnostico",
    canal_contacto: null,
    solicitud_revision: false,
    prioridad: "baja",
    puntuacion: 0,
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
    created_at: "2026-01-01T10:00:00.000Z",
    ...parcial,
  };
}

const A = lead({
  id: "a",
  nombre: "Ana",
  telefono: "611111111",
  municipio: "Baza",
  cultivo: "Olivar",
  prioridad: "alta",
  puntuacion: 30,
  estado: "nuevo",
  num_imagenes: 3,
  created_at: "2026-03-10T09:00:00.000Z",
});
const B = lead({
  id: "b",
  nombre: "Bruno",
  telefono: "622222222",
  municipio: "Guadix",
  cultivo: "Almendro",
  prioridad: "baja",
  puntuacion: 5,
  estado: "ganado",
  num_imagenes: 0,
  created_at: "2026-03-12T09:00:00.000Z",
  primera_response_at: "2026-03-12T12:00:00.000Z",
});
const C = lead({
  id: "c",
  nombre: "Carla",
  telefono: "633333333",
  municipio: "Baza",
  cultivo: "Olivar",
  prioridad: "media",
  puntuacion: 15,
  estado: "contactado",
  num_imagenes: 1,
  created_at: "2026-02-01T09:00:00.000Z",
  utm_campaign: "olivar-marzo",
});

describe("aplicarFiltros", () => {
  const leads = [A, B, C];

  it("sin filtros devuelve todo", () => {
    expect(aplicarFiltros(leads, FILTROS_VACIOS)).toHaveLength(3);
  });

  it("filtra por estado y prioridad", () => {
    expect(aplicarFiltros(leads, { ...FILTROS_VACIOS, estado: "ganado" })).toEqual([B]);
    expect(aplicarFiltros(leads, { ...FILTROS_VACIOS, prioridad: "alta" })).toEqual([A]);
  });

  it("filtra por municipio y cultivo", () => {
    expect(aplicarFiltros(leads, { ...FILTROS_VACIOS, municipio: "Baza" })).toEqual([A, C]);
    expect(aplicarFiltros(leads, { ...FILTROS_VACIOS, cultivo: "Olivar" })).toEqual([A, C]);
  });

  it("la búsqueda de texto ignora mayúsculas y mira varios campos", () => {
    expect(aplicarFiltros(leads, { ...FILTROS_VACIOS, texto: "ana" })).toEqual([A]);
    expect(aplicarFiltros(leads, { ...FILTROS_VACIOS, texto: "62" })).toEqual([B]);
    expect(aplicarFiltros(leads, { ...FILTROS_VACIOS, texto: "olivar" })).toEqual([A, C]);
  });

  it("encuentra por correo un lead que no dejó teléfono", () => {
    // Caso real: el informe completo se desbloquea con teléfono O correo, así
    // que el panel tiene que poder buscar por las dos vías.
    const sinTelefono = lead({ id: "e", telefono: "", email: "campo@correo.es" });
    expect(aplicarFiltros([sinTelefono], { ...FILTROS_VACIOS, texto: "campo@correo" })).toEqual([
      sinTelefono,
    ]);
    expect(aplicarFiltros([sinTelefono], { ...FILTROS_VACIOS, texto: "correo.es" })).toEqual([
      sinTelefono,
    ]);
  });

  it("filtra por rango de fechas inclusive", () => {
    expect(
      aplicarFiltros(leads, { ...FILTROS_VACIOS, desde: "2026-03-10", hasta: "2026-03-10" })
    ).toEqual([A]);
    expect(
      aplicarFiltros(leads, { ...FILTROS_VACIOS, desde: "2026-03-01" })
    ).toEqual([A, B]);
  });

  it("filtra por campaña usando utm_campaign u origen_campana", () => {
    expect(aplicarFiltros(leads, { ...FILTROS_VACIOS, campana: "olivar-marzo" })).toEqual([C]);
  });
});

describe("ordenarLeads", () => {
  const leads = [C, A, B];

  it("ordena por puntuación desc y asc sin mutar el original", () => {
    const copia = leads.slice();
    expect(ordenarLeads(leads, { campo: "puntuacion", dir: "desc" }).map((l) => l.id)).toEqual([
      "a", "c", "b",
    ]);
    expect(ordenarLeads(leads, { campo: "puntuacion", dir: "asc" }).map((l) => l.id)).toEqual([
      "b", "c", "a",
    ]);
    expect(leads).toEqual(copia);
  });

  it("ordena prioridad por severidad, no alfabéticamente", () => {
    expect(ordenarLeads(leads, { campo: "prioridad", dir: "desc" }).map((l) => l.id)).toEqual([
      "a", "c", "b",
    ]);
  });

  it("ordena por fecha y por nº de fotos", () => {
    expect(ordenarLeads(leads, { campo: "created_at", dir: "asc" }).map((l) => l.id)).toEqual([
      "c", "a", "b",
    ]);
    expect(ordenarLeads(leads, { campo: "num_imagenes", dir: "desc" }).map((l) => l.id)).toEqual([
      "a", "c", "b",
    ]);
  });

  it("coloca los valores ausentes al final en ambas direcciones", () => {
    const sinMunicipio = lead({ id: "z", municipio: null });
    const lista = [sinMunicipio, A, B];
    expect(ordenarLeads(lista, { campo: "municipio", dir: "asc" }).at(-1)?.id).toBe("z");
    expect(ordenarLeads(lista, { campo: "municipio", dir: "desc" }).at(-1)?.id).toBe("z");
  });

  it("ordena por tiempo de respuesta con los no respondidos al final", () => {
    const lista = [A, B, C];
    expect(ordenarLeads(lista, { campo: "respuesta", dir: "asc" }).map((l) => l.id)).toEqual([
      "b", "a", "c",
    ]);
  });
});

describe("paginar", () => {
  it("recorta a la página pedida y calcula el total", () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginar(items, 1, 2)).toMatchObject({ items: [1, 2], totalPaginas: 3, total: 5 });
    expect(paginar(items, 3, 2)).toMatchObject({ items: [5], pagina: 3 });
  });

  it("ajusta páginas fuera de rango", () => {
    expect(paginar([1, 2, 3], 99, 2).pagina).toBe(2);
    expect(paginar([], 1, 25)).toMatchObject({ items: [], totalPaginas: 1, pagina: 1 });
  });
});

describe("utilidades", () => {
  it("opcionesUnicas recoge valores no vacíos ordenados", () => {
    expect(opcionesUnicas([A, B, C], "municipio")).toEqual(["Baza", "Guadix"]);
    expect(opcionesUnicas([A, B, C], "cultivo")).toEqual(["Almendro", "Olivar"]);
  });

  it("campanasUnicas mezcla utm_campaign y origen_campana", () => {
    const d = lead({ id: "d", origen_campana: "norte" });
    expect(campanasUnicas([A, B, C, d])).toEqual(["norte", "olivar-marzo"]);
  });

  it("hayFiltrosActivos detecta cambios", () => {
    expect(hayFiltrosActivos(FILTROS_VACIOS)).toBe(false);
    expect(hayFiltrosActivos({ ...FILTROS_VACIOS, texto: "x" })).toBe(true);
  });

  it("diaLead y horasRespuesta son coherentes", () => {
    expect(diaLead("2026-03-10T23:30:00.000Z")).toBe("2026-03-10");
    expect(horasRespuesta(B)).toBe(3);
    expect(horasRespuesta(A)).toBeNull();
  });
});

describe("resumenComercial", () => {
  const consentimiento = {
    canal: "correo" as const,
    texto_version: "v2-2026-10",
    aceptado_en: "2026-10-23T10:00:00.000Z",
    origen: "post_diagnostico" as const,
    revocado_en: null,
  };

  it("muestra canal, versión y fecha del consentimiento explícito", () => {
    const l = lead({
      id: "x",
      consentimiento_comercial: true,
      consentimiento_fuente: "explicito",
      consentimientos_comerciales: [consentimiento],
    });
    expect(resumenComercial(l)).toEqual(["Correo · v2-2026-10 · 23/10/2026"]);
  });

  it("muestra una línea por canal", () => {
    const l = lead({
      id: "x",
      consentimiento_comercial: true,
      consentimiento_fuente: "explicito",
      consentimientos_comerciales: [
        consentimiento,
        {
          ...consentimiento,
          canal: "whatsapp",
          texto_version: "v2-2026-10",
        },
      ],
    });
    expect(resumenComercial(l)).toEqual([
      "Correo · v2-2026-10 · 23/10/2026",
      "WhatsApp · v2-2026-10 · 23/10/2026",
    ]);
  });

  it("marca el histórico inferido sin presentarlo como explícito", () => {
    const l = lead({
      id: "x",
      consentimiento_comercial: true,
      consentimiento_fuente: "legacy_inferido",
      canal_comercial: "whatsapp",
    });
    expect(resumenComercial(l)).toEqual([
      "Histórico: WhatsApp (inferido, sin verificar)",
    ]);
  });

  it("indica la baja global y el caso sin consentimiento", () => {
    expect(resumenComercial(lead({ id: "x" }))).toEqual(["Sin consentimiento"]);
    expect(
      resumenComercial(
        lead({ id: "x", consentimiento_comercial: true, baja_comercial: true })
      )
    ).toEqual(["Sin consentimiento", "BAJA (suprime todos los canales)"]);
  });

  it("omite consentimientos revocados", () => {
    const l = lead({
      id: "x",
      consentimiento_comercial: true,
      consentimiento_fuente: "explicito",
      consentimientos_comerciales: [
        { ...consentimiento, revocado_en: "2026-10-24T10:00:00.000Z" },
      ],
    });
    expect(resumenComercial(l)).toEqual(["Sin consentimiento"]);
  });
});
