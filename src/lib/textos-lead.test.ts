import { describe, it, expect } from "vitest";
import { textosLead, avisoFotos } from "./textos-lead";

/**
 * Textos del formulario de solicitud.
 *
 * El motivo de estas pruebas: la página de contacto prometía llamada cuando el
 * formulario deja elegir WhatsApp, y el formulario hablaba de "las fotos del
 * análisis" en un flujo que no adjunta ninguna. Además, la variante posterior
 * al diagnóstico no se renderiza sin completar un análisis, así que aislarla
 * era la única forma de poder comprobarla.
 */

describe("contacto directo", () => {
  const t = textosLead("contacto_directo", 0);

  it("no promete llamada: el canal lo elige la persona", () => {
    const todo = JSON.stringify(t);
    expect(todo).not.toMatch(/te llamamos|te llamará/i);
    expect(t.cuerpoExito).toContain("canal que has indicado");
  });

  it("no menciona fotos ni orientación, porque no las hay", () => {
    const todo = JSON.stringify(t);
    expect(todo).not.toMatch(/foto/i);
    expect(todo).not.toMatch(/orientación/i);
  });

  it("habla del caso descrito", () => {
    expect(t.intro).toContain("Cuéntanos tu caso");
    expect(t.cabecera).toBe("Solicitar asesoramiento");
  });

  it("el consentimiento solo enumera los datos que se tratan", () => {
    expect(t.datosTratados).toBe("contacto, cultivo y municipio que nos indicas");
    expect(t.datosTratados).not.toMatch(/foto/i);
  });
});

describe("posterior al diagnóstico", () => {
  it("menciona la orientación y las fotos", () => {
    const t = textosLead("post_diagnostico", 1);
    expect(t.cuerpoExito).toContain("orientación y la foto del análisis");
    expect(t.cabecera).toBe("Solicitar revisión de TecRural");
  });

  it("concuerda en número: singular con una foto", () => {
    const t = textosLead("post_diagnostico", 1);
    expect(t.intro).toContain("y la foto del análisis");
    expect(t.intro).not.toContain("las fotos");
    expect(t.cuerpoExito).toContain("la foto del análisis");
  });

  it("concuerda en número: plural con varias", () => {
    const t = textosLead("post_diagnostico", 3);
    expect(t.intro).toContain("y las fotos del análisis");
    expect(t.cuerpoExito).toContain("las fotos del análisis");
  });

  it("el consentimiento enumera las fotos cuando las hay", () => {
    expect(textosLead("post_diagnostico", 1).datosTratados).toContain("las fotos que envías");
  });

  it("sin fotos no las enumera en el consentimiento", () => {
    expect(textosLead("post_diagnostico", 0).datosTratados).not.toMatch(/foto/i);
  });

  it("nunca impone un canal de contacto", () => {
    for (const n of [0, 1, 3]) {
      expect(textosLead("post_diagnostico", n).cuerpoExito).not.toMatch(/te llamamos|te llamará/i);
    }
  });
});

describe("avisoFotos", () => {
  it("no hay aviso si no hay fotos", () => {
    expect(avisoFotos(0)).toBeNull();
    expect(avisoFotos(-1)).toBeNull();
  });

  it("singular con una", () => {
    expect(avisoFotos(1)).toContain("la foto del análisis se compartirá");
  });

  it("plural con varias, con el número real", () => {
    expect(avisoFotos(3)).toContain("las 3 fotos del análisis se compartirán");
  });
});
