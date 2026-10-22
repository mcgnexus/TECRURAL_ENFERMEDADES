-- Migración 0011: solicitud de revisión explícita.
--
-- El formulario posterior al diagnóstico separa dos intenciones: desbloquear
-- el informe (basta un correo) y pedir que un técnico revise el caso (casilla
-- opcional aparte). `solicitud_respuesta` llega booleana en el POST y ahora se
-- guarda también en la fila para distinguir oportunidades reales de envíos
-- "solo informe" en el panel y en las notificaciones.
--
-- Idempotente: segura de reejecutar. No borra ni modifica datos existentes
-- (solo fija FALSE en las filas nuevas, valor por defecto).

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS solicitud_revision BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_leads_solicitud_revision
  ON leads(solicitud_revision, created_at DESC);
