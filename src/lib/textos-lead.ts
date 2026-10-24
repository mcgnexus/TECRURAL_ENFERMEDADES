/**
 * Textos del formulario de solicitud, según el origen y la intención.
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
 * En el flujo posterior al diagnóstico hay dos intenciones separadas que no se
 * mezclan: guardar el informe (basta un correo) y solicitar que un técnico
 * revise el caso (se elige canal y es la única que promete respuesta). Cada una
 * tiene su propio formulario y su propia confirmación, que dice exactamente qué
 * se ha registrado.
 *
 * El informe siempre se abre en pantalla. Si la entrega por correo está
 * configurada, se envía además un enlace de recuperación; los textos solo lo
 * mencionan cuando `envioCorreo` es true, porque sin RESEND_API_KEY la función
 * no existe y prometerla sería falso. "Enviado" solo se dice tras la aceptación
 * de Resend; la confirmación nunca afirma que haya llegado al buzón.
 */

export type ModoLead = "informe" | "revision";

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
  modo: ModoLead = "informe",
  envioCorreo = false
): TextosLead {
  const directo = origen === "contacto_directo";
  const fotos = Math.max(0, Math.trunc(numeroFotos));

  // El canal lo elige el usuario en el formulario, así que ningún texto puede
  // dar por hecho que se le va a llamar.
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
  const fotosEnCuerpo = fotos > 0 ? ` con ${fotosTxt}` : "";

  if (modo === "revision") {
    // Revisión técnica: es la única intención que registra una solicitud de
    // contacto y la única que promete respuesta. El canal lo elige la persona
    // en el propio formulario.
    return {
      cabecera: "Solicitar la revisión de un técnico",
      intro:
        "Elige cómo prefieres que te respondamos y déjanos ese contacto. Registraremos tu solicitud de revisión con la orientación del análisis y un técnico te responderá en un máximo de 48 horas. Es opcional y sin coste. El informe completo se abrirá también en esta pantalla." +
        (envioCorreo
          ? " Si eliges que te respondamos por correo, te enviaremos además un enlace para recuperar el informe, válido 90 días."
          : ""),
      encabezadoExito: "Solicitud de revisión registrada",
      cuerpoExito: `Hemos registrado la solicitud de revisión de este caso${fotosEnCuerpo}, junto con la orientación del análisis. Un técnico de TecRural te responderá en un máximo de 48 horas por el canal que elegiste. El informe completo también se ha abierto en esta pantalla.` +
        (envioCorreo
          ? " Si elegiste correo, el enlace de recuperación se envía aparte: verás en esta pantalla si el envío se ha aceptado y podrás reintentarlo."
          : ""),
      // El consentimiento enumera los datos que de verdad se tratan: sostiene
      // el consentimiento, así que no puede mencionar fotos que no se envían.
      datosTratados:
        fotos > 0
          ? "contacto, cultivo, municipio, la orientación del análisis y las fotos que envías"
          : "contacto, cultivo, municipio y la orientación del análisis",
    };
  }

  // Solo informe: no se promete respuesta de ningún técnico. El correo sirve
  // para mostrar el informe y ampliar el límite semanal, nunca para contactar.
  return {
    cabecera: "Abre el informe completo",
    intro:
      "Escribe tu correo y el informe se abre aquí mismo, en esta pantalla: la pauta orientativa (tratamiento, dosis y plazo de seguridad) cuando proceda, y el PDF descargable. " +
      (envioCorreo
        ? "También te enviaremos un enlace para recuperarlo cuando quieras, válido 90 días; no te adjuntamos el informe ni lo usamos para publicidad."
        : "Usamos el correo solo para mostrarte el informe y ampliar tu límite a 6 análisis cada 7 días; no te lo enviamos ni lo usamos para contactarte."),
    encabezadoExito: "Informe guardado",
    cuerpoExito:
      "El informe ya está abierto en esta pantalla y puedes descargarlo en PDF. Tu límite es ahora de 6 análisis cada 7 días. No hemos registrado ninguna solicitud de revisión. " +
      (envioCorreo
        ? "El enlace de recuperación se envía aparte: verás en esta pantalla si el envío se ha aceptado y podrás reintentarlo."
        : "No te hemos enviado nada por correo."),
    datosTratados: "el contacto que indicas y la orientación del análisis",
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
