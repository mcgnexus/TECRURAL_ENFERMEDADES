# Flujo de TECRURAL Diagnóstico

Documento de referencia del recorrido del usuario y de las reglas de uso
(versión desplegada). Resume qué ocurre en cada paso, qué mecanismo limita el
uso y por qué se eligió.

## Resumen en una frase

Una PWA sin registro obligatorio: el agricultor sube una foto y recibe una
orientación por IA; con un análisis anónimo demuestra el valor y, a partir de
ahí, el informe completo y hasta seis análisis semanales se piden a cambio de
un contacto (correo; el teléfono queda reservado a quien pide la revisión de
un técnico).

## Flujo del usuario

1. **Entrada a la app** (`/`).
   - El servidor emite una cookie propia `tr_uid`: un UUID aleatorio,
     `httpOnly`, `SameSite=Lax`, segura en producción y con 180 días de vida.
   - Esa cookie es la identidad anónima del dispositivo. No hay cuentas.
   - La portada muestra el límite gratuito (1 análisis cada 7 días, sin
     registro) antes de subir la foto: sin muros sorpresa tras el análisis.
   - El titular es corto y el botón principal está justo debajo. Un
     desplegable «Ver un ejemplo» muestra una orientación de ejemplo (foto,
     posibles causas, qué comprobar, limitaciones y cuándo pedir ayuda) sin
     subir ninguna foto. Es contenido estático etiquetado como **Ejemplo**: no
     llama a la API, no crea diagnósticos y el evento `ejemplo_visto` queda
     fuera del embudo.
2. **Pantalla de captura: cultivo → foto → contexto opcional**.
   - Lo primero que se ve es la selección de **cultivo** y los botones de
     cámara/galería. El análisis se habilita con cultivo + foto principal
     (incluida la opción «No lo sé»).
   - Municipio, síntoma, duración y variedad viven en un desplegable
     **opcional** cerrado por defecto: mejoran la orientación, pero no
     bloquean el envío. El desplegable explica para qué sirven.
   - Un error recuperable conserva la foto y el contexto: se puede reintentar
     sin repetir la captura.
3. **Foto y envío** (`POST /api/diagnostico`).
   - Se valida el tipo real de la imagen (magic bytes), el tamaño y el formato
     en el cliente y en el servidor; se comprime a JPEG/WebP con un objetivo
     de **1536 px y ~1 MB** (calidad 0.8): conservar detalle fino (punteado de
     araña roja, fructificaciones tempranas) justifica el mayor peso.
    - Si el síntoma declarado apunta a plaga u hongo que vive en la cara
      inferior de la hoja (ácaros, cochinilla, mildiu, manchas…), se muestra la
      tarjeta del **envés** automáticamente (sugerencia, nunca obligación).
    - La captura integrada muestra una guía de encuadre; si no se concede
      permiso de cámara, se conserva el selector nativo. Un chequeo local
      orientativo de nitidez y exposición permite repetir o continuar.
   - El identificador se lee de la cookie `httpOnly`, nunca del cuerpo.
4. **Control de cuota** (antes de llamar a la IA).
    - Se registra un uso atómico y se decide si se permite. Las filas de
      visitante, IP y límite global comparten un ID para poder reembolsarlas
      juntas ante un fallo confirmado del proveedor.
   - Se permiten **1 análisis** por visitante en cualquier ventana móvil de
     7 días: uno basta para demostrar el valor; el siguiente paso es dejar el
     contacto, no regalar más análisis.
   - Se aplican además dos topes: uno **global de 500 cada 24 h** (red de
     seguridad de coste) y uno **por conexión (IP) de 12 cada 24 h** (anti-abuso).
5. **Análisis por IA** (solo servidor).
    - Proveedor principal: Gemini; si falla, OpenAI `gpt-4o-mini` como respaldo
      multimodal opcional (`OPENAI_API_KEY`). DeepSeek Chat no se usa para fotos.
    - Pipeline de cuatro capas: observación → hipótesis (con few-shots por
      cultivo) → **verificación adversarial de la foto relevante**
     (antes razonaba solo sobre texto) → turno de corrección si hay feedback.
    - Cada llamada tiene un tope y el análisis comparte un **deadline total de
      105 s** entre fases y proveedores, dejando margen antes de `maxDuration`.
   - La **calidad de la imagen** la evalúa la fase de observación y se propaga
     al diagnóstico: nitidez baja o encuadre insuficiente fuerzan
     `requiere_experto` y añaden una nota al usuario.
   - La observación se **cachea por hash de las imágenes** durante 15 minutos:
     si el usuario reintenta con la misma foto, la fase 1 no se repite (menos
     coste y menos espera). La caché es en memoria por instancia y no guarda
     imágenes, solo el JSON de la observación.
    - Si ambos proveedores fallan, se devuelve un error de servicio y se
      reembolsan las cuotas del intento. Los errores de entrada no se reembolsan.
    - La API transmite progreso NDJSON por fase, sin porcentajes inventados. El
      resultado se cachea hasta 15 minutos por visitante, imagen y contexto; la
      caché es efímera por instancia y no almacena fotos.
   - El resultado se normaliza y se valida su coherencia; se marca
     `requiere_experto` cuando procede.
6. **Resultado**.
   - Orientación inicial gratuita y con utilidad propia: hechos observados,
     otras causas posibles, qué faltaría para afinar (incluida, si existe, una
     segunda foto que aportaría información adicional, sin prometer que
     confirma), qué comprobar ahora (con texto de respaldo si el modelo no
     devuelve próximos pasos) y un bloque fijo de «¿Cuándo conviene que lo vea
     una persona?». Lenguaje claro, sin porcentajes de confianza no calibrados.
   - Después de esa orientación, en la propia pantalla se ofrecen **dos acciones
     independientes**, sin una preseleccionada:
     - **Abrir el informe completo**: pide solo un **correo** y explica que se
       usa para mostrar el informe, ampliar el límite y enviar el enlace de
       recuperación, nunca para contactar. El informe (pauta orientativa con
       materia activa y dosis en rango, momento y plazo de seguridad cuando la
       foto permite proponerla, y PDF) se abre en pantalla; el correo solo
       transporta un enlace, no el contenido clínico. Al dejarlo, la cuota se
       amplía a seis análisis cada 7 días.
     - **Solicitar la revisión de un técnico**: pide elegir **canal** (WhatsApp,
       correo o llamada, sin preselección) y solo el dato de ese canal (teléfono
       para WhatsApp o llamada; correo para correo). Reutiliza cultivo, municipio
       y síntoma ya dados. Registra la solicitud de revisión con las fotos y no
       exige un correo si se eligió WhatsApp. Solo si el canal es correo se
       envía también el enlace de recuperación.
     Cualquiera de las dos abre el informe en pantalla. La revisión sigue
     disponible después de guardar el informe. Cada confirmación dice
     exactamente qué se ha registrado (informe sin revisión, o revisión con su
     canal).
   - **Entrega del enlace y estados separados**: cuando Resend acepta el envío
     (2xx con `id`), la pantalla muestra «Enviado a tu correo» y ofrece
     reenvío; si falla, muestra «No hemos podido enviarlo» con reintento. El
     informe generado permanece siempre visible. Entrega no es recepción: el
     texto avisa de la posible errata y de la carpeta de correo no deseado.
   - Las novedades comerciales son un **opt-in independiente y voluntario por
     correo**, separado de ambas acciones: no marcarlo no bloquea el servicio.
     En la revisión por teléfono/WhatsApp no se ofrece, porque el teléfono dado
     para la revisión no autoriza publicidad.
   - El tratamiento es una **sugerencia orientativa, no una prescripción**: la
     app recuerda confirmar el registro del producto y respetar la etiqueta y el
     plazo de seguridad. Las fotos **no se guardan** por defecto.
7. **Revisión técnica (acción aparte)**.
   - Tras el diagnóstico, pedir que un técnico revise el caso es una **acción
     propia con su formulario**: quien solo quiere el informe no registra una
     solicitud de contacto ni recibe promesas de respuesta.
   - Al solicitarla se registra un lead (con las fotos adjuntas) y se avisa al
     técnico (Telegram o webhook); entonces sí se promete respuesta en un
     plazo máximo de 48 horas por el canal elegido. El canal se elige siempre en
     el formulario: no hay llamada preseleccionada. La revisión es independiente
     del análisis y no tiene coste. Si se usa también la acción del informe,
     quedan dos leads vinculados por `diagnostico_id`.
   - El consentimiento comercial es explícito por canal
     (`leads.consentimientos_comerciales`, migración 0012): correo en el
     formulario del informe y WhatsApp solo en contacto directo con teléfono.
     Nunca se deduce del teléfono ni del canal de revisión. El panel muestra el
     canal, la versión y la fecha, y marca los registros históricos inferidos.
   - La intención queda guardada en `leads.solicitud_revision` (migración
     0011): el panel muestra una columna "Revisión" y los avisos distinguen
     "pide revisión" de "solo informe", que no genera promesa de respuesta.
8. **Historial** (`/historial`).
   - Se guarda por dispositivo (cookie), no por cuenta. Se avisa de que borrar
     cookies o cambiar de móvil puede impedir recuperarlo.

## Cómo se reconoce al usuario y por qué

| Mecanismo | Rol | Valoración |
| --- | --- | --- |
| **Cookie propia + base de datos** | Identidad anónima principal | Fácil, sin fricción y comprobable en servidor. No es infalible: borrar cookies o usar navegación privada reinicia el contador. |
| **Correo o teléfono (huella HMAC)** | Ampliar la cuota | Eleva el límite con poca fricción y sin guardar el dato en claro. No se verifica, así que es un freno, no una prueba de identidad. |
| **IP** | Límite complementario anti-abuso | Red secundaria. No identifica a la persona y puede cambiar en móvil; se usa holgado para no afectar a redes compartidas. |
| **Login con Google** | Identidad persistente | Solo recomendable cuando haya demanda real de historial entre dispositivos. Añade fricción y tratamiento de datos. |

## Reglas de cuota

- **Sin contacto:** 1 análisis por ventana móvil de 7 días.
- **Con contacto vinculado (correo o teléfono):** 6 análisis por ventana móvil
  de 7 días, **incluyendo** los anónimos ya usados.
- **Global:** 500 análisis cada 24 h para toda la aplicación.
- **Por conexión (IP):** 12 cada 24 h.
- **Ventana móvil real:** los usos se cuentan por marcas de tiempo, no por día
  natural; no hay reinicio a medianoche.
- **Atomicidad:** el conteo y la inserción se hacen en una sola sentencia con
  `pg_advisory_xact_lock`, de modo que peticiones simultáneas no superan el
  límite aunque haya varias instancias.
- **Si la base de datos no responde:** el análisis se rechaza (503) en lugar de
  ejecutarse sin control de coste.

### Qué consume cuota

El uso se descuenta al admitir el análisis, antes de llamar a la IA. Un fallo
posterior del proveedor también consume el uso: es preferible contar de más que
permitir reintentos que multipliquen el gasto. Por tanto, el contador refleja
análisis admitidos, no necesariamente diagnósticos entregados con éxito.

## Enlace de recuperación del informe

- Se emite al guardar el informe con correo o al pedir revisión con canal
  correo. Nunca con teléfono o WhatsApp.
- El token tiene 32 bytes aleatorios, se guarda solo como SHA-256 y es válido
  90 días y multiuso (se puede abrir desde otro dispositivo sin cookie). Un
  token nuevo invalida el anterior.
- El correo solo lleva el enlace; no adjunta el informe ni menciona patología,
  materia activa o dosis. La URL sale de `NEXT_PUBLIC_SITE_URL`.
- Límites de reenvío: 3/24 h por diagnóstico, 10/7 días por correo y 30/24 h
  por IP. El envío automático se hace una vez por lead; los siguientes son
  manuales.
- Solo un 2xx de Resend con `id` cuenta como aceptado. Si falla, el informe
  sigue en pantalla y se ofrece reintentar. Sin `RESEND_API_KEY` o
  `RESEND_FROM`, ninguna pantalla promete el envío y el endpoint responde
  `no_disponible`.
- Caducidad: la lectura filtra `expira_en > NOW()`; no hay borrado programado.

## Ampliación por contacto (correo o teléfono)

- Se ofrece en la propia pantalla del primer resultado (formulario del informe)
  y, si el límite se agota sin haber dejado contacto, en la vista de captura.
- Basta un correo; se acepta también un teléfono para quien no use correo. El
  dato se normaliza y se convierte en **HMAC-SHA-256** con
  `CUOTA_TELEFONO_SECRET`; el original **no se almacena** (endpoint
  `POST /api/cuota/contacto`).
- Al dejar el contacto en el formulario del informe, la vinculación ocurre en
  la **misma operación del servidor** que guarda el lead (`POST /api/leads`):
  el éxito que ve la persona confirma informe y ampliación a la vez. El
  endpoint de cuota queda para quien amplía directamente desde la captura.
- La huella se asocia al dispositivo y caduca a los **180 días**.
- **No** se usa para contactar, **no** es publicidad, **no** es una solicitud de
  revisión ni un consentimiento comercial.
- Los registros de uso, incluida la IP, se purgan a los **31 días**.

## Privacidad y datos

- La finalidad de control de uso se basa en el **interés legítimo** (art. 6.1.f
  RGPD): contener coste y evitar abuso, con minimización (HMAC, no contacto).
- La solicitud de revisión se basa en las medidas precontractuales
  (art. 6.1.b); las comunicaciones comerciales, en el consentimiento separado
  (art. 6.1.a). Un envío que solo desbloquea el informe no registra solicitud
  de revisión ni guarda fotos.
- Las fotos solo se guardan si el usuario pide revisión; máximo 12 meses.
- El enlace de recuperación se conserva 90 días; en la base de datos solo consta
  su SHA-256. La entrega se apoya en Resend, que recibe el correo y el mensaje
  neutro, no el informe. Base jurídica de la entrega: art. 6.1.b RGPD.
- Detalle completo en `/privacidad` y en
  `docs/pendientes-legal-formulario.md`.

## Analítica del embudo

- Eventos first-party en la tabla `eventos`, contados por visitante único y día:
  `portada_vista` → `captura_realizada` → `analisis_iniciado` →
  `analisis_completado` → `resultado_visto` → `cta_revision_abierto` (primera
  interacción con el formulario del informe) →
  `informe_desbloqueado` → `lead_enviado`. Se añade `informe_pdf` cuando se
  guarda el informe y `informe_envio_aceptado` / `informe_envio_fallido` para
  medir la entrega real del enlace frente a la promesa de la pantalla.
- La conversión se mide sobre visitas a la portada, no sobre análisis.

## Tratamiento y límites legales

- El informe incluye una **pauta orientativa** (materia activa por nombre común,
  dosis en rango, momento y plazo de seguridad). No es una receta: la app avisa
  de que partió de una foto, de que puede contener errores y de que hay que
  confirmar el registro del producto y leer la etiqueta.
- Pendiente: revisión legal de este cambio (antes la app no prescribía nada). Ver
  `docs/pendientes-legal-formulario.md`.

## Operación

- **Migraciones:** `npm run db:migrate` como paso de despliegue. Las rutas ya no
  ejecutan DDL.
- **Variables relevantes:** `DATABASE_URL`, `GEMINI_API_KEY`,
  `DEEPSEEK_API_KEY`, `CUOTA_TELEFONO_SECRET`, `ADMIN_TOKEN`,
  `NEXT_PUBLIC_TECRURAL_WHATSAPP`, `NEXT_PUBLIC_SITE_URL`,
  `RESEND_API_KEY`, `RESEND_FROM` (y `RESEND_REPLY_TO` opcional),
  `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`.
- **Coste del correo:** Resend incluye 3 000 correos/mes y 100/día en la capa
  gratuita. Con campañas puede quedarse corto; vigilar `informe_envio_aceptado`
  y revisar el plan antes de escalar.
- **Panel:** `/admin` con `ADMIN_TOKEN`; pestañas de resumen (KPIs y gráficos
  interactivos con drill-down), leads (tabla ordenable, filtros, búsqueda y
  borrado definitivo vía `DELETE /api/leads`), diagnósticos (cada análisis con
  su resultado y el recuento de intentos y errores) y accesos (visitas anónimas,
  IPs enmascaradas y embudo diario).

## Decisiones abiertas

- **¿Login con Google?** Solo si el uso recurrente lo justifica; hoy no es
  necesario para el MVP.
- **¿Verificar el contacto?** Daría una identidad más sólida, pero añade coste
  y complejidad; no se ha implementado.
- **¿Cuántos análisis anónimos?** Con uno solo se mide si el contacto pide más
  fricción de la que retiene; el embudo (`resultado_visto` frente a
  `lead_enviado`) dirá si conviene volver a dos. Con muy pocos casos analizados
  aún no hay datos para decidir.
