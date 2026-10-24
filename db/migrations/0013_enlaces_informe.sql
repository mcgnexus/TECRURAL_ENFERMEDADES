-- Migración 0013: enlaces de recuperación del informe.
--
-- El correo solo transporta un enlace; el contenido clínico no sale del buzón
-- del informe en pantalla. Se guarda únicamente el SHA-256 del token: el token
-- en claro no se persiste ni aparece en logs.
--
-- La caducidad (90 días) se comprueba filtrando por `expira_en > NOW()` en las
-- lecturas. No se borran filas: la inicialización de la base de datos tiene
-- prohibido ejecutar DELETE/UPDATE (ver scripts/comprobar-esquema-sin-borrados.mjs).
--
-- Idempotente: segura de reejecutar.

CREATE TABLE IF NOT EXISTS enlaces_informe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id UUID REFERENCES diagnosticos(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en TIMESTAMPTZ NOT NULL,
  ultimo_acceso_en TIMESTAMPTZ,
  accesos INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_enlaces_informe_token
  ON enlaces_informe(token_hash);

CREATE INDEX IF NOT EXISTS idx_enlaces_informe_diagnostico
  ON enlaces_informe(diagnostico_id, creado_en DESC);
