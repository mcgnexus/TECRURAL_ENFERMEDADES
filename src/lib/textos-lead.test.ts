import { describe, it, expect } from "vitest";
import { textosLead, avisoFotos } from "./textos-lead";

/**
 * Textos del formulario de solicitud.
 *
 * El motivo de estas pruebas: la página de contacto prometía llamada cuando el
 * formulario deja elegir WhatsApp, y el formulario hablaba de "las fotos del
 * análisis" en un flujo que no adjunta ninguna. Además, la variante posterior
 * al diagnóstico no se renderiza sin completar un análisis, así que aislarla
 * era la única forma de poder comprobarla. Ahora hay dos intenciones separadas
 * (guardar el informe y solicitar revisión) y cada confirmación debe decir
 * exactamente qué se ha registrado.
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

describe("posterior al diagnóstico: solo informe, sin envío configurado", () => {
  const t = textosLead("post_diagnostico", 1, "informe", false);

  it("pide el correo como contrapartida del informe", () => {
    expect(t.intro).toMatch(/correo/i);
    expect(t.intro).toMatch(/tratamiento/i);
    expect(t.intro).toMatch(/dosis/i);
    expect(t.cabecera).toBe("Abre el informe completo");
  });

  it("aclara que el informe se abre en pantalla y no se envía por correo", () => {
    expect(t.intro).toContain("se abre aquí mismo");
    expect(t.intro).toContain("no te lo enviamos");
  });

  it("menciona la ampliación del límite con el correo", () => {
    expect(t.intro).toContain("6 análisis cada 7 días");
    expect(t.cuerpoExito).toContain("6 análisis cada 7 días");
  });

  it("no promete revisión ni respuesta del técnico", () => {
    const todo = JSON.stringify(t);
    expect(todo).not.toMatch(/técnico.*revisará|te responderá|48 horas/i);
    expect(t.encabezadoExito).toBe("Informe guardado");
  });

  it("la confirmación dice que NO se ha registrado una revisión", () => {
    expect(t.cuerpoExito).toMatch(/No hemos registrado ninguna solicitud de revisión/i);
  });

  it("el consentimiento no enumera fotos, porque no se envían", () => {
    expect(t.datosTratados).not.toMatch(/foto/i);
    expect(t.datosTratados).toContain("el contacto que indicas");
  });

  it("el éxito no sugiere que el informe llegó por correo", () => {
    expect(t.cuerpoExito).toContain("No te hemos enviado nada por correo");
  });
});

describe("posterior al diagnóstico: solo informe, con envío configurado", () => {
  const t = textosLead("post_diagnostico", 1, "informe", true);

  it("menciona el enlace de recuperación sin adjuntar el informe", () => {
    expect(t.intro).toContain("enlace para recuperarlo");
    expect(t.intro).toContain("90 días");
    expect(t.intro).toContain("no te adjuntamos el informe");
    expect(t.intro).not.toContain("no te lo enviamos");
  });

  it("no promete que el correo haya llegado: remite al estado en pantalla", () => {
    expect(t.cuerpoExito).toContain("verás en esta pantalla si el envío se ha aceptado");
    expect(t.cuerpoExito).not.toMatch(/recibido|en tu bandeja/i);
  });
});

describe("posterior al diagnóstico: solicitud de revisión", () => {
  it("presenta la revisión como acción propia, opcional y sin coste", () => {
    const t = textosLead("post_diagnostico", 0, "revision");
    expect(t.cabecera).toContain("revisión");
    expect(t.intro).toMatch(/opcional y sin coste/i);
    expect(t.intro).toMatch(/48 horas/i);
    expect(t.encabezadoExito).toBe("Solicitud de revisión registrada");
  });

  it("menciona la orientación y las fotos", () => {
    const t = textosLead("post_diagnostico", 1, "revision");
    expect(t.cuerpoExito).toContain("la foto del análisis");
    expect(t.cuerpoExito).toContain("orientación");
  });

  it("confirma el canal elegido y que el informe también se abre", () => {
    const t = textosLead("post_diagnostico", 0, "revision");
    expect(t.cuerpoExito).toContain("por el canal que elegiste");
    expect(t.cuerpoExito).toMatch(/informe completo también se ha abierto/i);
  });

  it("concuerda en número: singular con una foto", () => {
    const t = textosLead("post_diagnostico", 1, "revision");
    expect(t.cuerpoExito).toContain("la foto del análisis");
    expect(t.cuerpoExito).not.toContain("las fotos");
  });

  it("concuerda en número: plural con varias", () => {
    const t = textosLead("post_diagnostico", 3, "revision");
    expect(t.cuerpoExito).toContain("las fotos del análisis");
  });

  it("sin fotos no las menciona en el éxito ni en el consentimiento", () => {
    const t = textosLead("post_diagnostico", 0, "revision");
    expect(t.cuerpoExito).not.toMatch(/foto/i);
    expect(t.datosTratados).not.toMatch(/foto/i);
  });

  it("el consentimiento enumera las fotos cuando las hay", () => {
    expect(textosLead("post_diagnostico", 1, "revision").datosTratados).toContain(
      "las fotos que envías"
    );
  });

  it("nunca impone un canal de contacto", () => {
    for (const n of [0, 1, 3]) {
      expect(textosLead("post_diagnostico", n, "revision").cuerpoExito).not.toMatch(
        /te llamamos|te llamará/i
      );
    }
  });

  it("sin envío configurado no promete el enlace", () => {
    const t = textosLead("post_diagnostico", 0, "revision", false);
    expect(t.intro).not.toContain("enlace para recuperar");
    expect(t.cuerpoExito).not.toContain("enlace de recuperación");
  });

  it("con envío configurado solo lo ofrece si se elige correo", () => {
    const t = textosLead("post_diagnostico", 0, "revision", true);
    expect(t.intro).toContain("Si eliges que te respondamos por correo");
    expect(t.cuerpoExito).toContain("Si elegiste correo");
    expect(t.cuerpoExito).not.toMatch(/te llamamos|te llamará/i);
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
