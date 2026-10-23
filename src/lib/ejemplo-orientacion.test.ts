import { describe, expect, it } from "vitest";
import { EJEMPLO_ORIENTACION } from "./ejemplo-orientacion";

/**
 * El ejemplo de la portada es una promesa visible: debe mostrar las cinco
 * partes acordadas, identificarse como ejemplo y no atribuir credenciales que
 * no podamos demostrar.
 */
describe("ejemplo de orientación", () => {
  it("incluye las cinco partes que el visitante debe poder entender", () => {
    expect(EJEMPLO_ORIENTACION.foto.src).toBeTruthy();
    expect(EJEMPLO_ORIENTACION.foto.alt.trim().length).toBeGreaterThan(10);
    expect(EJEMPLO_ORIENTACION.posiblesCausas.length).toBeGreaterThan(0);
    expect(EJEMPLO_ORIENTACION.queComprobar.length).toBeGreaterThan(0);
    expect(EJEMPLO_ORIENTACION.limitaciones.length).toBeGreaterThan(0);
    expect(EJEMPLO_ORIENTACION.cuandoPedirAyuda.trim().length).toBeGreaterThan(20);

    for (const causa of EJEMPLO_ORIENTACION.posiblesCausas) {
      expect(causa.nombre.trim()).not.toBe("");
      expect(causa.indicio.trim()).not.toBe("");
      expect(causa.certeza.trim()).not.toBe("");
    }
  });

  it("se identifica como ejemplo y no como caso de cliente", () => {
    expect(EJEMPLO_ORIENTACION.etiqueta).toBe("Ejemplo");
    expect(EJEMPLO_ORIENTACION.avisoNoCliente.toLowerCase()).toContain(
      "no es el caso de un cliente"
    );
  });

  it("no atribuye credenciales, titulaciones ni validaciones inexistentes", () => {
    const texto = JSON.stringify(EJEMPLO_ORIENTACION).toLowerCase();
    for (const prohibido of [
      "ingeniero",
      "ingeniera",
      "titulad",
      "colegiad",
      "certificad",
      "validado por",
      "años de experiencia",
      "máster",
      "master ",
      "grado en",
    ]) {
      expect(texto).not.toContain(prohibido);
    }
  });

  it("reconoce la limitación de una sola foto", () => {
    expect(EJEMPLO_ORIENTACION.limitaciones.join(" ").toLowerCase()).toContain(
      "una sola foto"
    );
  });
});
