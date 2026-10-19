# Pendientes legales del formulario de revisión (para completar por Manuel)

Este informe registra lo que **falta y no debe inventarse** antes de promocionar el
formulario de solicitud de revisión. La aplicación no afirma por sí sola el cumplimiento
de la normativa de protección de datos: son necesarios estos contenidos y decisiones.

## 0. Entrega de tratamiento y dosis en el informe (nuevo, prioritario)
- La pantalla final ya no ofrece solo "revisar tu caso": entrega un **informe completo con
  tratamiento orientativo, dosis y plazo de seguridad**, y lo desbloquea a cambio del
  teléfono (imán suave). La app lo presenta como **sugerencia**, no como prescripción.
- Implementado en `src/lib/system-prompt.ts` (campo `tratamiento`) y
  `src/components/Results.tsx`; textos en `src/lib/textos-lead.ts`.
- **Riesgo a revisar con asesoría jurídica:** recomendar productos fitosanitarios y dosis
  puede considerarse asesoramiento/venta de fitosanitarios (RD 1311/2012 y normativa
  autonómica) y exige, según el caso, que lo emita un **asesor fitosanitario autorizado**.
  Antes de promocionarlo, decidir si basta el aviso actual ("orientativo") o si conviene que
  el informe lo firme/valide un técnico. No es asesoramiento legal.
- Si cambia el texto del aviso, revisar también el bloque "Aviso" de `Results.tsx` y el
  apartado "Tratamiento y límites legales" de `docs/flujo-app.md`.

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
- Resuelto: número configurado en el entorno de producción de Vercel
  (`NEXT_PUBLIC_TECRURAL_WHATSAPP`); `whatsappDisponible = true` y los botones de WhatsApp
  activos en sus flujos (post-formulario y post-diagnóstico).
- El número no se versiona en el repositorio: se deriva de la variable
  (`src/lib/contacto.ts`). No debe hardcodearse; se verifica en Vercel/CLI, no en el código.
- Si queda revisión legal del canal comercial, corresponde a §3 (consentimiento comercial),
  no a este apartado.

## 5. Plazos y compromisos de respuesta
- Decidido: la confirmación de envío compromete un plazo máximo de **48 horas naturales**
  desde el envío de la solicitud (horas corridas: incluye fines de semana y festivos).
  El texto vive en `LeadForm.tsx` (estado `ok`) y es común a los dos orígenes.
- Es un compromiso comercial firme: TecRural debe responder dentro de ese plazo.

## 6. Plazos de conservación y supresión de fotos
- Las fotos solo se almacenan cuando el usuario envía una solicitud de revisión
  (columna `leads.imagenes`). La política fija un máximo de 12 meses desde el envío y
  revisión manual mensual para borrarlas. El sistema todavía no automatiza esta tarea:
  el responsable debe establecer un recordatorio mensual y ejecutar/verificar la limpieza.

## 7. Aviso legal y cookies
- Se crearon `/aviso-legal` y `/cookies`.
- Decisión original: no usar Google Analytics ni cargar scripts de analítica de terceros. El
  embudo se mide con eventos first-party guardados en la tabla `eventos`; la página
  `/cookies` informa de esta práctica. Mantener revisado el inventario de almacenamiento
  técnico y las bases jurídicas de medición first-party.
- Actualización (2026-10-15): se instaló el **Meta Pixel** (ID 2175598836026526) en
  `src/components/MetaPixel.tsx`, cargado solo cuando el entorno es producción. `/cookies`
  y `/privacidad` (sección 6) se han actualizado para declararlo, y el test
  `src/app/analytics.test.ts` comprueba que solo aparece en producción y que Google
  Analytics sigue ausente.
- Pendiente: revisión legal de la base jurídica del píxel publicitario (el art. 22.2 LSSI
  y el RGPD suelen exigir consentimiento previo para cookies de publicidad). Valorar un
  banner de consentimiento o el cargado condicional del píxel tras aceptar. No es
  asesoramiento legal.

## 8. Baja de comunicaciones
- Implementado: página `/baja` y endpoint `POST /api/baja` (baja por teléfono).
- Pendiente: decidir si además se quiere un canal manual (responder "BAJA" por
  WhatsApp) y documentarlo en la firma de los mensajes comerciales.

## 9. Ampliación de cuota por teléfono (nuevo)
- Implementado: 2 análisis anónimos por semana móvil; al tercero la app ofrece
  6 análisis semanales a cambio del teléfono (`POST /api/cuota/telefono`).
  Solo se guarda un HMAC (`CUOTA_TELEFONO_SECRET`), vinculado al dispositivo y
  con expiración a 180 días; no se usa para contactar ni para publicidad, y no
  es una solicitud de revisión ni consentimiento comercial.
- Redactado (borrador): texto de la casilla en `src/app/page.tsx` y sección 9
  de `/privacidad`, que fija la finalidad (control de límites y prevención de
  abuso), la base de interés legítimo (art. 6.1.f RGPD), la minimización con
  HMAC, la no comunicación a los proveedores de IA y la conservación (180 días
  la huella, 31 días los usos con IP). Las secciones 2, 3, 5 y 7 se han
  ajustado para ser coherentes.
- Recomendación: validar la redacción con asesoría jurídica antes de
  promocionar el formulario. No es asesoramiento legal. Si cambia el texto de
  la casilla, revisar también la sección 9 para que no se contradigan.
