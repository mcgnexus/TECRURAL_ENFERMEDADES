# TECRURAL Diagnóstico

PWA de orientación fitosanitaria para agricultores del Altiplano de Granada y la Costa Tropical: foto del cultivo → hipótesis de orientación por IA (Gemini 2.5 Flash o DeepSeek Chat, selección automática) → solicitud de revisión técnica de TecRural.

## Flujo de usuario

1. **Portada**: explica el servicio (orientación inicial, no diagnóstico definitivo; foto clara; revisión de TecRural como siguiente paso) y el botón «Analizar una planta».
2. **Contexto del cultivo**: cultivo (selector + "Otro"/"No lo sé"), municipio o comarca (Altiplano/Costa Tropical + "Otro"), síntoma observado, desde cuándo (opcional), variedad (opcional). Sin GPS.
3. **Fotos**: modo simple por defecto (1 foto nítida del síntoma). Modo avanzado opcional añade envés y planta completa. Vista previa, reemplazo y eliminación por foto. Validación de tipo real (magic bytes), tamaño (≤12 MB) y formato en frontend y backend. Compresión a JPEG ~1024px/0,8MB (elimina EXIF y optimiza móvil manteniendo detalle para manchas y síntomas pequeños).
4. **Análisis**: botón «Analizar foto»; desactivado solo si falta la foto principal. Estados de espera claros sin porcentajes falsos; datos y fotos se conservan si hay error; reintentos permitidos. Errores amigables (red, límite de uso, proveedor, imagen no interpretable, servicio caído) sin trazas ni claves.
5. **Resultado**: en lenguaje claro — qué se observa; posibles causas como hipótesis; qué falta para afinar; próximos pasos prudentes; cuándo pedir revisión técnica; aviso visible de que la IA no sustituye inspección profesional. Fiabilidad mostrada cualitativamente (señales claras / indicios moderados / señales poco claras), sin porcentajes no calibrados. Sin prescripciones de productos, marcas ni dosis. Compartible (Web Share API con fallback a portapapeles).
6. **Revisión de TecRural**: CTA tras el resultado sin ocultarlo; formulario con nombre opcional, teléfono/canal, municipio y cultivo precargados y editables, mensaje opcional, confirmación de solicitud y consentimiento comercial **separado y desmarcado por defecto**. Las fotos se comparten solo al enviar la revisión, informando antes.

## Arquitectura

- **Next.js 16 (App Router) + React 19 + Tailwind v4**, PWA con `next-pwa`.
- **IA (solo servidor, claves nunca en el cliente):**
  - `src/lib/gemini.ts` — pipeline de 4 capas: observación → hipótesis (few-shots por cultivo) → verificación adversarial → reintento. Acepta varias fotos (principal + envés + planta completa).
  - `src/lib/deepseek.ts` — mismo pipeline sobre DeepSeek Chat como fallback automático.
  - `src/lib/system-prompt.ts` — prompts (hipótesis, sin prescripciones), esquemas y ejemplos.
  - Selección de proveedor automática (recomendado Gemini); el usado se registra en BD para comparar coste y calidad.
- **Base de datos:** Neon Postgres serverless (`src/lib/database.ts`). Tablas:
  - `diagnosticos` — hipótesis y contexto. Las fotos NO se guardan por defecto (política de datos); solo en el lead si el usuario pide revisión.
  - `leads` — solicitudes de revisión cualificadas, consentimientos y fotos compartidas.
  - `cuota_usos` / `cuota_telefonos` — límites de uso con **ventana móvil real** (conteo por marcas de tiempo, sin corte a medianoche). El teléfono solo se guarda como HMAC (`CUOTA_TELEFONO_SECRET`), nunca en claro, y expira a los 180 días; los registros de uso se purgan a los 31 días.
- **Cuotas de análisis:** 2 análisis sin datos en cualquier periodo de 7 días. Al tercero, la app ofrece ampliar a **6 análisis semanales** facilitando el teléfono, con casilla propia que explica el uso (solo límite, sin contacto ni publicidad); no es una solicitud de revisión ni consiente comunicaciones. El conteo es atómico (advisory locks) y si la base no responde el análisis se rechaza con 503 en lugar de ejecutarse sin límite.
- **Validación:** coherencia del JSON, saneado de síntomas, `requiere_experto` automático, magic bytes de imágenes (`src/lib/imagen.ts`).

## Leads, consentimientos y baja

- **API:** `POST /api/leads` (zod, honeypot, rate limit 5/h por IP, `solicitud_respuesta` requerida), `GET /api/leads` (listado) y `PATCH /api/leads` (cambio de estado), ambos protegidos con `ADMIN_TOKEN` (header `x-admin-token`).
- **Registro comercial** (`leads`): fecha de creación, origen (diagnóstico / contacto directo), municipio, cultivo, **síntoma** observado, **canal de contacto solicitado** (llamada / WhatsApp), **estado comercial** (`nuevo → contactado → cualificado → presupuesto → ganado / perdido`), prioridad cualificada en servidor, consentimiento comercial (estado, fecha, versión del texto y canal), **origen de campaña y parámetros UTM** (`utm_source/medium/campaign/content/term`, capturados del enlace de entrada y guardados en sesión) e **identificador del diagnóstico** (sin almacenar la imagen por defecto).
- **Consentimientos separados:**
  - Gestionar la solicitud de revisión: implícito al enviar (confirmado con casilla obligatoria).
  - Comunicaciones comerciales: opcional, desmarcado; se guardan estado, fecha, versión del texto (`TEXTO_COMERCIAL_VERSION`, actualmente `v1-2026-09`) y canal (`whatsapp`).
- **Baja:** página `/baja` + `POST /api/baja` marcan `baja_comercial=true` y anulan el consentimiento comercial del teléfono indicado.
- **Gestión comercial:** `/admin` es una herramienta interna ligera para listar y cambiar el estado de los leads. Pide el `ADMIN_TOKEN` (se guarda solo en la sesión de la pestaña, nunca en el código ni en el frontend empaquetado). Las fotos adjuntas a la revisión se ven desde el propio panel: columna **Fotos**, con miniaturas que abren a tamaño completo. Se sirven por `GET /api/leads/fotos?lead=<id>&indice=<n>`, protegida con `x-admin-token` y con `Cache-Control: no-store` para que no acaben en caché ni en CDN. El listado nunca incluye las imágenes, solo su número: con hasta 3 fotos de WebP por lead, traerlas en cada respuesta serían cientos de megas que el técnico no va a mirar.
- **Cualificación en servidor** (`src/lib/leads.ts`): gravedad, `requiere_experto` y hectáreas → prioridad alta/media/baja. Umbrales ajustables.
- **WhatsApp:** solo con `NEXT_PUBLIC_TECRURAL_WHATSAPP` configurada. Nunca hardcodeado.

## ⚠ Pendientes legales antes de promocionar el formulario

Ver `docs/pendientes-legal-formulario.md`: identidad del responsable, política de privacidad publicada, plazos de respuesta, número oficial de WhatsApp y revisión del texto de consentimiento. No se han inventado estos datos.

## Migraciones

El esquema se aplica con `npm run db:migrate` (idempotente: `CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN IF NOT EXISTS`; **nunca borra filas**). Ejecútalo como paso de despliegue, no desde las peticiones: las rutas ya no llaman a `initDatabase()`. Historial en `db/migrations/` (`0001` a `0008`). Las operaciones puntuales sobre datos, que exigen decisión humana, están en `db/one-off/`.

## Variables de entorno

Ver `.env.example`: `DATABASE_URL`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` (servidor); `NEXT_PUBLIC_TECRURAL_WHATSAPP`, `NEXT_PUBLIC_GA_ID`, `ADMIN_TOKEN`, `CUOTA_TELEFONO_SECRET` (opcionales; el secreto de cuota es necesario para la ampliación semanal por teléfono).

## Analítica de conversión

`src/lib/analitica.ts` emite los eventos del embudo: `portada_vista` → `captura_realizada` → `analisis_iniciado` → `analisis_completado` → `resultado_visto` → `cta_revision_abierto` → `lead_enviado` (más `analisis_error`, `lead_error` y `whatsapp_click`). Se reenvían a GA4 si `NEXT_PUBLIC_GA_ID` está definida, quedan en `localStorage` (`tr-eventos`, solo depuración, nunca sale del dispositivo) y se persisten en la tabla `eventos` vía `POST /api/eventos`, que es la fuente que usa el panel.

**Embudo medido por visitas, no por análisis.** La tasa de conversión usa como denominador las visitas únicas a la portada (`portada_vista`), no los diagnósticos: si no, las visitas que se marchan sin analizar no cuentan en ninguna parte y la tasa queda inflada. Cada paso se cuenta por personas, con un índice único en `(visitor_id, evento, día)`: seis análisis del mismo agricultor en un día son un visitante, no seis oportunidades. Los eventos van en first party, así que el embudo se cuenta aunque no se acepten cookies de terceros, y sin datos personales (ni IP, ni user agent, ni ubicación: solo un UUID aleatorio por dispositivo). Métrica principal: **coste por lead cualificado**, no formularios brutos.

## Pruebas

```bash
npm test                    # suite completa
npm run test:watch          # en modo vigilancia
npm run comprobar:esquema   # solo el guard de esquema (también corre en prebuild)
```

55 pruebas en seis ficheros (más las de cuota SQL, que se saltan sin base aparte). La mayoría son puras y siempre se ejecutan:

- `src/lib/error-analisis.test.ts` — traducción de errores HTTP a mensajes para el agricultor.
- `src/lib/textos-lead.test.ts` — textos condicionales del formulario según el origen.
- `scripts/comprobar-esquema-sin-borrados.test.ts` — el guard que impide que `aplicarMigraciones()` toque datos, probado lanzándolo como proceso porque lo que importa es su código de salida.

La cuarta, `src/lib/cuota.test.ts`, toca Postgres de verdad: lo que verifica es el comportamiento del SQL —que el contador sea atómico con peticiones simultáneas, que la ventana se renueve sola y que un rechazo no consuma el tope global—, y eso no se puede simular con un doble sin dejar de probar lo que importa. Necesita una base aparte:

```bash
TEST_DATABASE_URL="postgres://.../neondb?..." npm test
```

Sin esa variable **se salta y lo dice**, no falla. Lo natural es una rama de Neon, que se crea desde la consola en un par de clics.

Si no hay base aparte y quieres ejecutarlas igualmente, existe `PERMITIR_TESTS_EN_PRODUCCION=1`. Solo tocan las tablas de cuota (`cuota_usos`, `cuota_telefonos`): no borran leads, diagnósticos ni eventos, pero **vacían los contadores de uso de la semana en curso**. Está desactivado por defecto a propósito.

## Evaluación agronómica

`npm run eval:agronomica` valida `evaluacion/casos.json` y, con `--ejecutar`, lanza el pipeline sobre cada caso con imagen y escribe un informe en `evaluacion/informes/` para revisión del técnico. Mide acuerdos/desacuerdos por cultivo y síntoma; no sustituye la validación humana. Las imágenes deben ser propias o cedidas con autorización (nunca fotos de usuarios sin consentimiento): `evaluacion/imagenes/` e `evaluacion/informes/` no se versionan.

## Desarrollo

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # verificación de tipos + build de producción
```

Nota: `next lint` ya no existe en Next 16; el build ya no ejecuta linting.
