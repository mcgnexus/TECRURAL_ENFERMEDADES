-- Migración 0012: consentimiento comercial explícito por canal.
--
-- Hasta ahora el canal del consentimiento comercial se infería del contacto
-- ("hay teléfono" -> WhatsApp), lo que guardaba WhatsApp en envíos del informe
-- que solo mostraron una casilla de correo. Este array conserva, por cada
-- autorización, el canal que se mostró, la versión del texto, la fecha y el
-- origen. Los campos agregados de la fila (consentimiento_comercial,
-- consentimiento_texto_version, canal_comercial y su fecha) se derivan del
-- array en `guardarLead`.
--
-- Idempotente: segura de reejecutar. No modifica datos existentes: los leads
-- anteriores quedan con el array vacío y se identifican como históricos; no se
-- convierten automáticamente.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS consentimientos_comerciales JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_leads_consentimientos_comerciales
  ON leads USING GIN (consentimientos_comerciales);
