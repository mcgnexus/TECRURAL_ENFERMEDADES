import { describe, expect, it } from "vitest";
import {
  TEXTOS_COMERCIALES,
  VERSION_CONSENTIMIENTO_LEGACY,
  derivarConsentimientoAgregado,
  parsearConsentimientosComerciales,
  validarConsentimientosComerciales,
} from "./consentimiento-comercial";

const correo = {
  canal: "correo" as const,
  texto_version: TEXTOS_COMERCIALES.correo.version,
};
const whatsapp = {
  canal: "whatsapp" as const,
  texto_version: TEXTOS_COMERCIALES.whatsapp.version,
};

describe("validarConsentimientosComerciales", () => {
  it("acepta correo en el formulario del informe si hay correo", () => {
    const r = validarConsentimientosComerciales({
      origen: "post_diagnostico",
      email: "campo@correo.es",
      consentimientosComerciales: [correo],
    });
    expect(r.ok).toBe(true);
    expect(r.consentimientos).toEqual([correo]);
    expect(r.compatibilidad).toBe(false);
  });

  it("rechaza WhatsApp en el formulario del informe aunque haya teléfono", () => {
    const r = validarConsentimientosComerciales({
      origen: "post_diagnostico",
      email: "campo@correo.es",
      telefono: "600123456",
      consentimientosComerciales: [whatsapp],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("El canal de novedades no corresponde al formulario mostrado.");
  });

  it("rechaza correo sin dirección de correo", () => {
    const r = validarConsentimientosComerciales({
      origen: "post_diagnostico",
      telefono: "600123456",
      consentimientosComerciales: [correo],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe(
      "La autorización de novedades por correo requiere un correo electrónico."
    );
  });

  it("acepta WhatsApp en contacto directo con teléfono", () => {
    const r = validarConsentimientosComerciales({
      origen: "contacto_directo",
      telefono: "600123456",
      consentimientosComerciales: [whatsapp],
    });
    expect(r.ok).toBe(true);
    expect(r.consentimientos).toEqual([whatsapp]);
  });

  it("rechaza correo en contacto directo: no se mostró", () => {
    const r = validarConsentimientosComerciales({
      origen: "contacto_directo",
      email: "campo@correo.es",
      consentimientosComerciales: [correo],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("El canal de novedades no corresponde al formulario mostrado.");
  });

  it("rechaza WhatsApp sin teléfono", () => {
    const r = validarConsentimientosComerciales({
      origen: "contacto_directo",
      email: "campo@correo.es",
      consentimientosComerciales: [whatsapp],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe(
      "La autorización de novedades por WhatsApp requiere un teléfono."
    );
  });

  it("rechaza canales duplicados", () => {
    const r = validarConsentimientosComerciales({
      origen: "post_diagnostico",
      email: "campo@correo.es",
      consentimientosComerciales: [correo, correo],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("repetida");
  });

  it("rechaza una versión de texto que no es la actual", () => {
    const r = validarConsentimientosComerciales({
      origen: "post_diagnostico",
      email: "campo@correo.es",
      consentimientosComerciales: [{ canal: "correo", texto_version: "v1-2026-09" }],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe(
      "La versión del texto de consentimiento no está actualizada. Recarga la página."
    );
  });

  it("sin array ni booleano no es un error: no hay consentimiento", () => {
    const r = validarConsentimientosComerciales({
      origen: "post_diagnostico",
      email: "campo@correo.es",
    });
    expect(r).toEqual({
      ok: true,
      consentimientos: [],
      compatibilidad: false,
    });
  });

  it("rechaza mezclar el array nuevo con el booleano antiguo", () => {
    const r = validarConsentimientosComerciales({
      origen: "post_diagnostico",
      email: "campo@correo.es",
      consentimientosComerciales: [correo],
      consentimientoComercial: true,
    });
    expect(r.ok).toBe(false);
  });

  describe("compatibilidad con el payload antiguo", () => {
    it("mapea el informe a correo aunque haya teléfono", () => {
      const r = validarConsentimientosComerciales({
        origen: "post_diagnostico",
        email: "campo@correo.es",
        telefono: "600123456",
        consentimientoComercial: true,
      });
      expect(r.ok).toBe(true);
      expect(r.compatibilidad).toBe(true);
      expect(r.consentimientos).toEqual([
        { canal: "correo", texto_version: VERSION_CONSENTIMIENTO_LEGACY },
      ]);
    });

    it("mapea contacto directo a WhatsApp si hay teléfono", () => {
      const r = validarConsentimientosComerciales({
        origen: "contacto_directo",
        telefono: "600123456",
        consentimientoComercial: true,
      });
      expect(r.ok).toBe(true);
      expect(r.consentimientos).toEqual([
        { canal: "whatsapp", texto_version: VERSION_CONSENTIMIENTO_LEGACY },
      ]);
    });

    it("rechaza el legacy si falta el contacto de su canal", () => {
      const r = validarConsentimientosComerciales({
        origen: "post_diagnostico",
        telefono: "600123456",
        consentimientoComercial: true,
      });
      expect(r.ok).toBe(false);
      expect(r.error).toContain("correo");
    });
  });
});

describe("parsearConsentimientosComerciales", () => {
  const registro = {
    canal: "correo" as const,
    texto_version: "v2-2026-10",
    aceptado_en: "2026-10-23T10:00:00.000Z",
    origen: "post_diagnostico" as const,
    revocado_en: null,
  };

  it("acepta tanto objeto como cadena JSONB", () => {
    expect(parsearConsentimientosComerciales([registro])).toEqual([registro]);
    expect(parsearConsentimientosComerciales(JSON.stringify([registro]))).toEqual([
      registro,
    ]);
  });

  it("devuelve [] sin lanzar si el JSON está corrupto", () => {
    expect(parsearConsentimientosComerciales("{no es json")).toEqual([]);
    expect(parsearConsentimientosComerciales(null)).toEqual([]);
    expect(parsearConsentimientosComerciales([{ canal: "fax" }])).toEqual([]);
  });

  it("descarta una entrada corrupta y conserva las válidas", () => {
    expect(
      parsearConsentimientosComerciales([{ canal: "fax" }, registro])
    ).toEqual([registro]);
  });
});

describe("derivarConsentimientoAgregado", () => {
  const base = {
    texto_version: "v2-2026-10",
    origen: "post_diagnostico" as const,
    revocado_en: null,
  };

  it("con un solo canal activo rellena canal, versión y fecha", () => {
    const agregado = derivarConsentimientoAgregado([
      { ...base, canal: "correo", aceptado_en: "2026-10-23T10:00:00.000Z" },
    ]);
    expect(agregado).toEqual({
      consentimiento_comercial: true,
      consentimiento_comercial_fecha: "2026-10-23T10:00:00.000Z",
      consentimiento_texto_version: "v2-2026-10",
      canal_comercial: "correo",
    });
  });

  it("con varios canales deja canal_comercial en null", () => {
    const agregado = derivarConsentimientoAgregado([
      {
        ...base,
        canal: "correo",
        aceptado_en: "2026-10-23T10:00:00.000Z",
      },
      {
        ...base,
        canal: "whatsapp",
        aceptado_en: "2026-10-24T10:00:00.000Z",
      },
    ]);
    expect(agregado.canal_comercial).toBeNull();
    expect(agregado.consentimiento_comercial).toBe(true);
  });

  it("ignora los revocados y usa la fecha más antigua", () => {
    const agregado = derivarConsentimientoAgregado([
      {
        ...base,
        canal: "correo",
        aceptado_en: "2026-10-25T10:00:00.000Z",
      },
      {
        ...base,
        canal: "correo",
        aceptado_en: "2026-10-23T10:00:00.000Z",
        revocado_en: "2026-10-26T10:00:00.000Z",
      },
    ]);
    expect(agregado.consentimiento_comercial_fecha).toBe("2026-10-25T10:00:00.000Z");
    expect(agregado.consentimiento_comercial).toBe(true);
  });

  it("sin registros activos no hay consentimiento", () => {
    expect(derivarConsentimientoAgregado([])).toEqual({
      consentimiento_comercial: false,
      consentimiento_comercial_fecha: null,
      consentimiento_texto_version: null,
      canal_comercial: null,
    });
  });
});
