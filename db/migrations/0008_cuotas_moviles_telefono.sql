-- Consumos individuales para límites móviles y ampliación semanal por teléfono.
-- El teléfono original no se persiste: telefono_hash es HMAC con secreto servidor.

CREATE TABLE IF NOT EXISTS cuota_usos (
  id BIGSERIAL PRIMARY KEY,
  ambito TEXT NOT NULL,
  sujeto TEXT NOT NULL,
  visitor_id TEXT,
  telefono_hash TEXT,
  ip TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cuota_usos_ambito_sujeto_fecha
  ON cuota_usos (ambito, sujeto, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_cuota_usos_fecha ON cuota_usos (creado_en);

CREATE INDEX IF NOT EXISTS idx_cuota_usos_telefono_fecha
  ON cuota_usos (telefono_hash, creado_en DESC)
  WHERE telefono_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cuota_usos_ip_fecha
  ON cuota_usos (ip, creado_en DESC)
  WHERE ip IS NOT NULL;

CREATE TABLE IF NOT EXISTS cuota_telefonos (
  visitor_id TEXT PRIMARY KEY,
  telefono_hash TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days')
);

ALTER TABLE cuota_telefonos
  ADD COLUMN IF NOT EXISTS expira_en TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days');

CREATE INDEX IF NOT EXISTS idx_cuota_telefonos_hash
  ON cuota_telefonos (telefono_hash);
