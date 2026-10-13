import { afterEach, describe, expect, it, vi } from "vitest";
import { claveResultado, guardarResultado, obtenerResultado, vaciarCacheResultados } from "./resultado-cache";
import type { DiagnosticoResponse } from "@/types/diagnostico";

const resultado: DiagnosticoResponse = {
  organo_detectado: "hoja",
  especie_identificada: "olivo",
  confianza_identificacion: 0.7,
  diagnostico: { tipo: "enfermedad", nombre: "repilo", sintomas_observados: ["roya"], confianza: 0.6, gravedad: "leve" },
  estado_madurez: { aplica: false, estado: "no aplica", dias_estimados_cosecha: 0 },
  recomendacion: "Vigila.",
  requiere_experto: false,
};

describe("caché de resultado", () => {
  afterEach(() => { vaciarCacheResultados(); vi.useRealTimers(); });

  it("reutiliza una copia independiente para misma foto y contexto", () => {
    const key = claveResultado([{ base64: "abc", mimeType: "image/jpeg" }], { cultivo: "olivo" }, "uid");
    guardarResultado(key, { diagnostico: resultado, proveedor: "gemini" });
    const hit = obtenerResultado(key)!;
    hit.diagnostico.recomendacion = "mutado";
    expect(obtenerResultado(key)?.diagnostico.recomendacion).toBe("Vigila.");
  });

  it("separa foto/contexto y expira", () => {
    vi.useFakeTimers();
    const key = claveResultado([{ base64: "abc", mimeType: "image/jpeg" }], { cultivo: "olivo" }, "uid");
    expect(key).not.toBe(claveResultado([{ base64: "xyz", mimeType: "image/jpeg" }], { cultivo: "olivo" }, "uid"));
    expect(key).not.toBe(claveResultado([{ base64: "abc", mimeType: "image/jpeg" }], { cultivo: "vid" }, "uid"));
    guardarResultado(key, { diagnostico: resultado, proveedor: "gemini" });
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(obtenerResultado(key)).toBeUndefined();
  });
});
