-- ============================================================================
-- Migración 0007: embudo de captación
-- ============================================================================
--
-- Aplicada de forma IDEMPOTENTE por `initDatabase()` (src/lib/database.ts).
-- No destructiva.
--
-- Problema que resuelve: la tasa de conversión se medía dividiendo leads entre
-- diagnósticos, y eso no es un embudo. Un visitante que llega a la portada y se
-- marcha sin analizar no aparecía en ninguna parte, así que el denominador
-- excluía precisamente a las visitas perdidas. Peor: el numerador incluía leads
-- de contacto directo, que pueden no tener ningún diagnóstico detrás. El
-- resultado no representaba la conversión real visita -> lead y podía
-- exagerarla.
--
-- Además, el evento `captura_realizada` estaba declarado en
-- src/lib/analitica.ts y documentado en el README, pero ninguna llamada lo
-- registraba. Los eventos que sí se emitían iban solo a GA4 y a un buffer de
-- localStorage, así que no quedaban en la base de datos: desde el panel no se
-- podía medir ningún paso intermedio.
--
-- Tabla `eventos`:
--   - visitor_id .... UUID de la cookie httpOnly `tr_uid` que emite
--                     src/proxy.ts. Anónimo y sin datos personales: es un
--                     identificador aleatorio, no un usuario.
--   - evento ........ paso del embudo. Los nombres están en
--                     src/lib/analitica.ts (NombreEvento).
--   - params ........ contexto opcional en JSONB (de dónde venía, si hubo
--                     error). SIN datos personales: no se guarda teléfono,
--                     nombre, municipio ni cultivo.
--   - created_at .... instante. La fecha UTC marca el corte diario.
--
-- ÍNDICE ÚNICO por (visitor_id, evento, día). Es la decisión de diseño
-- importante: el embudo se mide por personas, no por repeticiones. Si alguien
-- pulsa "analizar" ocho veces en un día sigue siendo un visitante, y contar
-- ocho veces inflaría los pasos intermedios. ON CONFLICT DO NOTHING descarta el
-- evento repetido sin error ni coste.
--
-- PRIVACIDAD (RGPD): esta tabla es la que más cuidado necesita, porque
-- permite contar visitantes únicos. Se resuelve así:
--   - No se guarda IP, ni user agent, ni geolocalización, ni ninguna forma de
--     identificar a la persona. Solo un UUID aleatorio por dispositivo.
--   - Se puede borrar entera con un TRUNCATE sin romper nada: el panel calcula
--     en el momento y ninguna otra tabla la referencia.
--   - El buffer de localStorage que ya existía NO se envía nunca. Esta tabla
--     sustituye a GA4 como fuente para el panel, no lo reemplaza: al ir en
--     first party, el embudo se cuenta igual aunque el agricultor no haya
--     aceptado cookies de terceros. Así el consentimiento degrada la analítica
--     de terceros, no la métrica comercial.

CREATE TABLE IF NOT EXISTS eventos (
  id BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  evento TEXT NOT NULL,
  params JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La columna calculada lleva IMMUTABLE porque Postgres exige que las funciones
-- usadas en un índice sean deterministas. Con `date_trunc('day', created_at)`
-- directamente en la expresión del índice, la migración falla con
-- "functions in index expression must be marked IMMUTABLE".
ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS dia DATE
    GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_unico
  ON eventos(visitor_id, evento, dia);

CREATE INDEX IF NOT EXISTS idx_eventos_created
  ON eventos(created_at DESC);
