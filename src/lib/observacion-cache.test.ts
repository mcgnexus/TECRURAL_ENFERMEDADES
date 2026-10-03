import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claveObservacion,
  obtenerObservacion,
  guardarObservacion,
  vaciarCache,
} from "./observacion-cache";
import type { Observacion } from "./system-prompt";

const IMAGEN = { base64: "AAAA", mimeType: "image/webp" };
const IMAGEN2 = { base64: "BBBB", mimeType: "image/jpeg" };

const OBSERVACION: Observacion = {
  organo_detectado: "hoja",
  parte_visible: "haz",
  descripcion_hechos: ["manchas"],
  signos_presentes: [],
  distribucion_sintomas: "dispersas",
  calidad_imagen: { nitidez: "alta", iluminacion: "adecuada", encuadre: "adecuado" },
  observaciones_adicionales: "",
};

afterEach(() => {
  vaciarCache();
  vi.useRealTimers();
});

describe("claveObservacion", () => {
  it("misma imagen y proveedor → misma clave", () => {
    expect(claveObservacion("gemini", [IMAGEN])).toBe(claveObservacion("gemini", [IMAGEN]));
  });

  it("distinto proveedor → distinta clave", () => {
    expect(claveObservacion("gemini", [IMAGEN])).not.toBe(claveObservacion("deepseek", [IMAGEN]));
  });

  it("distintas imágenes → distinta clave", () => {
    expect(claveObservacion("gemini", [IMAGEN])).not.toBe(claveObservacion("gemini", [IMAGEN2]));
  });

  it("mismo contenido con distinto mimeType → distinta clave", () => {
    expect(claveObservacion("gemini", [{ base64: "AAAA", mimeType: "image/webp" }])).not.toBe(
      claveObservacion("gemini", [{ base64: "AAAA", mimeType: "image/jpeg" }])
    );
  });
});

describe("obtenerObservacion / guardarObservacion", () => {
  it("guarda y recupera la observación", () => {
    const clave = claveObservacion("gemini", [IMAGEN]);
    guardarObservacion(clave, OBSERVACION);
    expect(obtenerObservacion(clave)).toEqual(OBSERVACION);
  });

  it("sin guardar no hay nada", () => {
    expect(obtenerObservacion(claveObservacion("gemini", [IMAGEN]))).toBeUndefined();
  });

  it("caduca a los 15 minutos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    const clave = claveObservacion("gemini", [IMAGEN]);
    guardarObservacion(clave, OBSERVACION);
    vi.setSystemTime(new Date("2026-01-01T10:14:00Z"));
    expect(obtenerObservacion(clave)).toEqual(OBSERVACION);
    vi.setSystemTime(new Date("2026-01-01T10:16:00Z"));
    expect(obtenerObservacion(clave)).toBeUndefined();
  });
});
