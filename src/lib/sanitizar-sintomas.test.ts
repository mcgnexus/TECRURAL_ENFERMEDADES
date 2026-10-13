import { describe, expect, it } from "vitest";
import { sanitizarSintomas } from "./sanitizar-sintomas";

describe("sanitizarSintomas", () => {
  it("conserva términos válidos cortos y elimina genéricos y duplicados", () => {
    expect(sanitizarSintomas(["roya", "oídio", " manchas ", "roya", ""])).toEqual(["roya", "oídio"]);
  });

  it("limita la salida a ocho síntomas", () => {
    expect(sanitizarSintomas(Array.from({ length: 10 }, (_, i) => `síntoma ${i}`))).toHaveLength(8);
  });
});
