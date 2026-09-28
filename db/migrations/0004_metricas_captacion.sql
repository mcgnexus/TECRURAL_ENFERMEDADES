-- ============================================================================
-- Migración 0004: métricas de captación
-- ============================================================================
--
-- Aplicada de forma IDEMPOTENTE por `initDatabase()` (src/lib/database.ts)
-- mediante ALTER TABLE ... ADD COLUMN IF NOT EXISTS. No destructiva.
--
-- Objetivo: poder medir el embudo, no solo listar leads.
--
--   - primera_response_at ... marca el instante en que el lead sale de 'nuevo'
--                             por primera vez. Es el reloj del tiempo de
--                             respuesta: sin él no hay forma de saber si
--                             TecRural contesta rápido o se le acumulan.
--                             Los leads ya creados y aún en 'nuevo' quedan con
--                             NULL, que el panel interpreta como "sin tocar".
--   - notas ................. campo libre para el técnico. Se añade ahora
--                             porque añadirlo después obligaría a un ALTER
--                             en caliente con datos ya acumulados.
--   - idx_leads_created_at . índice para las consultas de serie temporal del
--                             panel, ordenadas por fecha desc.
--
-- NOTA: no se reasignan estados antiguos a mano. Los leads previos que ya
-- pasaron de 'nuevo' tendrán primera_response_at NULL y quedarán fuera de la
-- media de tiempo de respuesta hasta que sevolutionen.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS primera_response_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notas TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
