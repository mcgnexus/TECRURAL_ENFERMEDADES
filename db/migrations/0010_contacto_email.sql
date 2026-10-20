-- ============================================================================
-- Migración 0010: correo de contacto en leads
-- ============================================================================
--
-- El informe completo (y su PDF) ya no exige teléfono: para desbloquearlo basta
-- con dejar un teléfono O un correo (src/app/api/leads/route.ts exige al menos
-- uno de los dos).
--
-- NOTA: al igual que el resto de migraciones, se aplica de forma idempotente en
-- tiempo de ejecución por `initDatabase()` (src/lib/database.ts) y no hace
-- falta ejecutar este archivo a mano; queda aquí como referencia del esquema.
--
-- `leads.telefono` se conserva NOT NULL: relajar esa restricción exige una
-- sentencia que el guard de scripts/comprobar-esquema-sin-borrados.mjs no
-- admite dentro de `aplicarMigraciones()`. Por eso un lead que solo deja correo
-- se guarda con cadena vacía en `telefono`, y la columna `email` queda NULL en
-- los leads antiguos que solo dejaron teléfono.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
