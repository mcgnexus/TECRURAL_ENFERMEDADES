-- ============================================================================
-- Migración 0002: consentimientos separados, fotos de revisión y baja comercial
-- ============================================================================
--
-- NOTA: aplicada de forma IDEMPOTENTE por `initDatabase()` (src/lib/database.ts)
-- mediante ALTER TABLE ... ADD COLUMN IF NOT EXISTS. No destructiva.
--
-- Contexto:
-- - Las fotos del análisis NO se guardan por defecto; solo se almacenan en el
--   lead cuando el usuario solicita una revisión (se le informa antes de enviar).
-- - El consentimiento para responder a la revisión solicitada es obligatorio y
--   distinto del consentimiento comercial (opcional, desmarcado por defecto).
-- - Se registra versión del texto, fecha y canal del consentimiento comercial.
-- - `baja_comercial` permite autoexclusión vía POST /api/baja.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS imagenes JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS consentimiento_comercial BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS consentimiento_comercial_fecha TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS consentimiento_texto_version TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS canal_comercial TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS baja_comercial BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_leads_telefono ON leads(telefono);

-- Tabla diagnosticos: el proveedor usado queda registrado para comparar coste
-- y calidad; el contexto declarado por el usuario se guarda para analítica.
-- La columna imagen_url pasa a guardarse vacía ('') por defecto: la foto no se
-- almacena permanentemente salvo solicitud de revisión (ver README).
ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS contexto_usuario JSONB;
ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS proveedor TEXT;
