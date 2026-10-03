# Flujo de TECRURAL Diagnóstico

Documento de referencia del recorrido del usuario y de las reglas de uso
(versión desplegada). Resume qué ocurre en cada paso, qué mecanismo limita el
uso y por qué se eligió.

## Resumen en una frase

Una PWA sin registro obligatorio: el agricultor sube una foto y recibe una
orientación por IA; puede hacer dos análisis gratis y, si necesita más, amplía
a seis semanales facilitando un teléfono que se guarda solo como huella.

## Flujo del usuario

1. **Entrada a la app** (`/`).
   - El servidor emite una cookie propia `tr_uid`: un UUID aleatorio,
     `httpOnly`, `SameSite=Lax`, segura en producción y con 180 días de vida.
   - Esa cookie es la identidad anónima del dispositivo. No hay cuentas.
2. **Contexto del cultivo** (opcional salvo cultivo): cultivo, municipio,
   síntoma, duración y variedad. Mejora la orientación; no se exige.
3. **Foto y envío** (`POST /api/diagnostico`).
   - Se valida el tipo real de la imagen (magic bytes), el tamaño y el formato
     en el cliente y en el servidor; se comprime a JPEG/WebP.
   - El identificador se lee de la cookie `httpOnly`, nunca del cuerpo.
4. **Control de cuota** (antes de llamar a la IA).
   - Se registra un uso atómico y se decide si se permite.
   - Se permiten **2 análisis** por visitante en cualquier ventana móvil de
     7 días.
   - Se aplican además dos topes: uno **global de 500 cada 24 h** (red de
     seguridad de coste) y uno **por conexión (IP) de 12 cada 24 h** (anti-abuso).
5. **Análisis por IA** (solo servidor).
   - Proveedor principal: Gemini; si falla, DeepSeek como respaldo automático.
   - El resultado se normaliza y se valida su coherencia; se marca
     `requiere_experto` cuando procede.
6. **Resultado**.
   - Lenguaje claro, sin porcentajes de confianza no calibrados ni
     prescripciones de productos. Aviso de que no sustituye a un técnico.
   - Las fotos **no se guardan** por defecto.
7. **Revisión técnica opcional**.
   - Si el usuario la solicita, se adjuntan las fotos al lead y se avisa al
     técnico (Telegram o webhook). Es independiente del análisis.
8. **Historial** (`/historial`).
   - Se guarda por dispositivo (cookie), no por cuenta. Se avisa de que borrar
     cookies o cambiar de móvil puede impedir recuperarlo.

## Cómo se reconoce al usuario y por qué

| Mecanismo | Rol | Valoración |
| --- | --- | --- |
| **Cookie propia + base de datos** | Identidad anónima principal | Fácil, sin fricción y comprobable en servidor. No es infalible: borrar cookies o usar navegación privada reinicia el contador. |
| **Teléfono (huella HMAC)** | Ampliar la cuota | Eleva el límite con poca fricción. No se verifica el número, así que es un freno, no una prueba de identidad. |
| **IP** | Límite complementario anti-abuso | Red secundaria. No identifica a la persona y puede cambiar en móvil; se usa holgado para no afectar a redes compartidas. |
| **Login con Google** | Identidad persistente | Solo recomendable cuando haya demanda real de historial entre dispositivos. Añade fricción y tratamiento de datos. |

## Reglas de cuota

- **Sin teléfono:** 2 análisis por ventana móvil de 7 días.
- **Con teléfono:** 6 análisis por ventana móvil de 7 días, **incluyendo** los
  anónimos ya usados.
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

## Ampliación por teléfono

- Se ofrece al agotar el límite anónimo, con una casilla que explica el uso.
- El teléfono se normaliza y se convierte en **HMAC-SHA-256** con
  `CUOTA_TELEFONO_SECRET`; el número original **no se almacena**.
- La huella se asocia al dispositivo y caduca a los **180 días**.
- **No** se usa para contactar, **no** es publicidad, **no** es una solicitud de
  revisión ni un consentimiento comercial.
- Los registros de uso, incluida la IP, se purgan a los **31 días**.

## Privacidad y datos

- La finalidad de control de uso se basa en el **interés legítimo** (art. 6.1.f
  RGPD): contener coste y evitar abuso, con minimización (HMAC, no contacto).
- La solicitud de revisión se basa en las medidas precontractuales
  (art. 6.1.b); las comunicaciones comerciales, en el consentimiento separado
  (art. 6.1.a).
- Las fotos solo se guardan si el usuario pide revisión; máximo 12 meses.
- Detalle completo en `/privacidad` y en
  `docs/pendientes-legal-formulario.md`.

## Analítica del embudo

- Eventos first-party en la tabla `eventos`, contados por visitante único y día:
  `portada_vista` → `captura_realizada` → `analisis_iniciado` →
  `analisis_completado` → `resultado_visto` → `cta_revision_abierto` →
  `lead_enviado`.
- La conversión se mide sobre visitas a la portada, no sobre análisis.

## Operación

- **Migraciones:** `npm run db:migrate` como paso de despliegue. Las rutas ya no
  ejecutan DDL.
- **Variables relevantes:** `DATABASE_URL`, `GEMINI_API_KEY`,
  `DEEPSEEK_API_KEY`, `CUOTA_TELEFONO_SECRET`, `ADMIN_TOKEN`,
  `NEXT_PUBLIC_TECRURAL_WHATSAPP`, `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`.
- **Panel:** `/admin` con `ADMIN_TOKEN`; muestra embudo, cuotas y leads.

## Decisiones abiertas

- **¿Login con Google?** Solo si el uso recurrente lo justifica; hoy no es
  necesario para el MVP.
- **¿Verificar el teléfono?** Daría una identidad más sólida, pero añade coste y
  complejidad; no se ha implementado.
- **¿Subir de 2 a 3 análisis anónimos?** Se valorará si el embudo muestra que el
  límite frena a usuarios legítimos.
