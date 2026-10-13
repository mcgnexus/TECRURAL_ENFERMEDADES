-- Permite agrupar filas de cuota primaria, IP y global por intento de análisis.
ALTER TABLE cuota_usos ADD COLUMN IF NOT EXISTS request_id UUID;
CREATE INDEX IF NOT EXISTS idx_cuota_usos_request_id
  ON cuota_usos (request_id) WHERE request_id IS NOT NULL;
