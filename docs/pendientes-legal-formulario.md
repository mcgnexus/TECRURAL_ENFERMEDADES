# Pendientes legales del formulario de revisión (para completar por Manuel)

Este informe registra lo que **falta y no debe inventarse** antes de promocionar el
formulario de solicitud de revisión. La aplicación no afirma por sí sola el cumplimiento
de la normativa de protección de datos: son necesarios estos contenidos y decisiones.

## 1. Identidad del responsable del tratamiento
- Facilitados: Manuel Carrasco García, DNI/NIF 76143911L, Barrio Los Reyes 113,
  18830 Huéscar (Granada), y correo `mcgnexus@gmail.com`.
- Incorporados en `/privacidad` y `/aviso-legal`. No consta designación de delegado de
  protección de datos.

## 2. Política de privacidad publicada
- Existe `/privacidad`, enlazada desde la casilla obligatoria de `LeadForm` y desde contacto.
- Incluye categorías de datos, finalidades, bases, derechos, destinatarios y conservación.

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
  (columna `leads.imagenes`). La política fija un máximo de 12 meses desde el envío y
  revisión manual mensual para borrarlas. El sistema todavía no automatiza esta tarea:
  el responsable debe establecer un recordatorio mensual y ejecutar/verificar la limpieza.

## 7. Aviso legal y cookies
- Se crearon `/aviso-legal` y `/cookies`.
- El código carga Google Analytics en producción si existe `NEXT_PUBLIC_GA_ID`, sin
  consentimiento previo. No activar esa configuración para tráfico sujeto a consentimiento
  hasta incorporar una solución de consentimiento; completar además inventario y duración.

## 8. Baja de comunicaciones
- Implementado: página `/baja` y endpoint `POST /api/baja` (baja por teléfono).
- Pendiente: decidir si además se quiere un canal manual (responder "BAJA" por
  WhatsApp) y documentarlo en la firma de los mensajes comerciales.
