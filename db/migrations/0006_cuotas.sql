-- ============================================================================
-- Migración 0006: cuotas de uso compartidas
-- ============================================================================
--
-- Aplicada de forma IDEMPOTENTE por `initDatabase()` (src/lib/database.ts).
-- No destructiva.
--
-- Problema que resuelve: POST /api/diagnostico no tenía ningún límite de
-- peticiones. El único rate limit del proyecto vivía en el Map de /api/leads,
-- que al ser memoria del módulo solo existe dentro de una instancia: con ocho
-- instancias, "5 leads por IP y hora" son cuarenta.
--
-- Además, un solo analyse puede disparar hasta 56 llamadas al proveedor (con
-- reintentos en cada fase y el fallback completo al segundo proveedor) frente a
-- las 3 del caso nominal. Sin un tope, cualquiera que encuentre la URL puede
-- vaciar la cuenta, y el único límite real era la cuota gratuita del
-- proveedor, que no es un control nuestro.
--
-- Por qué una tabla y no el Map en memoria:
--   - El límite pasa a ser global: lo respetan todas las instancias.
--   - Sobrevive a la reciclaje de una instancia en Vercel.
--   - Permite ver el consumo desde /admin, no solo bloquearlo.
--
-- Tabla:
--   - clave ......... ventana única y estable. Formato:
--                     "diag:<uid>:<YYYYMMDD>" por visitante y día, y
--                     "diag:global:<YYYYMMDD>" para el tope total del día.
--   - contador ...... usos consumidos en la ventana.
--   - limite ........ usos máximos de la ventana.
--   - resets_en ..... instante en que la ventana caduca. Se consulta antes de
--                     decidir, de modo que una ventana vencida se renueva sola
--                     sin necesidad de tarea programada.
--
-- La ventana se renueva SOLO si ya venció, nunca se resetea al alcanzar el
-- límite: si se reiniciara al llegar al tope, un atacante que alcance el
-- límite se auto-liberaría y la cuota no valdría nada.
--
-- El consumo se descuenta antes de llamar a la IA. Si el analyze falla más
-- tarde, el uso se cuenta igualmente, porque el coste ya se ha producido en el
-- proveedor: es preferible contar de más que permitir reintentos ilimitados.

CREATE TABLE IF NOT EXISTS cuotas (
  clave TEXT PRIMARY KEY,
  contador INTEGER NOT NULL DEFAULT 0,
  limite INTEGER NOT NULL,
  resets_en TIMESTAMPTZ NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cuotas_resets ON cuotas(resets_en);
