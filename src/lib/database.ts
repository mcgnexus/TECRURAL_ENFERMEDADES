import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import type { DiagnosticoResponse, DiagnosticoWithMeta } from "@/types/diagnostico";

let sql: NeonQueryFunction<false, false> | null = null;

function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL no configurada");
    }
    sql = neon(url);
  }
  return sql;
}

export async function initDatabase() {
  const db = getSql();
  await db`
    CREATE TABLE IF NOT EXISTS diagnosticos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id TEXT NOT NULL,
      imagen_url TEXT NOT NULL,
      organo TEXT NOT NULL,
      especie TEXT NOT NULL,
      diagnostico_json JSONB NOT NULL,
      nombre_planta TEXT,
      feedback_usuario TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await db`
    ALTER TABLE diagnosticos
    ADD COLUMN IF NOT EXISTS nombre_planta TEXT
  `;
  
  await db`
    CREATE INDEX IF NOT EXISTS idx_diagnosticos_usuario 
    ON diagnosticos(usuario_id)
  `;
  
  await db`
    CREATE INDEX IF NOT EXISTS idx_diagnosticos_created 
    ON diagnosticos(created_at DESC)
  `;
}

export async function guardarDiagnostico(
  usuarioId: string,
  imagenUrl: string,
  diagnostico: DiagnosticoResponse,
  nombrePlanta?: string,
  feedbackUsuario?: string
): Promise<DiagnosticoWithMeta> {
  const db = getSql();
  const [row] = await db`
    INSERT INTO diagnosticos (usuario_id, imagen_url, organo, especie, diagnostico_json, nombre_planta, feedback_usuario)
    VALUES (${usuarioId}, ${imagenUrl}, ${diagnostico.organo_detectado}, ${diagnostico.especie_identificada}, ${JSON.stringify(diagnostico)}, ${nombrePlanta ?? null}, ${feedbackUsuario ?? null})
    RETURNING id, usuario_id, imagen_url, organo, especie, diagnostico_json, nombre_planta, feedback_usuario, created_at
  `;
  
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    imagen_url: row.imagen_url,
    organo_detectado: row.organo,
    especie_identificada: row.especie,
    ...row.diagnostico_json,
    nombre_planta: row.nombre_planta,
    feedback_usuario: row.feedback_usuario,
    created_at: row.created_at,
  };
}

export async function actualizarFeedback(
  diagnosticoId: string,
  feedback: string
): Promise<void> {
  const db = getSql();
  await db`
    UPDATE diagnosticos 
    SET feedback_usuario = ${feedback}
    WHERE id = ${diagnosticoId}
  `;
}

export async function obtenerHistorial(usuarioId: string, limit = 50): Promise<DiagnosticoWithMeta[]> {
  const db = getSql();
  const rows = await db`
    SELECT id, usuario_id, imagen_url, organo, especie, diagnostico_json, nombre_planta, feedback_usuario, created_at
    FROM diagnosticos
    WHERE usuario_id = ${usuarioId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  
  return rows.map((row) => ({
    id: row.id,
    usuario_id: row.usuario_id,
    imagen_url: row.imagen_url,
    organo_detectado: row.organo,
    especie_identificada: row.especie,
    ...row.diagnostico_json,
    nombre_planta: row.nombre_planta,
    feedback_usuario: row.feedback_usuario,
    created_at: row.created_at,
  }));
}