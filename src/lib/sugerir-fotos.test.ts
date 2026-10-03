import { describe, it, expect } from "vitest";
import { debeSugerirEnves } from "./sugerir-fotos";

describe("debeSugerirEnves", () => {
  it("detecta plagas de envés con y sin tilde", () => {
    expect(debeSugerirEnves("Veo una araña roja en las hojas")).toBe(true);
    expect(debeSugerirEnves("parece un ácaro")).toBe(true);
    expect(debeSugerirEnves("parece un acaro")).toBe(true);
    expect(debeSugerirEnves("cochinilla algodonosa")).toBe(true);
    expect(debeSugerirEnves("minador de hojas")).toBe(true);
    expect(debeSugerirEnves("Insectos o plagas visibles")).toBe(true);
  });

  it("usa el texto libre de 'Otro' junto al valor del select", () => {
    expect(debeSugerirEnves("Otro / no lo sé", "he visto pulgones verdes")).toBe(true);
    expect(debeSugerirEnves("Otro / no lo sé", "el fruto se cae")).toBe(false);
  });

  it("detecta hongos que esporulan en el envés", () => {
    expect(debeSugerirEnves("moho gris debajo de la hoja")).toBe(true);
    expect(debeSugerirEnves("manchas como de mildiu")).toBe(true);
    expect(debeSugerirEnves("polvillo blanquecino")).toBe(true);
  });

  it("no sugiere para síntomas de fruto o generales", () => {
    expect(debeSugerirEnves("el fruto se cae antes de madurar")).toBe(false);
    expect(debeSugerirEnves("hojas amarillas")).toBe(false);
    expect(debeSugerirEnves("la planta va mal")).toBe(false);
  });

  it("tolera vacío y nulos", () => {
    expect(debeSugerirEnves(undefined)).toBe(false);
    expect(debeSugerirEnves(null)).toBe(false);
    expect(debeSugerirEnves("")).toBe(false);
  });
});
