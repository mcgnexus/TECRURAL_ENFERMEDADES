import { describe, it, expect } from "vitest";
import { propagarCalidadImagen, sugerenciaPorCalidad } from "./calidad-imagen";
import type { Observacion, CalidadImagen } from "./system-prompt";
import type { DiagnosticoResponse } from "@/types/diagnostico";

function diagBase(): DiagnosticoResponse {
  return {
    organo_detectado: "hoja",
    especie_identificada: "olivo",
    confianza_identificacion: 0.7,
    diagnostico: {
      tipo: "enfermedad",
      nombre: "Repilo",
      sintomas_observados: ["manchas circulares"],
      confianza: 0.6,
      gravedad: "moderada",
    },
    estado_madurez: { aplica: false, estado: "", dias_estimados_cosecha: 0 },
    recomendacion: "Vigilar la evolución.",
    requiere_experto: false,
  };
}

const CALIDAD_OK: CalidadImagen = {
  nitidez: "alta",
  iluminacion: "adecuada",
  encuadre: "adecuado",
};

const CALIDAD_BAJA: CalidadImagen = {
  nitidez: "baja",
  iluminacion: "deficiente",
  encuadre: "parcial",
};

function observacionCon(calidad: CalidadImagen) {
  return {
    organo_detectado: "hoja",
    parte_visible: "haz" as const,
    descripcion_hechos: ["manchas"],
    signos_presentes: [],
    distribucion_sintomas: "dispersas",
    calidad_imagen: calidad,
    observaciones_adicionales: "",
  };
}

describe("propagarCalidadImagen", () => {
  it("copia la calidad de la observación en el diagnóstico", () => {
    const d = diagBase();
    propagarCalidadImagen(d, observacionCon(CALIDAD_BAJA));
    expect(d.calidad_imagen).toEqual(CALIDAD_BAJA);
  });

  it("no hace nada si la observación no trae calidad", () => {
    const d = diagBase();
    propagarCalidadImagen(d, undefined);
    expect(d.calidad_imagen).toBeUndefined();
  });
});

describe("sugerenciaPorCalidad", () => {
  it("vacío si la foto está bien", () => {
    expect(sugerenciaPorCalidad(observacionCon(CALIDAD_OK))).toBe("");
  });

  it("sin observación devuelve vacío", () => {
    expect(sugerenciaPorCalidad(undefined)).toBe("");
  });

  it("menciona el consejo cuando la nitidez no es alta", () => {
    const obs = observacionCon({ ...CALIDAD_OK, nitidez: "media" });
    const nota = sugerenciaPorCalidad(observacionCon({ ...CALIDAD_OK, nitidez: "media" }));
    expect(nota).toContain("más nítida");
  });

  it("enumera encuadre e iluminación cuando fallan", () => {
    const nota = sugerenciaPorCalidad(
      observacionCon({ nitidez: "alta", iluminacion: "excesiva", encuadre: "parcial" })
    );
    expect(nota).toContain("encuadrado");
    expect(nota).toContain("luz");
  });

  it("no muta el diagnóstico: es solo texto (propagarCalidadImagen es la que cambia estado)", () => {
    expect(propagarCalidadImagen).toBeDefined();
    const d = diagBase();
    const antes = structuredClone(d);
    propagarCalidadImagen(d, observacionCon(CALIDAD_BAJA));
    expect(antes.calidad_imagen).toBeUndefined();
    expect(d.calidad_imagen).toBeDefined();
  });
});
