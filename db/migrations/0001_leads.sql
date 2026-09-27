-- ============================================================================
-- Migración 0001: tabla de leads comerciales
-- ============================================================================
--
-- NOTA: esta migración se aplica de forma IDEMPOTENTE en tiempo de ejecución
-- por `initDatabase()` (src/lib/database.ts) usando CREATE TABLE IF NOT EXISTS,
-- igual que ya se hace con la tabla `diagnosticos`. No es necesario ejecutar
-- este archivo manualmente; se documenta aquí como referencia del esquema.
--
-- Compatible con despliegues existentes: no modifica la tabla `diagnosticos`,
-- solo crea una tabla nueva y sus índices.

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id UUID REFERENCES diagnosticos(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  municipio TEXT,
  cultivo TEXT,
  hectareas NUMERIC,
  mensaje TEXT,
  origen TEXT NOT NULL DEFAULT 'post_diagnostico',   -- post_diagnostico | contacto_directo
  prioridad TEXT NOT NULL DEFAULT 'baja',            -- alta | media | baja (calculada en servidor)
  puntuacion INTEGER NOT NULL DEFAULT 0,             -- score de cualificación (ver src/lib/leads.ts)
  estado TEXT NOT NULL DEFAULT 'nuevo',              -- nuevo | contactado | visitado | cerrado
  contexto_diagnostico JSONB,                        -- snapshot: especie, gravedad, tipo, requiere_experto...
  consentimiento_rgpd BOOLEAN NOT NULL DEFAULT FALSE,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_prioridad ON leads(prioridad, estado);
