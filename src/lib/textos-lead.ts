/**
 * Textos del formulario de solicitud, según el origen.
 *
 * Están aquí, y no incrustados en el componente, por dos motivos:
 *
 * 1. El flujo de contacto directo y el posterior al diagnóstico no son el
 *    mismo, y mezclarlos produjo incoherencias visibles: la página de contacto
 *    prometía llamada cuando el formulario deja elegir WhatsApp, y el
 *    formulario hablaba de "las fotos del análisis" en un flujo que no adjunta
 *    ninguna.
 *
 * 2. Al ser texto plano y sin React, se puede comprobar con una prueba. Es la
 *    única forma de revisar la variante posterior al diagnóstico, que no se
 *    renderiza sin completar un análisis antes.
 */

export interface TextosLead {
  cabecera: string;
  intro: string;
  encabezadoExito: string;
  cuerpoExito: string;
  datosTratados: string;
}

export function textosLead(
  origen: "post_diagnostico" | "contacto_directo",
  numeroFotos = 0
): TextosLead {
  const directo = origen === "contacto_directo";
  const fotos = Math.max(0, Math.trunc(numeroFotos));

  // El canal lo elige el usuario en el formulario, así que ningún texto puede
  // dar por hecho que se le va a llamar.
  const canal = "te contactará por el canal que has indicado (llamada o WhatsApp al número facilitado)";

  if (directo) {
    return {
      cabecera: "Solicitar asesoramiento",
      intro: "Cuéntanos tu caso y un técnico lo revisará contigo.",
      encabezadoExito: "Solicitud enviada",
      cuerpoExito: `Hemos registrado tu caso. Un técnico de TecRural lo revisará y ${canal}.`,
      datosTratados: "contacto, cultivo y municipio que nos indicas",
    };
  }

  const singular = fotos === 1;
  const fotosTxt = singular ? "la foto del análisis" : "las fotos del análisis";

  return {
    cabecera: "Solicitar revisión de TecRural",
    intro: `Con tus datos y ${fotosTxt}, un técnico revisará este caso contigo.`,
    encabezadoExito: "Solicitud de revisión enviada",
    cuerpoExito: `Hemos registrado tu caso junto con la orientación y ${fotosTxt}. Un técnico de TecRural lo revisará y ${canal}.`,
    // El consentimiento enumera los datos que de verdad se tratan: sostiene el
    // consentimiento, así que no puede mencionar fotos que no se envían.
    datosTratados:
      fotos > 0
        ? "contacto, cultivo, municipio y las fotos que envías"
        : "contacto, cultivo, municipio y la orientación del análisis",
  };
}

/** Aviso de las fotos que se compartirán, solo cuando las hay. */
export function avisoFotos(numeroFotos: number): string | null {
  if (numeroFotos <= 0) return null;
  return numeroFotos === 1
    ? "Al enviar, la foto del análisis se compartirá con el técnico para la revisión. No se usan para ningún otro fin."
    : `Al enviar, las ${numeroFotos} fotos del análisis se compartirán con el técnico para la revisión. No se usan para ningún otro fin.`;
}
