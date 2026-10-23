import { describe, expect, it } from "vitest";
import {
  CONTEXTO_INICIAL,
  VALOR_NO_LO_SE,
  VALOR_OTRO,
  cultivoSeleccionado,
} from "./contexto-cultivo";

/**
 * Gating del botón de análisis: sin un cultivo utilizable no se analiza.
 * La pantalla no es un `<form>`, así que el `required` del select no bloquea
 * nada por sí solo; esta función es la regla real y por eso se prueba.
 */
describe("cultivoSeleccionado", () => {
  it("sin cultivo no se puede analizar", () => {
    expect(cultivoSeleccionado(CONTEXTO_INICIAL)).toBe(false);
  });

  it("un cultivo de la lista vale", () => {
    expect(cultivoSeleccionado({ ...CONTEXTO_INICIAL, cultivo: "Aguacate" })).toBe(true);
  });

  it("«no lo sé» es una respuesta válida", () => {
    expect(
      cultivoSeleccionado({ ...CONTEXTO_INICIAL, cultivo: VALOR_NO_LO_SE })
    ).toBe(true);
  });

  it("«otro» exige que se escriba el cultivo", () => {
    const sinTexto = { ...CONTEXTO_INICIAL, cultivo: VALOR_OTRO, cultivoOtro: "   " };
    expect(cultivoSeleccionado(sinTexto)).toBe(false);
    expect(cultivoSeleccionado({ ...sinTexto, cultivoOtro: "Níspero" })).toBe(true);
  });
});
