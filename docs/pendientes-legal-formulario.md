# Pendientes legales del formulario de revisión (para completar por Manuel)

Este informe registra lo que **falta y no debe inventarse** antes de promocionar el
formulario de solicitud de revisión. La aplicación no afirma por sí sola el cumplimiento
de la normativa de protección de datos: son necesarios estos contenidos y decisiones.

## 1. Identidad del responsable del tratamiento
- Facilitado: correo de contacto `mcgnexus@gmail.com`.
- Falta: razón social / nombre del responsable, NIF y domicilio de contacto
  (y del delegado de protección de datos si se designa).
- Dónde haría falta: textos de los formularios (`LeadForm`), página de contacto y
  futura política de privacidad.

## 2. Política de privacidad publicada
- Falta: página/URL de política de privacidad del proyecto (no existe en el repositorio).
- Los formularios actuales incluyen resúmenes breves de finalidad, pero deben enlazar a
  la política completa cuando exista (añadir enlace en `src/components/LeadForm.tsx` y
  `src/app/contacto/page.tsx`).

## 3. Texto del consentimiento comercial
- Implementado: casilla opcional, desmarcada por defecto, con versión registrada
  (`v1-2026-09`) en la base de datos.
- Pendiente: revisión legal de la redacción exacta y del canal (actualmente "WhatsApp"),
  y decisión sobre el organismo/ley aplicable si se opera fuera de España.
- Si se cambia el texto, actualizar `TEXTO_COMERCIAL_VERSION`
  (`src/app/api/leads/route.ts`) para poder auditar qué versión aceptó cada contacto.

## 4. Canal oficial de contacto
- Falta: número oficial de WhatsApp (`NEXT_PUBLIC_TECRURAL_WHATSAPP`). Los botones de
  WhatsApp permanecen ocultos hasta configurarlo. No se ha inventado ningún número.

## 5. Plazos y compromisos de respuesta
- La confirmación de envío indica deliberadamente que **no se compromete un plazo**
  concreto. Si TecRural quiere prometer un plazo (p. ej. "48 h laborables"), debe
  definirse internamente y actualizarse el texto de confirmación en `LeadForm.tsx`.

## 6. Plazos de conservación y supresión de fotos
- Las fotos solo se almacenan cuando el usuario envía una solicitud de revisión
  (columna `leads.imagenes`). Pendiente de definir: plazo de conservación de esas fotos
  y proceso de supresión (actualmente manual sobre la base de datos).

## 7. Baja de comunicaciones
- Implementado: página `/baja` y endpoint `POST /api/baja` (baja por teléfono).
- Pendiente: decidir si además se quiere un canal manual (responder "BAJA" por
  WhatsApp) y documentarlo en la firma de los mensajes comerciales.
