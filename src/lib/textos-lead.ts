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
 *
 * En el flujo posterior al diagnóstico hay dos intenciones que no se mezclan:
 * desbloquear el informe (basta un correo) y solicitar que un técnico revise
 * el caso (opción aparte, que es la única que promete respuesta). El texto del
 * éxito depende de cuál se haya marcado.
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
  numeroFotos = 0,
  solicitaRevision = true
): TextosLead {
  const directo = origen === "contacto_directo";
  const fotos = Math.max(0, Math.trunc(numeroFotos));

  // El canal lo elige el usuario en el formulario, así que ningún texto puede
  // dar por hecho que se le va a llamar. Si solo deja correo, el formulario
  // fuerza el canal "correo".
  const canal = "te contactará por el canal que has indicado (llamada, WhatsApp o correo)";

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

  if (!solicitaRevision) {
    // Solo informe: no se promete respuesta de ningún técnico, porque no se ha
    // pedido revisión. El contacto sirve para el informe y el límite semanal.
    return {
      cabecera: "Recibe el informe completo",
      intro: "Escribe tu correo y verás al momento el informe completo: el tratamiento orientativo con su dosis, el momento de aplicación y qué foto confirma el diagnóstico. Con tu correo amplías también el límite a 6 análisis semanales.",
      encabezadoExito: "Informe completo desbloqueado",
      cuerpoExito: "Ya tienes aquí abajo el informe completo con el tratamiento y la dosis, listo para descargar en PDF. Si más adelante quieres que un técnico revise tu caso, puedes solicitarlo en cualquier momento.",
      // Sin revisión no se envían fotos, así que el consentimiento no puede
      // mencionarlas aunque el análisis tuviera varias.
      datosTratados: "el contacto que indicas y la orientación del análisis",
    };
  }

  return {
    cabecera: "Recibe el informe completo",
    intro: "Escribe tu correo y verás al momento el informe completo: el tratamiento orientativo con su dosis, el momento de aplicación y qué foto confirma el diagnóstico. Con tu correo amplías también el límite a 6 análisis semanales. Si quieres, marcas la revisión y un técnico revisa este caso contigo.",
    encabezadoExito: "Informe completo desbloqueado y revisión solicitada",
    cuerpoExito: `Ya tienes aquí abajo el informe completo con el tratamiento y la dosis, listo para descargar en PDF. Hemos registrado tu caso junto con la orientación${fotos > 0 ? ` y ${fotosTxt}` : ""}; un técnico de TecRural lo revisará y ${canal}.`,
    // El consentimiento enumera los datos que de verdad se tratan: sostiene el
    // consentimiento, así que no puede mencionar fotos que no se envían.
    datosTratados:
      fotos > 0
        ? "contacto, cultivo, municipio y las fotos que envías"
        : "contacto, cultivo, municipio y la orientación del análisis",
  };
}

/**
 * Aviso de las fotos que se compartirán, solo cuando hay revisión con fotos.
 * Sin revisión las fotos no se envían, así que no hay nada que avisar.
 */
export function avisoFotos(numeroFotos: number): string | null {
  if (numeroFotos <= 0) return null;
  return numeroFotos === 1
    ? "Al enviar, la foto del análisis se compartirá con el técnico para la revisión. No se usan para ningún otro fin."
    : `Al enviar, las ${numeroFotos} fotos del análisis se compartirán con el técnico para la revisión. No se usan para ningún otro fin.`;
}
