import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { DiagnosticoResponse, DiagnosticoWithMeta, ContextoUsuario } from "@/types/diagnostico";
import type {
  ContextoDiagnosticoLead,
  EstadoLead,
  LeadFila,
  OrigenLead,
  PrioridadLead,
} from "@/types/lead";

let sql: NeonQueryFunction<false, false> | null = null;

/** El DDL idempotente se ejecuta una sola vez por instancia. Medido: las 24
 * sentencias costaban ~1,3 s en cada petición, incluidos los análisis, donde el
 * usuario está esperando el resultado. En un entorno serverless la instancia
 * se recicla, pero entonces las tablas ya existen y el coste es cero. */
let initPromesa: Promise<void> | null = null;

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

function aplicarMigraciones(): Promise<void> {
  const db = getSql();
  return (async () => {
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

  // Migraciones incrementales idempotentes (ver db/migrations)
  await db`
    ALTER TABLE diagnosticos
    ADD COLUMN IF NOT EXISTS contexto_usuario JSONB
  `;

  await db`
    ALTER TABLE diagnosticos
    ADD COLUMN IF NOT EXISTS proveedor TEXT
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_diagnosticos_usuario
    ON diagnosticos(usuario_id)
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_diagnosticos_created
    ON diagnosticos(created_at DESC)
  `;

  // Tabla de leads comerciales (migración idempotente, ver db/migrations/0001_leads.sql)
  await db`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      diagnostico_id UUID REFERENCES diagnosticos(id) ON DELETE SET NULL,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      municipio TEXT,
      cultivo TEXT,
      hectareas NUMERIC,
      mensaje TEXT,
      origen TEXT NOT NULL DEFAULT 'post_diagnostico',
      prioridad TEXT NOT NULL DEFAULT 'baja',
      puntuacion INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'nuevo',
      contexto_diagnostico JSONB,
      consentimiento_rgpd BOOLEAN NOT NULL DEFAULT FALSE,
      ip TEXT,
      imagenes JSONB,
      consentimiento_comercial BOOLEAN NOT NULL DEFAULT FALSE,
      consentimiento_comercial_fecha TIMESTAMPTZ,
      consentimiento_texto_version TEXT,
      canal_comercial TEXT,
      baja_comercial BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Migración 0002: columnas de consentimiento y fotos compartidas con la revisión
  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS imagenes JSONB
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS consentimiento_comercial BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS consentimiento_comercial_fecha TIMESTAMPTZ
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS consentimiento_texto_version TEXT
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS canal_comercial TEXT
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS baja_comercial BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC)
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_leads_prioridad ON leads(prioridad, estado)
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_leads_telefono ON leads(telefono)
  `;

  // Migración 0003: datos comerciales (síntoma, canal de contacto, UTM/campaña)
  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS sintoma TEXT
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS canal_contacto TEXT
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS origen_campana TEXT
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS utm_source TEXT
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS utm_medium TEXT
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS utm_campaign TEXT
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS utm_content TEXT
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS utm_term TEXT
  `;

  // Migración 0004: métricas de captación. Sin marca de tiempo del primer
  // contacto no se puede medir el tiempo de respuesta, que es la única forma
  // de saber si el embudo funciona.
  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS primera_response_at TIMESTAMPTZ
  `;

  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS notas TEXT
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_leads_created_at
    ON leads(created_at DESC)
  `;

  // Migración 0005: atribución de leads a un visitante, para poder medir
  // conversión por personas y no por análisis.
  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS usuario_id TEXT
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_leads_usuario
    ON leads(usuario_id)
  `;

  // Los diagnósticos de las pruebas de desarrollo usaban el identificador fijo
  // "usuario_demo". No son visitantes reales y contarlos hundiría la tasa de
  // conversión. Es idempotente: cuando no quedan, el DELETE no afecta a nadie.
  await db`
    DELETE FROM diagnosticos WHERE usuario_id = 'usuario_demo'
  `;
  })();
}

export async function initDatabase(): Promise<void> {
  if (!initPromesa) {
    initPromesa = aplicarMigraciones().catch((error) => {
      // Se permite reintentar en la siguiente petición si falló.
      initPromesa = null;
      throw error;
    });
  }
  return initPromesa;
}

export interface NuevoLead {
  /** UUID de visitante (cookie httpOnly del proxy). NULL si no se pudo leer. */
  usuarioId?: string;
  nombre: string;
  telefono: string;
  municipio?: string;
  cultivo?: string;
  sintoma?: string;
  hectareas?: number;
  mensaje?: string;
  diagnosticoId?: string;
  origen: OrigenLead;
  canalContacto?: string;
  prioridad: PrioridadLead;
  puntuacion: number;
  contexto?: ContextoDiagnosticoLead;
  consentimientoComercial?: boolean;
  consentimientoTextoVersion?: string;
  canalComercial?: string;
  origenCampana?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  imagenes?: string[];
  ip?: string;
}

export async function guardarLead(lead: NuevoLead): Promise<LeadFila> {
  const db = getSql();
  const [row] = await db`
    INSERT INTO leads (
      usuario_id, diagnostico_id, nombre, telefono, municipio, cultivo, sintoma, hectareas,
      mensaje, origen, canal_contacto, prioridad, puntuacion, contexto_diagnostico, ip,
      imagenes, consentimiento_comercial, consentimiento_comercial_fecha,
      consentimiento_texto_version, canal_comercial,
      origen_campana, utm_source, utm_medium, utm_campaign, utm_content, utm_term
    )
    VALUES (
      ${lead.usuarioId ?? null},
      ${lead.diagnosticoId ?? null},
      ${lead.nombre},
      ${lead.telefono},
      ${lead.municipio ?? null},
      ${lead.cultivo ?? null},
      ${lead.sintoma ?? null},
      ${lead.hectareas ?? null},
      ${lead.mensaje ?? null},
      ${lead.origen},
      ${lead.canalContacto ?? null},
      ${lead.prioridad},
      ${lead.puntuacion},
      ${lead.contexto ? JSON.stringify(lead.contexto) : null},
      ${lead.ip ?? null},
      ${lead.imagenes && lead.imagenes.length > 0 ? JSON.stringify(lead.imagenes) : null},
      ${lead.consentimientoComercial ?? false},
      ${lead.consentimientoComercial ? new Date().toISOString() : null},
      ${lead.consentimientoComercial ? lead.consentimientoTextoVersion ?? null : null},
      ${lead.consentimientoComercial ? lead.canalComercial ?? null : null},
      ${lead.origenCampana ?? null},
      ${lead.utmSource ?? null},
      ${lead.utmMedium ?? null},
      ${lead.utmCampaign ?? null},
      ${lead.utmContent ?? null},
      ${lead.utmTerm ?? null}
    )
    RETURNING id, diagnostico_id, nombre, telefono, municipio, cultivo, sintoma, hectareas,
              mensaje, origen, canal_contacto, prioridad, puntuacion, estado, contexto_diagnostico,
              consentimiento_comercial, consentimiento_texto_version, canal_comercial,
              baja_comercial, imagenes, origen_campana, utm_source, utm_medium, utm_campaign,
              utm_content, utm_term, primera_response_at, notas, created_at
  `;

  return mapearLead(row);
}

export async function actualizarEstadoLead(id: string, estado: string): Promise<boolean> {
  const db = getSql();
  const rows = await db`
    UPDATE leads
    SET estado = ${estado},
        primera_response_at = CASE
          WHEN estado = 'nuevo' AND ${estado} <> 'nuevo' AND primera_response_at IS NULL
          THEN NOW()
          ELSE primera_response_at
        END
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}

/** Anota el lead con una nota interna del técnico. */
export async function guardarNotaLead(id: string, notas: string): Promise<boolean> {
  const db = getSql();
  const rows = await db`
    UPDATE leads SET notas = ${notas} WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

export async function bajaComercial(telefonoNormalizada: string): Promise<number> {
  const db = getSql();
  const rows = await db`
    UPDATE leads
    SET consentimiento_comercial = FALSE,
        baja_comercial = TRUE,
        consentimiento_comercial_fecha = NOW()
    WHERE telefono = ${telefonoNormalizada} AND baja_comercial = FALSE
    RETURNING id
  `;
  return rows.length;
}

export async function obtenerLeads(
  filtros: { estado?: EstadoLead; prioridad?: PrioridadLead; limit?: number } = {}
): Promise<LeadFila[]> {
  const db = getSql();
  const limit = Math.min(Math.max(filtros.limit ?? 100, 1), 500);

  if (filtros.estado && filtros.prioridad) {
    const rows = await db`
      SELECT id, diagnostico_id, nombre, telefono, municipio, cultivo, sintoma, hectareas,
             mensaje, origen, canal_contacto, prioridad, puntuacion, estado, contexto_diagnostico,
             consentimiento_comercial, consentimiento_texto_version, canal_comercial,
             baja_comercial, jsonb_array_length(imagenes) AS num_imagenes,
             origen_campana, utm_source, utm_medium, utm_campaign, utm_content, utm_term, primera_response_at, notas, created_at
      FROM leads
      WHERE estado = ${filtros.estado} AND prioridad = ${filtros.prioridad}
      ORDER BY puntuacion DESC, created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(mapearLead);
  }

  if (filtros.estado) {
    const rows = await db`
      SELECT id, diagnostico_id, nombre, telefono, municipio, cultivo, sintoma, hectareas,
             mensaje, origen, canal_contacto, prioridad, puntuacion, estado, contexto_diagnostico,
             consentimiento_comercial, consentimiento_texto_version, canal_comercial,
             baja_comercial, jsonb_array_length(imagenes) AS num_imagenes,
             origen_campana, utm_source, utm_medium, utm_campaign, utm_content, utm_term, primera_response_at, notas, created_at
      FROM leads
      WHERE estado = ${filtros.estado}
      ORDER BY puntuacion DESC, created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(mapearLead);
  }

  if (filtros.prioridad) {
    const rows = await db`
      SELECT id, diagnostico_id, nombre, telefono, municipio, cultivo, sintoma, hectareas,
             mensaje, origen, canal_contacto, prioridad, puntuacion, estado, contexto_diagnostico,
             consentimiento_comercial, consentimiento_texto_version, canal_comercial,
             baja_comercial, jsonb_array_length(imagenes) AS num_imagenes,
             origen_campana, utm_source, utm_medium, utm_campaign, utm_content, utm_term, primera_response_at, notas, created_at
      FROM leads
      WHERE prioridad = ${filtros.prioridad}
      ORDER BY puntuacion DESC, created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(mapearLead);
  }

  const rows = await db`
    SELECT id, diagnostico_id, nombre, telefono, municipio, cultivo, hectareas,
           mensaje, origen, prioridad, puntuacion, estado, contexto_diagnostico,
           consentimiento_comercial, consentimiento_texto_version, canal_comercial,
           baja_comercial, jsonb_array_length(imagenes) AS num_imagenes,
           primera_response_at, notas, created_at
    FROM leads
    ORDER BY puntuacion DESC, created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapearLead);
}

// ============================================================================
// MÉTRICAS DE CAPTACIÓN
// ============================================================================

export interface MetricasCaptacion {
  /** Visitantes distintos que han hecho al menos un diagnóstico. */
  visitantes: number;
  /** Análisis completados, con independencia de quién los pidiera. */
  diagnosticos: number;
  /** Análisis por visitante. Alto = uso repetido, no más oportunidades. */
  diagnosticosPorVisitante: number;
  leads: number;
  /** Visitantes distintos que han dejado contacto. */
  visitantesConLead: number;
  /** Porcentaje de visitantes que han convertido. Es la cifra de negocio. */
  tasaConversion: number | null;
  /** Leads por análisis. Complementario, no sustituye a la tasa anterior. */
  leadsPorDiagnostico: number | null;
  porEstado: { estado: EstadoLead; total: number }[];
  porPrioridad: { prioridad: PrioridadLead; total: number }[];
  porOrigen: { origen: OrigenLead; total: number }[];
  porDia: { dia: string; visitantes: number; diagnosticos: number; leads: number }[];
  tiempoMedioRespuestaHoras: number | null;
  leadsSinResponder: number;
  conversionComercial: number;
  porCampana: { campana: string; total: number }[];
}

const DIAS_SERIE = 30;

/**
 * Embudo por personas, no por análisis.
 *
 * El denominador es el número de VISITANTES distintos, no el de análisis. Es
 * la diferencia entre medir algo y medir ruido: un agricultor que sube ocho
 * fotos en un minuto es un visitante que no vale ocho oportunidades
 * comerciales. Por eso se distinguen:
 *   - tasaConversion ......... visitantes con lead / visitantes (negocio)
 *   - leadsPorDiagnostico .... total de leads / análisis (volumen)
 *
 * Los leads con usuario_id NULL (anteriores a la atribución) no cuentan como
 * visitantes convertidos: sumarlos inflaría el numerador sin que exista el
 * denominador correspondiente.
 */
export async function obtenerMetricasCaptacion(): Promise<MetricasCaptacion> {
  const db = getSql();
  // Ojo: make_interval y no `NOW() - '-30 days'::interval`. Ese literal es un
  // intervalo NEGATIVO, así que restarlo suma días hacia el futuro y la serie
  // temporal salía vacía. Con make_interval(days => 30) no hay ambigüedad.
  const rangoDias = DIAS_SERIE;

  const [diagRows, visitantesRows, leadRows, leadUidRows, estadoRows, prioridadRows, origenRows, serieRows, respuestaRows, campanaRows] =
    await Promise.all([
      db`SELECT COUNT(*)::int AS total FROM diagnosticos`,
      db`SELECT COUNT(DISTINCT usuario_id)::int AS total FROM diagnosticos WHERE usuario_id IS NOT NULL`,
      db`SELECT COUNT(*)::int AS total FROM leads`,
      db`SELECT COUNT(DISTINCT usuario_id)::int AS total FROM leads WHERE usuario_id IS NOT NULL`,
      db`SELECT estado, COUNT(*)::int AS total FROM leads GROUP BY estado ORDER BY total DESC`,
      db`SELECT prioridad, COUNT(*)::int AS total FROM leads GROUP BY prioridad`,
      db`SELECT origen, COUNT(*)::int AS total FROM leads GROUP BY origen`,
      db`
        WITH dias AS (
          SELECT generate_series(
            date_trunc('day', NOW() - make_interval(days => ${rangoDias}::int)),
            date_trunc('day', NOW()),
            interval '1 day'
          ) AS dia
        ),
        d AS (
          SELECT date_trunc('day', created_at) AS dia,
                 COUNT(*)::int AS total,
                 COUNT(DISTINCT usuario_id)::int AS visitantes
          FROM diagnosticos WHERE usuario_id IS NOT NULL GROUP BY 1
        ),
        l AS (
          SELECT date_trunc('day', created_at) AS dia, COUNT(*)::int AS total
          FROM leads GROUP BY 1
        )
        SELECT
          to_char(dias.dia, 'YYYY-MM-DD') AS dia,
          COALESCE(d.visitantes, 0) AS visitantes,
          COALESCE(d.total, 0) AS diagnosticos,
          COALESCE(l.total, 0) AS leads
        FROM dias
        LEFT JOIN d ON d.dia = dias.dia
        LEFT JOIN l ON l.dia = dias.dia
        ORDER BY dias.dia ASC
      `,
      db`
        SELECT
          COUNT(*)::int AS respondidos,
          AVG(EXTRACT(EPOCH FROM (primera_response_at - created_at)) / 3600) AS media_horas
        FROM leads
        WHERE primera_response_at IS NOT NULL
      `,
      db`
        SELECT COALESCE(utm_campaign, origen_campana) AS campana, COUNT(*)::int AS total
        FROM leads
        GROUP BY 1 ORDER BY total DESC
      `,
    ]);

  const diagnosticos = Number(diagRows[0]?.total ?? 0);
  const visitantes = Number(visitantesRows[0]?.total ?? 0);
  const leads = Number(leadRows[0]?.total ?? 0);
  const visitantesConLead = Number(leadUidRows[0]?.total ?? 0);
  const respondidos = Number(respuestaRows[0]?.respondidos ?? 0);
  const media = respuestaRows[0]?.media_horas;
  const conConsentimiento = await db`
    SELECT COUNT(*)::int AS total FROM leads WHERE consentimiento_comercial = TRUE
  `;

  return {
    visitantes,
    diagnosticos,
    diagnosticosPorVisitante: visitantes > 0 ? diagnosticos / visitantes : 0,
    leads,
    visitantesConLead,
    // Se limita a 1: con un solo visitante que analiza y contacta varias
    // veces, el cociente puede pasar de 100 % y la tarjeta mentiría.
    tasaConversion: visitantes > 0 ? Math.min(1, visitantesConLead / visitantes) : null,
    leadsPorDiagnostico: diagnosticos > 0 ? leads / diagnosticos : null,
    porEstado: estadoRows.map((r) => ({ estado: r.estado as EstadoLead, total: Number(r.total) })),
    porPrioridad: prioridadRows.map((r) => ({
      prioridad: r.prioridad as PrioridadLead,
      total: Number(r.total),
    })),
    porOrigen: origenRows.map((r) => ({ origen: r.origen as OrigenLead, total: Number(r.total) })),
    porDia: serieRows.map((r) => ({
      dia: String(r.dia),
      visitantes: Number(r.visitantes),
      diagnosticos: Number(r.diagnosticos),
      leads: Number(r.leads),
    })),
    tiempoMedioRespuestaHoras: media != null ? Number(media) : null,
    leadsSinResponder: leads - respondidos,
    conversionComercial: leads > 0 ? Number(conConsentimiento[0]?.total ?? 0) / leads : 0,
    porCampana: campanaRows
      .filter((r) => r.campana)
      .map((r) => ({ campana: String(r.campana), total: Number(r.total) })),
  };
}

type LeadRow = Record<string, unknown>;
function mapearLead(row: LeadRow): LeadFila {
  return {
    id: row.id as string,
    diagnostico_id: (row.diagnostico_id as string | null) ?? null,
    nombre: row.nombre as string,
    telefono: row.telefono as string,
    municipio: (row.municipio as string | null) ?? null,
    cultivo: (row.cultivo as string | null) ?? null,
    sintoma: (row.sintoma as string | null) ?? null,
    hectareas: row.hectareas !== null && row.hectareas !== undefined ? Number(row.hectareas) : null,
    mensaje: (row.mensaje as string | null) ?? null,
    origen: row.origen as OrigenLead,
    canal_contacto: (row.canal_contacto as string | null) ?? null,
    prioridad: row.prioridad as PrioridadLead,
    puntuacion: Number(row.puntuacion),
    estado: row.estado as EstadoLead,
    contexto_diagnostico: (row.contexto_diagnostico as ContextoDiagnosticoLead | null) ?? null,
    consentimiento_comercial: Boolean(row.consentimiento_comercial),
    consentimiento_texto_version: (row.consentimiento_texto_version as string | null) ?? null,
    canal_comercial: (row.canal_comercial as string | null) ?? null,
    baja_comercial: Boolean(row.baja_comercial),
    num_imagenes: row.num_imagenes !== null && row.num_imagenes !== undefined ? Number(row.num_imagenes) : 0,
    origen_campana: (row.origen_campana as string | null) ?? null,
    utm_source: (row.utm_source as string | null) ?? null,
    utm_medium: (row.utm_medium as string | null) ?? null,
    utm_campaign: (row.utm_campaign as string | null) ?? null,
    utm_content: (row.utm_content as string | null) ?? null,
    utm_term: (row.utm_term as string | null) ?? null,
    primera_response_at: (row.primera_response_at as Date | string | null)?.toString() ?? null,
    notas: (row.notas as string | null) ?? null,
    created_at: (row.created_at as Date | string).toString(),
  };
}

export async function guardarDiagnostico(
  usuarioId: string,
  imagenUrl: string,
  diagnostico: DiagnosticoResponse,
  nombrePlanta?: string,
  feedbackUsuario?: string,
  contextoUsuario?: ContextoUsuario,
  proveedor?: string
): Promise<DiagnosticoWithMeta> {
  const db = getSql();
  const [row] = await db`
    INSERT INTO diagnosticos (usuario_id, imagen_url, organo, especie, diagnostico_json, nombre_planta, feedback_usuario, contexto_usuario, proveedor)
    VALUES (${usuarioId}, ${imagenUrl}, ${diagnostico.organo_detectado}, ${diagnostico.especie_identificada}, ${JSON.stringify(diagnostico)}, ${nombrePlanta ?? null}, ${feedbackUsuario ?? null}, ${contextoUsuario ? JSON.stringify(contextoUsuario) : null}, ${proveedor ?? null})
    RETURNING id, usuario_id, imagen_url, organo, especie, diagnostico_json, nombre_planta, feedback_usuario, contexto_usuario, proveedor, created_at
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
    contexto_usuario: row.contexto_usuario,
    proveedor_usado: row.proveedor ?? undefined,
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
    SELECT id, usuario_id, imagen_url, organo, especie, diagnostico_json, nombre_planta, feedback_usuario, contexto_usuario, proveedor, created_at
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
    contexto_usuario: row.contexto_usuario,
    proveedor_usado: row.proveedor ?? undefined,
    created_at: row.created_at,
  }));
}