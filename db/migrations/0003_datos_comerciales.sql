-- ============================================================================
-- Migración 0003: datos comerciales del lead
-- ============================================================================
--
-- Aplicada de forma IDEMPOTENTE por `initDatabase()` (src/lib/database.ts)
-- mediante ALTER TABLE ... ADD COLUMN IF NOT EXISTS. No destructiva.
--
-- Objetivo: permitir que el registro comercial distinga, como mínimo:
--   - fecha de creación ............ created_at (ya existente)
--   - origen: diagnóstico .......... origen (ya existente: post_diagnostico | contacto_directo)
--   - municipio .................... municipio (ya existente)
--   - cultivo ...................... cultivo (ya existente)
--   - tipo de síntoma .............. sintoma (nuevo)
--   - canal de contacto solicitado . canal_contacto (nuevo)
--   - estado comercial ............. estado (columna existente; valores ampliados:
--                                  nuevo | contactado | cualificado | presupuesto | ganado | perdido.
--                                  Es TEXT, sin constraint, por lo que no requiere ALTER.)
--   - consentimiento comercial ..... consentimiento_comercial, consentimiento_comercial_fecha,
--                                  consentimiento_texto_version, canal_comercial (migración 0002)
--   - origen de campaña y UTM ...... origen_campana, utm_source, utm_medium, utm_campaign,
--                                  utm_content, utm_term (nuevos)
--   - id del diagnóstico ........... diagnostico_id (ya existente; FK). La imagen NO se
--                                  guarda por defecto: solo se adjunta en `imagenes` al
--                                  solicitar revisión.
--
-- NOTA: los valores antiguos de estado ('visitado', 'cerrado') no se reasignan
-- automáticamente para no asumir si 'cerrado' era ganado o perdido. Si existe
-- dato histórico con esos valores, revisarlo manualmente desde /admin.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS sintoma TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS canal_contacto TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS origen_campana TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term TEXT;
