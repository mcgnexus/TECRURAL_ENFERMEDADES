# TECRURAL Diagnóstico

PWA de orientación fitosanitaria para agricultores del Altiplano de Granada y la Costa Tropical: foto del cultivo → hipótesis de orientación por IA (Gemini 2.5 Flash con respaldo multimodal opcional OpenAI `gpt-4o-mini`) → orientación inicial gratuita y, al dejar un correo, informe completo con tratamiento orientativo y un enlace de recuperación válido 90 días (el teléfono queda para quien pide la revisión de un técnico).

## Flujo de usuario

Resumen ampliado, decisiones de identificación y reglas de cuota: [`docs/flujo-app.md`](docs/flujo-app.md).

1. **Portada**: explica el servicio (orientación inicial, no diagnóstico definitivo; foto clara; revisión de TecRural como siguiente paso) y el botón «Analizar una planta».
2. **Cultivo**: lo primero de la pantalla de captura, junto a los botones de foto. Selector con "Otro"/"No lo sé". Municipio o comarca (Altiplano/Costa Tropical + "Otro"), síntoma observado, desde cuándo y variedad viven en un desplegable **opcional** cerrado por defecto: afinan la orientación pero no bloquean el envío. Sin GPS.
3. **Fotos**: modo simple por defecto (1 foto nítida del síntoma). Modo avanzado opcional añade envés y planta completa. Vista previa, reemplazo y eliminación por foto. Validación de tipo real (magic bytes), tamaño (≤12 MB) y formato en frontend y backend. Compresión a JPEG/WebP ~1536px/1MB (elimina EXIF y optimiza móvil manteniendo detalle para manchas y síntomas pequeños).
4. **Análisis**: botón «Analizar foto» cuando la imagen está lista; desactivado hasta elegir cultivo (incluida la opción «No lo sé»). Estados de espera claros sin porcentajes falsos; datos y fotos se conservan si hay error; reintentos permitidos. Errores amigables (red, límite de uso, proveedor, imagen no interpretable, servicio caído) sin trazas ni claves.
5. **Resultado**: la parte gratuita tiene utilidad propia y se muestra completa antes del muro: qué se observa; otras causas posibles como hipótesis; qué faltaría para afinar (incluida, si existe, una segunda foto que aportaría información adicional, sin prometer que confirma); qué comprobar ahora (próximos pasos prudentes, con texto de respaldo si el modelo no los devuelve); y un bloque fijo de «¿Cuándo conviene que lo vea una persona?». Después se ofrecen **dos acciones independientes**: *abrir el informe completo* (solo pide correo y explica que se usa para mostrarlo, ampliar el límite y enviar el enlace de recuperación, nunca para contactar) y *solicitar la revisión de un técnico* (se elige canal —WhatsApp, correo o llamada, sin preselección— y se pide el dato de ese canal). Cualquiera de las dos abre el informe en pantalla; si se dejó un correo, se envía además un enlace de recuperación (solo el enlace, nunca el contenido clínico) y la pantalla muestra por separado si Resend lo aceptó o si hay que reintentar. La revisión sigue disponible después de guardar el informe. El informe incluye la pauta orientativa cuando procede (materia activa, dosis en rango, momento de aplicación y plazo de seguridad) y el PDF; si la foto no permite proponer pauta, lo dice y ofrece seguimiento. Confirmaciones explícitas de qué se ha registrado. Aviso visible de que es orientativo y de que la IA no sustituye una inspección profesional. Fiabilidad mostrada cualitativamente (señales claras / indicios moderados / señales poco claras), sin porcentajes no calibrados. Guardable en PDF y compartible (Web Share API con fallback a portapapeles).
6. **Informe y revisión, por separado**: guardar el informe no registra ninguna solicitud de revisión (`solicitud_respuesta: false`), y solicitarla es una acción aparte con su propio formulario que sí registra la solicitud de contacto con el canal elegido y las fotos. Las novedades comerciales son un opt-in voluntario por correo, separado de ambos servicios: rechazarlas no bloquea nada. Si se usan las dos acciones, quedan dos leads vinculados por `diagnostico_id`.

### Correo del informe

- El envío se dispara al guardar un lead con correo (acción "Abrir el informe") o al pedir revisión con canal correo. Nunca con teléfono/WhatsApp.
- El correo solo transporta `https://<sitio>/informe/<token>`; no adjunta el informe ni menciona patología, materia activa o dosis.
- Token de 32 bytes, guardado solo como SHA-256, válido 90 días y multiuso. Un token nuevo invalida el anterior.
- Límites: 3/24 h por diagnóstico, 10/7 días por correo y 30/24 h por IP; el automático se dispara una vez por lead y el resto son reenvíos manuales.
- Solo un 2xx de Resend **con `id`** cuenta como aceptado. Entrega ≠ recepción: los textos dicen "enviado" y avisan de la posible errata en el correo.
- Sin `RESEND_API_KEY`/`RESEND_FROM` la UI no promete el envío y el endpoint responde `no_disponible`.

## Arquitectura

- **Next.js 16 (App Router) + React 19 + Tailwind v4**, PWA con `next-pwa`.
- **IA (solo servidor, claves nunca en el cliente):**
  - `src/lib/gemini.ts` — pipeline de 4 capas: observación → hipótesis (few-shots por cultivo) → verificación adversarial de la foto relevante → reintento. Acepta varias fotos (principal + envés + planta completa), limita cada llamada a 45 s y comparte un deadline de 105 s con el fallback.
  - `src/lib/openai.ts` — respaldo multimodal `gpt-4o-mini`, solo activo con `OPENAI_API_KEY`. DeepSeek Chat no se usa como respaldo visual porque no admite imágenes.
  - Las fases llegan al cliente por NDJSON para mostrar progreso real. Observación y resultado final tienen cachés efímeras en memoria por instancia; no almacenan fotos.
  - `src/lib/system-prompt.ts` — prompts (hipótesis + tratamiento orientativo con salvaguardas), esquemas y ejemplos.
  - Selección automática Gemini → OpenAI; el proveedor usado se registra en BD para comparar coste y calidad. El deadline total es compartido entre fases y proveedores.
- **Base de datos:** Neon Postgres serverless (`src/lib/database.ts`). Tablas:
  - `diagnosticos` — hipótesis y contexto. Las fotos NO se guardan por defecto (política de datos); solo en el lead si el usuario pide revisión.
  - `leads` — solicitudes de revisión cualificadas, consentimientos y fotos compartidas; el correo en claro permite entregar el enlace de recuperación.
  - `enlaces_informe` — token hasheado, caducidad a 90 días, último acceso y contador. Solo se guarda SHA-256; la caducidad se filtra al leer.
  - `cuota_usos` / `cuota_telefonos` — límites de uso con **ventana móvil real** (conteo por marcas de tiempo, sin corte a medianoche). El teléfono solo se guarda como HMAC (`CUOTA_TELEFONO_SECRET`), nunca en claro, y expira a los 180 días; los registros de uso se purgan a los 31 días.
- **Cuotas de análisis:** 1 análisis sin datos en cualquier periodo de 7 días. Después, la app pide el contacto en la propia pantalla del resultado: el correo desbloquea el informe completo y amplía a **6 análisis semanales** (solo límite, sin contacto ni publicidad); no es una solicitud de revisión ni consiente comunicaciones. Se añaden un tope global de 500/24 h y un **límite complementario por conexión (IP) de 12/24 h** contra el abuso. El conteo es atómico (advisory locks) y si la base no responde el análisis se rechaza con 503 en lugar de ejecutarse sin límite.
- **Validación:** coherencia del JSON, saneado de síntomas, `requiere_experto` automático, magic bytes de imágenes (`src/lib/imagen.ts`).

## Leads, consentimientos y baja

- **API:** `POST /api/leads` (zod, honeypot, rate limit 5/h por IP, `solicitud_respuesta` booleana: false = solo informe, sin fotos ni solicitud de contacto), `POST /api/informe/envio` (envío/reenvío del enlace; cuerpo solo `{ diagnosticoId }`, destinatario leído del lead y propiedad comprobada por cookie), `GET /api/informe/envio` (disponibilidad), `POST /api/cuota/contacto` (ampliación semanal con correo o teléfono, guardado solo como HMAC), `GET /api/leads` (listado, `?metricas=1`, `?accesos=1` y `?diagnosticos=1`), `PATCH /api/leads` (cambio de estado y notas) y `DELETE /api/leads` (borrado definitivo), todos salvo el POST protegidos con `ADMIN_TOKEN` (header `x-admin-token`).
- **Registro comercial** (`leads`): fecha de creación, origen (diagnóstico / contacto directo), municipio, cultivo, **síntoma** observado, **canal de contacto solicitado** (llamada / WhatsApp), **estado comercial** (`nuevo → contactado → cualificado → presupuesto → ganado / perdido`), prioridad cualificada en servidor, consentimiento comercial (estado, fecha, versión del texto y canal), **origen de campaña y parámetros UTM** (`utm_source/medium/campaign/content/term`, capturados del enlace de entrada y guardados en sesión) e **identificador del diagnóstico** (sin almacenar la imagen por defecto).
- **Consentimientos separados:**
  - Gestionar la solicitud de revisión: implícito al enviar (confirmado con casilla obligatoria).
  - Comunicaciones comerciales: opcional, desmarcado; se guardan estado, fecha, versión del texto (`TEXTO_COMERCIAL_VERSION`, actualmente `v1-2026-09`) y canal (`whatsapp`).
- **Baja:** página `/baja` + `POST /api/baja` marcan `baja_comercial=true` y anulan el consentimiento comercial del teléfono indicado.
- **Gestión comercial:** `/admin` es un panel interno con cuatro pestañas.
  - **Resumen:** KPIs (visitas, conversión, tiempo de respuesta, consumo de IA…) y gráficos interactivos con Recharts: tendencia 7/30/90 días, embudo, donut de estados, barras de prioridad/origen, ranking de zonas y cultivos, campañas/UTM y mapa de calor hora×día. Al pulsar un segmento se salta a la pestaña de leads ya filtrada (drill-down).
  - **Leads:** tabla ordenable por fecha, puntuación, prioridad, estado, nº de fotos, tiempo de respuesta, zona y cultivo; búsqueda libre, filtros (estado, prioridad, origen, campaña, zona, cultivo, canal y rango de fechas) y paginación. Se puede cambiar el estado, guardar notas y **borrar** leads (individual o en lote), con confirmación por texto porque el borrado es definitivo e incluye las fotos.
  - **Diagnósticos:** cada análisis con su **resultado** (tipo, enfermedad o plante, gravedad, confianza, recomendación y diferenciales) y su estado real: una fila solo existe si el análisis **terminó bien**; los fallos quedan solo en los eventos, que la pestaña muestra aparte («iniciaron análisis» y «errores»). Filtros por tipo, gravedad, proveedor, `requiere_experto`, feedback y rango de fechas, con fila desplegable para leer el resultado completo.
  - **Accesos:** visitas anónimas, embudo diario e IPs enmascaradas (rate-limit).
  - Pide el `ADMIN_TOKEN` (se guarda solo en la sesión de la pestaña, nunca en el código ni en el frontend empaquetado). Las fotos adjuntas a la revisión se ven desde la propia tabla: columna **Fotos**, con miniaturas que abren a tamaño completo. Se sirven por `GET /api/leads/fotos?lead=<id>&indice=<n>`, protegida con `x-admin-token` y con `Cache-Control: no-store`. El listado nunca incluye las imágenes, solo su número.
- **Cualificación en servidor** (`src/lib/leads.ts`): gravedad, `requiere_experto` y hectáreas → prioridad alta/media/baja. Umbrales ajustables.
- **WhatsApp:** solo con `NEXT_PUBLIC_TECRURAL_WHATSAPP` configurada. Nunca hardcodeado.

## ⚠ Pendientes legales antes de promocionar el formulario

Ver `docs/pendientes-legal-formulario.md`: identidad del responsable, política de privacidad publicada y revisión del texto de consentimiento. No se han inventado estos datos.

## Migraciones

El esquema se aplica con `npm run db:migrate` (idempotente: `CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN IF NOT EXISTS`; **nunca borra filas**). Ejecútalo como paso de despliegue, no desde las peticiones: las rutas ya no llaman a `initDatabase()`. Historial en `db/migrations/` (`0001` a `0013`). Las operaciones puntuales sobre datos, que exigen decisión humana, están en `db/one-off/`.

## Variables de entorno

Ver `.env.example`: `DATABASE_URL`, `GEMINI_API_KEY`, `OPENAI_API_KEY` (fallback multimodal opcional), `DEEPSEEK_API_KEY`, `RESEND_API_KEY` y `RESEND_FROM` (servidor; sin ellos no hay envío del enlace), `RESEND_REPLY_TO` (opcional); `NEXT_PUBLIC_TECRURAL_WHATSAPP`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_TOKEN`, `CUOTA_TELEFONO_SECRET` (opcionales; el secreto de cuota es necesario para la ampliación semanal por contacto).

## Analítica de conversión

`src/lib/analitica.ts` emite los eventos del embudo: `portada_vista` → `captura_realizada` → `analisis_iniciado` → `analisis_completado` → `resultado_visto` → `cta_revision_abierto` → `informe_desbloqueado` → `lead_enviado` (más `informe_pdf`, `analisis_error`, `lead_error`, `informe_envio_aceptado`/`informe_envio_fallido`, `whatsapp_click` y `ejemplo_visto`, este último informativo y **fuera del embudo**, para no confundir la consulta del ejemplo con un análisis real). `cta_revision_abierto`, `informe_desbloqueado` y `lead_enviado` incluyen el parámetro `intencion` (`informe` o `revision`) para separar las dos acciones del resultado; `cta_revision_abierto` se conserva como "empezó a rellenar el formulario" aunque ahora cubra ambas. No se carga Google Analytics: los eventos del embudo permanecen en first party. El único script de terceros es el **Meta Pixel** (`src/components/MetaPixel.tsx`), cargado solo en producción para medición publicitaria y declarado en `/cookies` y `/privacidad`. Los eventos quedan además en `localStorage` (`tr-eventos`, solo depuración, nunca sale del dispositivo) y se persisten en la tabla first-party `eventos` vía `POST /api/eventos`, que es la fuente que usa el panel.

**Embudo medido por visitas, no por análisis.** La tasa de conversión usa como denominador las visitas únicas a la portada (`portada_vista`), no los diagnósticos: si no, las visitas que se marchan sin analizar no cuentan en ninguna parte y la tasa queda inflada. Cada paso se cuenta por personas, con un índice único en `(visitor_id, evento, día)`: seis análisis del mismo agricultor en un día son un visitante, no seis oportunidades. Los eventos van en first party, así que el embudo se cuenta aunque no se acepten cookies de terceros, y sin datos personales (ni IP, ni user agent, ni ubicación: solo un UUID aleatorio por dispositivo). Métrica principal: **coste por lead cualificado**, no formularios brutos.

## Compartido social (og:image)

La imagen que aparece al compartir enlaces por WhatsApp o redes se define una sola vez en `src/lib/seo.ts` (`OG_IMAGE`, 1200×630) y la usan el layout y las páginas públicas. Como una página que declara su propio `openGraph` reemplaza el del layout, cada página pública incluye la imagen explícitamente; `og.test.ts` protege esa regresión.

El activo `public/og-tecrural.jpg` está versionado. Solo hay que regenerarlo si cambia la foto o el logotipo:

```bash
node scripts/generar-og.mjs   # recompone public/og-tecrural.jpg desde hoja olivo.jpg + TecRural_icono.png
```

Se mantiene por debajo de 300 KB, el límite práctico de WhatsApp para mostrar miniatura.

## Pruebas

```bash
npm test                    # suite completa
npm run test:watch          # en modo vigilancia
npm run comprobar:esquema   # solo el guard de esquema (también corre en prebuild)
```

La suite cubre los textos, la analítica, el correo y el guard de esquema; las pruebas de cuota SQL se saltan sin base aparte. La mayoría son puras y siempre se ejecutan:

- `src/lib/error-analisis.test.ts` — traducción de errores HTTP a mensajes para el agricultor.
- `src/lib/textos-lead.test.ts` — textos condicionales del formulario según el origen, la intención (informe o revisión) y si el envío por correo está configurado.
- `src/lib/email-envio.test.ts` — el flag se apaga sin clave, el payload no lleva contenido clínico y solo un 2xx con `id` es aceptación; 429/402/timeout son fallo.
- `scripts/comprobar-esquema-sin-borrados.test.ts` — el guard que impide que `aplicarMigraciones()` toque datos, probado lanzándolo como proceso porque lo que importa es su código de salida.

La cuarta, `src/lib/cuota.test.ts`, toca Postgres de verdad: lo que verifica es el comportamiento del SQL —que el contador sea atómico con peticiones simultáneas, que la ventana se renueve sola y que un rechazo no consuma el tope global—, y eso no se puede simular con un doble sin dejar de probar lo que importa. Necesita una base aparte:

```bash
TEST_DATABASE_URL="postgres://.../neondb?..." npm test
```

Sin esa variable **se salta y lo dice**, no falla. Lo natural es una rama de Neon, que se crea desde la consola en un par de clics.

Si no hay base aparte y quieres ejecutarlas igualmente, existe `PERMITIR_TESTS_EN_PRODUCCION=1`. Solo tocan las tablas de cuota (`cuota_usos`, `cuota_telefonos`): no borran leads, diagnósticos ni eventos, pero **vacían los contadores de uso de la semana en curso**. Está desactivado por defecto a propósito.

## Evaluación agronómica

`npm run eval:agronomica` valida `evaluacion/casos.json` y, con `--ejecutar`, lanza el pipeline sobre cada caso con imagen y escribe un informe en `evaluacion/informes/` para revisión del técnico. El informe incluye: acuerdos globales, desglose por cultivo y por tipo esperado, **tramos de confianza** (¿los casos con más confianza aciertan más?) y el **balance de requiere_experto** (falsos positivos/negativos en la derivación a técnico). Mide acuerdos/desacuerdos por cultivo y síntoma; no sustituye la validación humana. Las imágenes deben ser propias o cedidas con autorización (nunca fotos de usuarios sin consentimiento): `evaluacion/imagenes/` e `evaluacion/informes/` no se versionan.

**Flujo por caso** (documentado en la cabecera de `casos.json`): copiar foto real a `evaluacion/imagenes/<id>.jpg` → el técnico rellena `esperado` → `esValidoParaEvaluar: true` → `npm run eval:agronomica -- --ejecutar`. Mientras sea `false`, el caso es un marcador y no se ejecuta.

`npm run eval:calibrar` genera un informe de **solo lectura** a partir de los diagnósticos reales de la BD (últimos 180 días): distribución de confianza por proveedor, % de derivación a experto por tramo de confianza y casos con feedback del usuario. Es la herramienta para ajustar los umbrales de `route.ts` con datos, no a ojo. Requiere `DATABASE_URL`.

## Desarrollo

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # verificación de tipos + build de producción
```

Nota: `next lint` ya no existe en Next 16; el build ya no ejecuta linting.
