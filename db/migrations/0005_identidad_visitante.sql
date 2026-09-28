-- ============================================================================
-- Migración 0005: atribución de leads a un visitante
-- ============================================================================
--
-- Aplicada de forma IDEMPOTENTE por `initDatabase()` (src/lib/database.ts)
-- mediante ALTER TABLE ... ADD COLUMN IF NOT EXISTS. No destructiva.
--
-- Problema que resuelve: con la app entera usando el identificador fijo
-- "usuario_demo", las métricas de captación no se podían atribuir a nadie.
-- Además, la tabla leads NO guardaba de qué visitante venía el contacto, así
-- que era imposible saber cuántos visitantes que hicieron un diagnóstico
-- acabaron dejando el teléfono: el denominador era el número de análisis, no
-- de personas, y un agricultor que repetía cinco veces machacaba la tasa de
-- conversión.
--
--   - usuario_id .... UUID de la cookie httpOnly `tr_uid`, que emite
--                     src/proxy.ts en la primera petición del visitante.
--                     Es el mismo valor que se guarda en diagnosticos, y por
--                     eso se pueden cruzar ambos para medir conversión.
--                     NULL en los leads anteriores a esta migración.
--
-- Índice por (usuario_id) para no penalizar el listado cuando se cruce con
-- el historial de cada visitante.
--
-- NOTA: los diagnósticos históricos que usaban "usuario_demo" quedan fuera de
-- las métricas por visitante. Es intencionado: no son visitantes reales, son
-- pruebas de desarrollo, y mezclarlos falsearía el embudo.
--
-- Su borrado NO se hace aquí ni en initDatabase(). Estuvo un tiempo como
-- DELETE dentro de aplicarMigraciones(), y se sacó de ahí porque una operación
-- destructiva no puede vivir en la inicialización, que corre desde las
-- peticiones. La limpieza puntual está en db/one-off/limpiar-usuario-demo.mjs,
-- que muestra lo que borraría y exige --aplicar.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS usuario_id TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_usuario ON leads(usuario_id);
