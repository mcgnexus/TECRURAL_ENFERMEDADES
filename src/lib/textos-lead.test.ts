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

describe("posterior al diagnóstico: solo informe (sin revisión)", () => {
  // La revisión es una opción aparte: quien solo abre el informe no recibe
  // promesas de respuesta de ningún técnico.
  const t = textosLead("post_diagnostico", 1, false);

  it("pide el correo como contrapartida del informe", () => {
    expect(t.intro).toMatch(/correo/i);
    expect(t.intro).toMatch(/tratamiento/i);
    expect(t.intro).toMatch(/dosis/i);
    expect(t.cabecera).toBe("Abre el informe completo");
  });

  it("aclara que el informe se abre en pantalla y no se envía por correo", () => {
    expect(t.intro).toContain("se abre aquí mismo");
    expect(t.intro).toContain("No te lo enviamos por correo");
  });

  it("menciona la ampliación del límite con el correo", () => {
    expect(t.intro).toContain("6 análisis cada 7 días");
    expect(t.cuerpoExito).toContain("6 análisis cada 7 días");
  });

  it("no promete revisión ni respuesta del técnico", () => {
    const todo = JSON.stringify(t);
    expect(todo).not.toMatch(/técnico.*revisará|te responderá|48 horas/i);
    expect(t.encabezadoExito).toBe("Informe completo abierto");
  });

  it("el consentimiento no enumera fotos, porque no se envían", () => {
    expect(t.datosTratados).not.toMatch(/foto/i);
    expect(t.datosTratados).toContain("el contacto que indicas");
  });

  it("apunta a la revisión como opción posterior, sin imponerla", () => {
    expect(t.cuerpoExito).toMatch(/si más adelante quieres/i);
  });

  it("el éxito no sugiere que el informe llegó por correo", () => {
    expect(t.cuerpoExito).toContain("No te hemos enviado nada por correo");
  });
});

describe("posterior al diagnóstico: informe y revisión técnica", () => {
  it("menciona la orientación y las fotos", () => {
    const t = textosLead("post_diagnostico", 1, true);
    expect(t.cuerpoExito).toContain("orientación y la foto del análisis");
    expect(t.cabecera).toBe("Abre el informe completo");
  });

  it("promete el informe con tratamiento y dosis", () => {
    const t = textosLead("post_diagnostico", 0, true);
    expect(t.intro).toMatch(/tratamiento/i);
    expect(t.intro).toMatch(/dosis/i);
    expect(t.cuerpoExito).toContain("informe abajo");
    expect(t.encabezadoExito).toBe("Informe abierto y revisión solicitada");
  });

  it("concuerda en número: singular con una foto", () => {
    const t = textosLead("post_diagnostico", 1, true);
    expect(t.intro).not.toContain("las fotos");
    expect(t.cuerpoExito).toContain("la foto del análisis");
  });

  it("concuerda en número: plural con varias", () => {
    const t = textosLead("post_diagnostico", 3, true);
    expect(t.cuerpoExito).toContain("las fotos del análisis");
  });

  it("sin fotos no las menciona en el éxito ni en el consentimiento", () => {
    const t = textosLead("post_diagnostico", 0, true);
    expect(t.cuerpoExito).not.toMatch(/foto/i);
    expect(t.datosTratados).not.toMatch(/foto/i);
  });

  it("el consentimiento enumera las fotos cuando las hay", () => {
    expect(textosLead("post_diagnostico", 1, true).datosTratados).toContain("las fotos que envías");
  });

  it("nunca impone un canal de contacto", () => {
    for (const n of [0, 1, 3]) {
      expect(textosLead("post_diagnostico", n, true).cuerpoExito).not.toMatch(/te llamamos|te llamará/i);
    }
  });

  it("la revisión se presenta como opción aparte, no como precio del informe", () => {
    const t = textosLead("post_diagnostico", 1, true);
    expect(t.intro).toMatch(/si quieres|marcas la revisión/i);
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
