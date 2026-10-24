import { createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { enmascararIp } from "./accesos-ip";
import {
  derivarConsentimientoAgregado,
  fuenteConsentimientoComercial,
  parsearConsentimientosComerciales,
} from "./consentimiento-comercial";
import type {
  ContextoUsuario,
  DiagnosticoPanelFila,
  DiagnosticoResponse,
  DiagnosticoWithMeta,
  DiagnosticosPanel,
} from "@/types/diagnostico";
import type {
  ConsentimientoComercialRegistrado,
  ContextoDiagnosticoLead,
  EstadoLead,
  LeadFila,
  MetricasCaptacion,
  OrigenLead,
  PrioridadLead,
} from "@/types/lead";

let sql: NeonQueryFunction<false, false> | null = null;

/** Promesa compartida por el comando explícito `npm run db:migrate`. */
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

  // Aquí se ejecutaba un DELETE de los diagnósticos de prueba con
  // usuario_id = 'usuario_demo'. Se ha quitado a propósito y no debe volver:
  //
  //   - Era una operación DESTRUCTIVA dentro de la inicialización, y la
  //     inicialización corre desde las peticiones. Un borrado de datos no puede
  //     depender de que alguien haga una petición.
  //   - No hay forma de que esos registros vuelvan: el identificador de
  //     visitante lo emite el proxy como UUID y el cuerpo de la petición ya no
  //     se acepta, así que 'usuario_demo' no puede crearse de nuevo.
  //
  // La limpieza puntual, con su previsualización, vive en
  // db/one-off/limpiar-usuario-demo.mjs. Este método solo crea y altera
  // esquema; nunca borra filas.

  // Migración 0006: cuotas legacy, conservadas para compatibilidad histórica.
  await db`
    CREATE TABLE IF NOT EXISTS cuotas (
      clave TEXT PRIMARY KEY,
      contador INTEGER NOT NULL DEFAULT 0,
      limite INTEGER NOT NULL,
      resets_en TIMESTAMPTZ NOT NULL,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Una fila por ventana (visitante+día, y el total del día). Se consultan
  // juntas para decidir en una sola vuelta de base de datos.
  await db`
    CREATE INDEX IF NOT EXISTS idx_cuotas_resets
    ON cuotas(resets_en)
  `;

  // Consumos con marca de tiempo individual: los límites se calculan sobre
  // ventanas móviles reales, no por día UTC.
  await db`
    CREATE TABLE IF NOT EXISTS cuota_usos (
      id BIGSERIAL PRIMARY KEY,
      ambito TEXT NOT NULL,
      sujeto TEXT NOT NULL,
      visitor_id TEXT,
      telefono_hash TEXT,
      ip TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_cuota_usos_ambito_sujeto_fecha
    ON cuota_usos (ambito, sujeto, creado_en DESC)
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_cuota_usos_fecha
    ON cuota_usos (creado_en)
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_cuota_usos_telefono_fecha
    ON cuota_usos (telefono_hash, creado_en DESC)
    WHERE telefono_hash IS NOT NULL
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_cuota_usos_ip_fecha
    ON cuota_usos (ip, creado_en DESC)
    WHERE ip IS NOT NULL
  `;

  await db`ALTER TABLE cuota_usos ADD COLUMN IF NOT EXISTS request_id UUID`;
  await db`
    CREATE INDEX IF NOT EXISTS idx_cuota_usos_request_id
    ON cuota_usos (request_id) WHERE request_id IS NOT NULL
  `;

  // Solo se conserva HMAC del teléfono para vincular la cuota semanal. El
  // teléfono original no se almacena ni se usa para comunicaciones.
  await db`
    CREATE TABLE IF NOT EXISTS cuota_telefonos (
      visitor_id TEXT PRIMARY KEY,
      telefono_hash TEXT NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expira_en TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days')
    )
  `;

  await db`
    ALTER TABLE cuota_telefonos
    ADD COLUMN IF NOT EXISTS expira_en TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days')
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_cuota_telefonos_hash
    ON cuota_telefonos (telefono_hash)
  `;

  // Migración 0007: embudo de captación.
  await db`
    CREATE TABLE IF NOT EXISTS eventos (
      id BIGSERIAL PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      evento TEXT NOT NULL,
      params JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Una fila por visitante y evento y día: el embudo se mide por personas, y
  // repetir el mismo paso 20 veces en un día es ruido, no 20 oportunidades.
  //
  // La columna calculada lleva IMMUTABLE porque Postgres exige que las
  // funciones de un índice sean deterministas, y created_at tiene NOW() por
  // defecto, que es estable. Si se hiciera con date_trunc('day', created_at)
  // directamente en la expresión del índice, Postgres lo rechaza con
  // "functions in index expression must be marked IMMUTABLE".
  await db`
    ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS dia DATE
      GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED
  `;

  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_unico
    ON eventos(visitor_id, evento, dia)
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_eventos_created
    ON eventos(created_at DESC)
  `;

  // Migración 0010: correo de contacto.
  //
  // El informe completo ya no exige teléfono: basta con un teléfono O un correo.
  // `telefono` se conserva como NOT NULL porque relajar esa restricción exige
  // una sentencia que el guard de scripts/comprobar-esquema-sin-borrados.mjs
  // no admite en esta función, así que un lead que solo deja correo se guarda
  // con cadena vacía en `telefono` (ver src/types/lead.ts y la validación de
  // src/app/api/leads/route.ts, que exige al menos uno de los dos).
  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS email TEXT
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_leads_email
    ON leads(email)
  `;

  // Migración 0011: solicitud de revisión explícita. En el formulario posterior
  // al diagnóstico, pedir que un técnico revise el caso es una casilla opcional
  // y aparte del desbloqueo del informe; guardarla en la fila permite separar
  // oportunidades reales de envíos "solo informe" en el panel y los avisos.
  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS solicitud_revision BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_leads_solicitud_revision
    ON leads(solicitud_revision, created_at DESC)
  `;

  // Migración 0012: consentimiento comercial explícito por canal. El array
  // conserva fecha, versión y origen de cada autorización; los campos agregados
  // (booleano, canal y versión) se derivan de él en guardarLead.
  await db`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS consentimientos_comerciales JSONB NOT NULL DEFAULT '[]'
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_leads_consentimientos_comerciales
    ON leads USING GIN (consentimientos_comerciales)
  `;

  // Migración 0013: enlaces de recuperación del informe. Se guarda solo el
  // SHA-256 del token; el token en claro viaja una vez en el correo y no se
  // persiste. La caducidad se resuelve filtrando por `expira_en` al leer, porque
  // esta función no puede ejecutar UPDATE ni DELETE (guard de prebuild).
  await db`
    CREATE TABLE IF NOT EXISTS enlaces_informe (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      diagnostico_id UUID REFERENCES diagnosticos(id) ON DELETE SET NULL,
      token_hash TEXT NOT NULL UNIQUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expira_en TIMESTAMPTZ NOT NULL,
      ultimo_acceso_en TIMESTAMPTZ,
      accesos INTEGER NOT NULL DEFAULT 0
    )
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_enlaces_informe_token
    ON enlaces_informe(token_hash)
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_enlaces_informe_diagnostico
    ON enlaces_informe(diagnostico_id, creado_en DESC)
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
  /** Cadena vacía cuando la persona solo dejó correo (la columna es NOT NULL). */
  telefono: string;
  /** Correo de contacto, si lo dejó. */
  email?: string;
  municipio?: string;
  cultivo?: string;
  sintoma?: string;
  hectareas?: number;
  mensaje?: string;
  diagnosticoId?: string;
  origen: OrigenLead;
  /** true solo cuando la persona pidió además la revisión técnica del caso. */
  solicitudRevision?: boolean;
  canalContacto?: string;
  prioridad: PrioridadLead;
  puntuacion: number;
  contexto?: ContextoDiagnosticoLead;
  /**
   * Autorizaciones comerciales explícitas. Los campos agregados de la fila
   * (booleano, canal, versión y fecha) se derivan de aquí dentro de guardarLead:
   * así no pueden desincronizarse.
   */
  consentimientosComerciales?: ConsentimientoComercialRegistrado[];
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
  const consentimientos = lead.consentimientosComerciales ?? [];
  const agregado = derivarConsentimientoAgregado(consentimientos);
  const [row] = await db`
    INSERT INTO leads (
      usuario_id, diagnostico_id, nombre, telefono, email, municipio, cultivo, sintoma, hectareas,
      mensaje, origen, solicitud_revision, canal_contacto, prioridad, puntuacion, contexto_diagnostico, ip,
      imagenes, consentimiento_comercial, consentimiento_comercial_fecha,
      consentimiento_texto_version, canal_comercial, consentimientos_comerciales,
      origen_campana, utm_source, utm_medium, utm_campaign, utm_content, utm_term
    )
    VALUES (
      ${lead.usuarioId ?? null},
      ${lead.diagnosticoId ?? null},
      ${lead.nombre},
      ${lead.telefono},
      ${lead.email ?? null},
      ${lead.municipio ?? null},
      ${lead.cultivo ?? null},
      ${lead.sintoma ?? null},
      ${lead.hectareas ?? null},
      ${lead.mensaje ?? null},
      ${lead.origen},
      ${lead.solicitudRevision ?? false},
      ${lead.canalContacto ?? null},
      ${lead.prioridad},
      ${lead.puntuacion},
      ${lead.contexto ? JSON.stringify(lead.contexto) : null},
      ${lead.ip ?? null},
      ${lead.imagenes && lead.imagenes.length > 0 ? JSON.stringify(lead.imagenes) : null},
      ${agregado.consentimiento_comercial},
      ${agregado.consentimiento_comercial_fecha},
      ${agregado.consentimiento_texto_version},
      ${agregado.canal_comercial},
      ${JSON.stringify(consentimientos)},
      ${lead.origenCampana ?? null},
      ${lead.utmSource ?? null},
      ${lead.utmMedium ?? null},
      ${lead.utmCampaign ?? null},
      ${lead.utmContent ?? null},
      ${lead.utmTerm ?? null}
    )
    RETURNING id, diagnostico_id, nombre, telefono, email, municipio, cultivo, sintoma, hectareas,
              mensaje, origen, canal_contacto, solicitud_revision, prioridad, puntuacion, estado,
              contexto_diagnostico,
              consentimiento_comercial, consentimiento_comercial_fecha,
              consentimiento_texto_version, canal_comercial,
              consentimientos_comerciales,
              baja_comercial, jsonb_array_length(imagenes) AS num_imagenes,
              origen_campana, utm_source, utm_medium, utm_campaign,
              utm_content, utm_term, primera_response_at, notas, created_at
  `;

  return mapearLead(row);
}

/**
 * Fotos de un lead concreto, una a una.
 *
 * El listado NUNCA trae las imágenes, solo jsonb_array_length. Y no es
 * descuido: con hasta 3 fotos de WebP por lead, devolverlas en el listado
 * multiplicaría por varios megas cada respuesta de /admin, que con 100 leads
 * son cientos de megabytes de fotos que el técnico no va a mirar. Por eso van
 * aparte, bajo demanda.
 *
 * Se pide una por índice (`indice`) en lugar de todas juntas para no arrastrar
 * 3 fotos cuando solo se quiere ver una, y para que un `<img>` del panel
 * pueda apuntar directamente a una URL.
 */
export async function obtenerFotoLead(
  leadId: string,
  indice: number
): Promise<{ dataUrl: string; mimeType: string } | null> {
  const db = getSql();
  // El índice llega como parámetro ligado, y el operador -> de JSONB exige un
  // entero: sin el ::int explícito, Postgres no sabe si interpretarlo como
  // posición o como clave de objeto, y devuelve null en lugar de la foto.
  const i = Math.trunc(indice);
  const rows = await db`
    SELECT imagenes -> ${i}::int AS foto
    FROM leads
    WHERE id = ${leadId} AND jsonb_array_length(imagenes) > ${i}::int
  `;

  const foto = rows[0]?.foto;
  if (typeof foto !== "string" || foto.length === 0) return null;

  // El data URL viene ya con su cabecera ("data:image/webp;base64,...") porque
  // es lo que se validó al guardar. Se separa el tipo para poder fijar la
  // cabecera Content-Type de la respuesta: si no, el navegador la descargaría
  // como un fichero en lugar de mostrarla.
  const match = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(foto);
  if (!match) {
    console.warn("Foto de lead con formato inesperado.");
    return null;
  }

  return { dataUrl: foto, mimeType: match[1] };
}

/** Número de fotos de un lead, para validar el índice antes de pedirla. */
export async function contarFotosLead(leadId: string): Promise<number> {
  const db = getSql();
  const rows = await db`
    SELECT jsonb_array_length(imagenes) AS total
    FROM leads
    WHERE id = ${leadId}
  `;
  return Number(rows[0]?.total ?? 0);
}

// ============================================================================
// EMBUDO DE CAPTACIÓN
// ============================================================================

/**
 * Registra un paso del embudo.
 *
 * Idempotente por diseño: hay un índice único en (visitor_id, evento, día), así
 * que un ON CONFLICT DO NOTHING descarta la repetición. El embudo se mide por
 * personas, no por acciones: un agricultor que pulsa "analizar" seis veces en
 * un día sigue siendo un visitante, y contar las seis inflaría el embudo.
 *
 * Sin datos personales: ni IP, ni user agent, ni nombre, ni teléfono. Solo el
 * UUID aleatorio de la cookie httpOnly.
 */
export async function registrarEvento(
  visitorId: string,
  evento: string,
  params?: Record<string, unknown>
): Promise<void> {
  const db = getSql();
  await db`
    INSERT INTO eventos (visitor_id, evento, params)
    VALUES (${visitorId}, ${evento}, ${params ? JSON.stringify(params) : null})
    ON CONFLICT (visitor_id, evento, dia) DO NOTHING
  `;
}

export interface EmbudoPaso {
  evento: string;
  visitantes: number;
}

export interface MetricasEmbudo {
  /** Pasos con su número de visitantes únicos, en orden de embudo. */
  pasos: EmbudoPaso[];
  /** Visitantes que llegaron a la portada en la ventana. */
  visitas: number;
  /** Visitas -> lead. El denominador son las visitas, no los diagnósticos. */
  tasaConversion: number | null;
  /** Visitas -> lead de contacto directo. */
  tasaContactoDirecto: number | null;
  /** Visitas -> algún lead. */
  tasaGlobal: number | null;
  /** Descuento de cada paso respecto al anterior, en porcentaje. */
  abandonos: { desde: string; hasta: string; porcentaje: number }[];
  porDia: { dia: string; visitas: number; leads: number }[];
  dias: number;
}

const DIAS_EMBUDO = 30;

const ORDEN_EMBUDO = [
  "portada_vista",
  "captura_realizada",
  "analisis_iniciado",
  "analisis_completado",
  "resultado_visto",
  "cta_revision_abierto",
  "informe_desbloqueado",
  "lead_enviado",
];

/**
 * Embudo real de captación.
 *
 * El denominador de la conversión son las VISITAS a la portada, no los
 * diagnósticos. Antes se dividía leads entre análisis, lo que dejaba fuera
 * justo a las visitas perdidas y podía exagerar la tasa. Ahora:
 *
 *   - tasaContactoDirecto = leads de contacto directo / visitas
 *   - tasaGlobal .......... cualquier lead / visitas
 *
 * Y se separan porque un lead de contacto directo no tiene por qué tener un
 * diagnóstico detrás: sumarlos todos sobre un denominador de diagnósticos
 * era inconsistente.
 */
export async function obtenerMetricasEmbudo(
  dias: number = DIAS_EMBUDO
): Promise<MetricasEmbudo> {
  const db = getSql();
  const rango = Math.min(Math.max(Math.trunc(dias), 1), 365);

  const [eventosRows, leadRows, serieRows] = await Promise.all([
    db`
      SELECT evento, COUNT(DISTINCT visitor_id)::int AS visitantes
      FROM eventos
      WHERE evento = ANY(${ORDEN_EMBUDO})
        AND created_at >= NOW() - make_interval(days => ${rango}::int)
      GROUP BY evento
    `,
    db`
      SELECT origen, COUNT(DISTINCT usuario_id)::int AS visitantes
      FROM leads
      WHERE usuario_id IS NOT NULL
        AND created_at >= NOW() - make_interval(days => ${rango}::int)
      GROUP BY origen
    `,
    db`
      WITH dias AS (
        SELECT generate_series(
          date_trunc('day', NOW() - make_interval(days => ${rango}::int)),
          date_trunc('day', NOW()),
          interval '1 day'
        ) AS dia
      ),
      v AS (
        SELECT date_trunc('day', created_at) AS dia, COUNT(DISTINCT visitor_id)::int AS total
        FROM eventos
        WHERE evento = 'portada_vista'
          AND created_at >= NOW() - make_interval(days => ${rango}::int)
        GROUP BY 1
      ),
      l AS (
        SELECT date_trunc('day', created_at) AS dia, COUNT(*)::int AS total
        FROM leads
        WHERE created_at >= NOW() - make_interval(days => ${rango}::int)
        GROUP BY 1
      )
      SELECT
        to_char(dias.dia, 'YYYY-MM-DD') AS dia,
        COALESCE(v.total, 0) AS visitas,
        COALESCE(l.total, 0) AS leads
      FROM dias
      LEFT JOIN v ON v.dia = dias.dia
      LEFT JOIN l ON l.dia = dias.dia
      ORDER BY dias.dia ASC
    `,
  ]);

  const porEvento = new Map<string, number>();
  for (const r of eventosRows) porEvento.set(String(r.evento), Number(r.visitantes));

  const pasos: EmbudoPaso[] = ORDEN_EMBUDO.map((evento) => ({
    evento,
    visitantes: porEvento.get(evento) ?? 0,
  }));

  const visitas = porEvento.get("portada_vista") ?? 0;
  const leadDirecto = Number(
    leadRows.find((r) => r.origen === "contacto_directo")?.visitantes ?? 0
  );
  const leadPost = Number(
    leadRows.find((r) => r.origen === "post_diagnostico")?.visitantes ?? 0
  );
  const leadsTotales = leadDirecto + leadPost;

  const abandonos: MetricasEmbudo["abandonos"] = [];
  for (let i = 0; i < pasos.length - 1; i++) {
    const desde_ = pasos[i];
    const hasta = pasos[i + 1];
    if (desde_.visitantes === 0) continue;
    const porcentaje = Math.round(
      (1 - hasta.visitantes / desde_.visitantes) * 100
    );
    if (porcentaje > 0) {
      abandonos.push({ desde: desde_.evento, hasta: hasta.evento, porcentaje });
    }
  }

  return {
    pasos,
    visitas,
    tasaConversion: visitas > 0 ? Math.min(1, leadsTotales / visitas) : null,
    tasaContactoDirecto: visitas > 0 ? Math.min(1, leadDirecto / visitas) : null,
    tasaGlobal: visitas > 0 ? Math.min(1, leadsTotales / visitas) : null,
    abandonos,
    porDia: serieRows.map((r) => ({
      dia: String(r.dia),
      visitas: Number(r.visitas),
      leads: Number(r.leads),
    })),
    dias: rango,
  };
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

/**
 * Borra un lead (y sus fotos) de forma definitiva.
 *
 * El borrado es real y no hay papelera, a propósito: es la vía para atender una
 * supresión de datos. Las fotos de la revisión viven en `leads.imagenes` (JSONB
 * de la propia fila), así que desaparecen con ella. `diagnosticos` no se toca:
 * su clave foránea declara `ON DELETE SET NULL`, de modo que el diagnóstico
 * queda huérfano de lead, no se borra.
 *
 * Estas funciones NO se llaman desde `aplicarMigraciones()` ni en el arranque:
 * solo desde la ruta DELETE del panel, tras autorización y confirmación. Por eso
 * no rompen el guard de `scripts/comprobar-esquema-sin-borrados.mjs`, que
 * comprueba únicamente el cuerpo de esa función.
 */
export async function borrarLead(id: string): Promise<boolean> {
  const db = getSql();
  const rows = await db`
    DELETE FROM leads WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

/** Borra varios leads en una sola sentencia. Devuelve cuántas filas se borraron. */
export async function borrarLeads(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = getSql();
  const rows = await db`
    DELETE FROM leads WHERE id = ANY(${ids}) RETURNING id
  `;
  return rows.length;
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

/** Baja comercial por correo: cubre el opt-in de novedades del formulario del informe. */
export async function bajaComercialEmail(email: string): Promise<number> {
  const db = getSql();
  const rows = await db`
    UPDATE leads
    SET consentimiento_comercial = FALSE,
        baja_comercial = TRUE,
        consentimiento_comercial_fecha = NOW()
    WHERE LOWER(email) = ${email.toLowerCase()} AND baja_comercial = FALSE
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
      SELECT id, diagnostico_id, nombre, telefono, email, municipio, cultivo, sintoma, hectareas,
             mensaje, origen, canal_contacto, solicitud_revision, prioridad, puntuacion, estado,
             contexto_diagnostico,
             consentimiento_comercial, consentimiento_comercial_fecha,
             consentimiento_texto_version, canal_comercial, consentimientos_comerciales,
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
      SELECT id, diagnostico_id, nombre, telefono, email, municipio, cultivo, sintoma, hectareas,
             mensaje, origen, canal_contacto, solicitud_revision, prioridad, puntuacion, estado,
             contexto_diagnostico,
             consentimiento_comercial, consentimiento_comercial_fecha,
             consentimiento_texto_version, canal_comercial, consentimientos_comerciales,
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
      SELECT id, diagnostico_id, nombre, telefono, email, municipio, cultivo, sintoma, hectareas,
             mensaje, origen, canal_contacto, solicitud_revision, prioridad, puntuacion, estado,
             contexto_diagnostico,
             consentimiento_comercial, consentimiento_comercial_fecha,
             consentimiento_texto_version, canal_comercial, consentimientos_comerciales,
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
    SELECT id, diagnostico_id, nombre, telefono, email, municipio, cultivo, sintoma, hectareas,
           mensaje, origen, canal_contacto, solicitud_revision, prioridad, puntuacion, estado,
           contexto_diagnostico,
           consentimiento_comercial, consentimiento_comercial_fecha,
           consentimiento_texto_version, canal_comercial, consentimientos_comerciales,
           baja_comercial, jsonb_array_length(imagenes) AS num_imagenes,
           origen_campana, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
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

// El tipo de las métricas vive en `@/types/lead` (fuente única para cliente y
// servidor) y se reexporta aquí para no romper a quien lo importaba de este
// módulo. Antes había una copia local que podía divergir de la del cliente.
export type { MetricasCaptacion } from "@/types/lead";

// La serie temporal se calcula a 90 días: el panel deja filtrar 7/30/90 y así
// una sola consulta sirve para los tres rangos (el cliente recorta la cola).
const DIAS_SERIE = 90;

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

  const [diagRows, visitantesRows, leadRows, leadUidRows, estadoRows, prioridadRows, origenRows, serieRows, respuestaRows, campanaRows, municipioRows, cultivoRows, canalRows, horaDiaRows] =
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
      // Top municipios y cultivos: acotados a la ventana de la serie para no
      // escanear toda la tabla histórica, y sin NULL ni cadenas vacías, que no
      // son zonas accionables y ensuciarían el ranking.
      db`
        SELECT municipio, COUNT(*)::int AS total
        FROM leads
        WHERE municipio IS NOT NULL AND btrim(municipio) <> ''
          AND created_at >= NOW() - make_interval(days => ${rangoDias}::int)
        GROUP BY municipio ORDER BY total DESC LIMIT 15
      `,
      db`
        SELECT cultivo, COUNT(*)::int AS total
        FROM leads
        WHERE cultivo IS NOT NULL AND btrim(cultivo) <> ''
          AND created_at >= NOW() - make_interval(days => ${rangoDias}::int)
        GROUP BY cultivo ORDER BY total DESC LIMIT 15
      `,
      db`
        SELECT canal_contacto AS canal, COUNT(*)::int AS total
        FROM leads
        WHERE canal_contacto IS NOT NULL AND btrim(canal_contacto) <> ''
          AND created_at >= NOW() - make_interval(days => ${rangoDias}::int)
        GROUP BY canal_contacto ORDER BY total DESC LIMIT 15
      `,
      // El heatmap usa la hora local de España, no UTC: el técnico decide su
      // horario de atención con estas cifras y un desfase de una o dos horas
      // las falsea.
      db`
        SELECT
          EXTRACT(DOW FROM created_at AT TIME ZONE 'Europe/Madrid')::int AS dow,
          EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Madrid')::int AS hora,
          COUNT(*)::int AS total
        FROM leads
        WHERE created_at >= NOW() - make_interval(days => ${rangoDias}::int)
        GROUP BY 1, 2 ORDER BY 1, 2
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
    porMunicipio: municipioRows.map((r) => ({
      municipio: String(r.municipio),
      total: Number(r.total),
    })),
    porCultivo: cultivoRows.map((r) => ({
      cultivo: String(r.cultivo),
      total: Number(r.total),
    })),
    porCanal: canalRows.map((r) => ({
      canal: String(r.canal),
      total: Number(r.total),
    })),
    porHoraDia: horaDiaRows.map((r) => ({
      dow: Number(r.dow),
      hora: Number(r.hora),
      total: Number(r.total),
    })),
  };
}

type LeadRow = Record<string, unknown>;
function mapearLead(row: LeadRow): LeadFila {
  const consentimientoComercial = Boolean(row.consentimiento_comercial);
  const consentimientos = parsearConsentimientosComerciales(
    row.consentimientos_comerciales
  );
  return {
    id: row.id as string,
    diagnostico_id: (row.diagnostico_id as string | null) ?? null,
    nombre: row.nombre as string,
    telefono: row.telefono as string,
    email: (row.email as string | null) ?? null,
    municipio: (row.municipio as string | null) ?? null,
    cultivo: (row.cultivo as string | null) ?? null,
    sintoma: (row.sintoma as string | null) ?? null,
    hectareas: row.hectareas !== null && row.hectareas !== undefined ? Number(row.hectareas) : null,
    mensaje: (row.mensaje as string | null) ?? null,
    origen: row.origen as OrigenLead,
    canal_contacto: (row.canal_contacto as string | null) ?? null,
    solicitud_revision: Boolean(row.solicitud_revision),
    prioridad: row.prioridad as PrioridadLead,
    puntuacion: Number(row.puntuacion),
    estado: row.estado as EstadoLead,
    contexto_diagnostico: (row.contexto_diagnostico as ContextoDiagnosticoLead | null) ?? null,
    consentimiento_comercial: consentimientoComercial,
    consentimiento_comercial_fecha:
      (row.consentimiento_comercial_fecha as Date | string | null | undefined)?.toString() ??
      null,
    consentimiento_texto_version: (row.consentimiento_texto_version as string | null) ?? null,
    canal_comercial: (row.canal_comercial as string | null) ?? null,
    consentimientos_comerciales: consentimientos,
    consentimiento_fuente: fuenteConsentimientoComercial(
      consentimientos,
      consentimientoComercial
    ),
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

/**
 * Guarda la valoración del usuario sobre un diagnóstico.
 *
 * El filtro por `usuario_id` es lo que limita la escritura al diagnóstico del
 * propio visitante. Antes se actualizaba solo por `id`, así que cualquiera que
 * conociera un identificador podía sobrescribir la valoración de otro.
 *
 * Devuelve si se actualizó alguna fila. Un `false` significa que el diagnóstico
 * no existe O que es de otro visitante, y el llamador no debe distinguir esos
 * dos casos: hacerlo permitiría sondear qué identificadores existen.
 */
export async function actualizarFeedback(
  diagnosticoId: string,
  feedback: string,
  usuarioId: string
): Promise<boolean> {
  const db = getSql();
  const filas = await db`
    UPDATE diagnosticos
    SET feedback_usuario = ${feedback}
    WHERE id = ${diagnosticoId}
      AND usuario_id = ${usuarioId}
    RETURNING id
  `;
  return filas.length > 0;
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

/**
 * Carga un diagnóstico por id. La usan los enlaces de recuperación, que no
 * tienen cookie: el token es la única credencial y ya se validó antes.
 */
export async function obtenerDiagnosticoPorId(
  id: string
): Promise<DiagnosticoWithMeta | null> {
  const db = getSql();
  const [row] = await db`
    SELECT id, usuario_id, imagen_url, organo, especie, diagnostico_json, nombre_planta, feedback_usuario, contexto_usuario, proveedor, created_at
    FROM diagnosticos
    WHERE id = ${id}
    LIMIT 1
  `;
  if (!row) return null;

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
    created_at: row.created_at?.toString(),
  };
}

export interface DatosEnvioInforme {
  diagnosticoId: string;
  email: string;
}

/**
 * Devuelve el correo del último lead con email de un diagnóstico, solo si el
 * diagnóstico pertenece al visitante de la cookie. Así el endpoint no se puede
 * usar como rebotador de correo hacia direcciones ajenas.
 */
export async function datosEnvioInforme(
  diagnosticoId: string,
  usuarioId: string
): Promise<DatosEnvioInforme | null> {
  const db = getSql();
  const [row] = await db`
    SELECT d.id, l.email
    FROM diagnosticos d
    JOIN LATERAL (
      SELECT email
      FROM leads
      WHERE diagnostico_id = d.id
        AND usuario_id = d.usuario_id
        AND email IS NOT NULL
        AND btrim(email) <> ''
      ORDER BY created_at DESC
      LIMIT 1
    ) l ON TRUE
    WHERE d.id = ${diagnosticoId}
      AND d.usuario_id = ${usuarioId}
    LIMIT 1
  `;
  if (!row?.email) return null;
  return { diagnosticoId: String(row.id), email: String(row.email) };
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Emite un token nuevo sin tocar los anteriores. La revocación se hace solo
 * cuando Resend acepta el envío: si el reenvío falla, el enlace que la persona
 * ya tenía en su buzón sigue siendo válido.
 *
 * Devuelve también el número de intento, que forma parte de la clave de
 * idempotencia de Resend: un reenvío real debe enviar otro correo, no
 * reutilizar el anterior.
 */
export async function crearEnlaceInforme(
  diagnosticoId: string
): Promise<{ token: string; intento: number; enlaceId: string }> {
  const db = getSql();
  const [cuenta] = await db`
    SELECT COUNT(*)::int AS total
    FROM enlaces_informe
    WHERE diagnostico_id = ${diagnosticoId}
  `;
  const intento = Number(cuenta?.total ?? 0) + 1;
  const token = randomBytes(32).toString("base64url");

  const [fila] = await db`
    INSERT INTO enlaces_informe (diagnostico_id, token_hash, expira_en)
    VALUES (${diagnosticoId}, ${hashToken(token)}, NOW() + INTERVAL '90 days')
    RETURNING id
  `;

  return { token, intento, enlaceId: String(fila.id) };
}

/**
 * Revoca los enlaces anteriores del diagnóstico, conservando el que se acaba
 * de aceptar. Se llama después de que Resend confirme el envío.
 */
export async function revocarEnlacesAnteriores(
  diagnosticoId: string,
  enlaceId: string
): Promise<void> {
  await getSql()`
    UPDATE enlaces_informe
    SET expira_en = NOW()
    WHERE diagnostico_id = ${diagnosticoId}
      AND id <> ${enlaceId}
      AND expira_en > NOW()
  `;
}

/** Revoca un enlace que no llegó a entregarse, sin tocar el anterior. */
export async function revocarEnlace(enlaceId: string): Promise<void> {
  await getSql()`
    UPDATE enlaces_informe
    SET expira_en = NOW()
    WHERE id = ${enlaceId}
      AND expira_en > NOW()
  `;
}

/**
 * Resuelve un token en su diagnóstico. El filtro `expira_en > NOW()` es la
 * única caducidad: no hay proceso de limpieza que pueda fallar o retrasarse.
 * Un token inválido y uno caducado devuelven lo mismo (null).
 */
export async function resolverEnlaceInforme(
  token: string
): Promise<DiagnosticoWithMeta | null> {
  if (!TOKEN_RE.test(token)) return null;
  const db = getSql();
  const [fila] = await db`
    UPDATE enlaces_informe
    SET ultimo_acceso_en = NOW(),
        accesos = accesos + 1
    WHERE token_hash = ${hashToken(token)}
      AND expira_en > NOW()
    RETURNING diagnostico_id
  `;
  if (!fila?.diagnostico_id) return null;
  return obtenerDiagnosticoPorId(String(fila.diagnostico_id));
}

// ============================================================================
// ACCESOS AL PANEL
// ============================================================================

export interface DiaAcceso {
  dia: string;
  visitantes: number;
  diagnosticos: number;
  leads: number;
}

export interface IpAcceso {
  /** IP con el último octeto/hexteto enmascarado: nunca sale entera de aquí. */
  ip: string;
  peticiones: number;
  dias: number;
  primera: string;
  ultima: string;
  /** Alguna vez alcanzó el límite de la ventana: posible bot o abuso. */
  topada: boolean;
}

export interface VisitanteAnonimo {
  id: string;
  primera: string;
  ultima: string;
  pasos: number;
  eventos: string[];
}

export interface AccesosResumen {
  dias: number;
  porDia: DiaAcceso[];
  ips: IpAcceso[];
  visitantes: VisitanteAnonimo[];
  totales: { visitantes: number; diagnosticos: number; leads: number; ips: number };
}

// Las utilidades puras de IP (`parsearClaveCuotaIp`, `enmascararIp`) viven en
// ./accesos-ip para poder probarse sin el cliente de base de datos.

/**
 * Vista de accesos para el panel: visitas anónimas, embudo diario e IPs.
 *
 * Importante: no hay enlace entre `visitor_id` e IP. Las IPs solo constan en
 * `cuotas` como clave de rate-limit; los visitantes solo constan en `eventos`
 * como UUID aleatorio. Se devuelven como dos listas independientes y así se
 * explica en el propio panel, para no dar a entender una atribución que la base
 * de datos no soporta.
 */
export async function obtenerAccesos(dias: number = 30): Promise<AccesosResumen> {
  const db = getSql();
  const rango = Math.min(Math.max(Math.trunc(dias), 1), 365);

  const [diaRows, ipRows, visRows] = await Promise.all([
    db`
      WITH dias AS (
        SELECT generate_series(
          date_trunc('day', NOW() - make_interval(days => ${rango}::int)),
          date_trunc('day', NOW()),
          interval '1 day'
        ) AS dia
      ),
      v AS (
        SELECT date_trunc('day', created_at) AS dia, COUNT(DISTINCT visitor_id)::int AS visitantes
        FROM eventos
        WHERE evento = 'portada_vista'
          AND created_at >= NOW() - make_interval(days => ${rango}::int)
        GROUP BY 1
      ),
      d AS (
        SELECT date_trunc('day', created_at) AS dia, COUNT(*)::int AS diagnosticos
        FROM diagnosticos
        WHERE created_at >= NOW() - make_interval(days => ${rango}::int)
        GROUP BY 1
      ),
      l AS (
        SELECT date_trunc('day', created_at) AS dia, COUNT(*)::int AS leads
        FROM leads
        WHERE created_at >= NOW() - make_interval(days => ${rango}::int)
        GROUP BY 1
      )
      SELECT
        to_char(dias.dia, 'YYYY-MM-DD') AS dia,
        COALESCE(v.visitantes, 0) AS visitantes,
        COALESCE(d.diagnosticos, 0) AS diagnosticos,
        COALESCE(l.leads, 0) AS leads
      FROM dias
      LEFT JOIN v ON v.dia = dias.dia
      LEFT JOIN d ON d.dia = dias.dia
      LEFT JOIN l ON l.dia = dias.dia
      ORDER BY dias.dia ASC
    `,
    db`
      SELECT
        ip,
        COUNT(*)::int AS peticiones,
        COUNT(DISTINCT (creado_en AT TIME ZONE 'UTC')::date)::int AS dias,
        MIN(creado_en)::text AS primera,
        MAX(creado_en)::text AS ultima,
        COUNT(*) FILTER (WHERE sujeto NOT LIKE 'lead:eventos:%') >= 5 AS topada
      FROM cuota_usos
      WHERE ambito = 'lead' AND ip IS NOT NULL
        AND creado_en >= NOW() - make_interval(days => ${rango}::int)
      GROUP BY ip
      ORDER BY peticiones DESC
      LIMIT 100
    `,
    db`
      SELECT
        visitor_id,
        MIN(created_at)::text AS primera,
        MAX(created_at)::text AS ultima,
        COUNT(DISTINCT evento)::int AS pasos,
        string_agg(DISTINCT evento, ',') AS eventos
      FROM eventos
      WHERE created_at >= NOW() - make_interval(days => ${rango}::int)
      GROUP BY visitor_id
      ORDER BY MIN(created_at) DESC
      LIMIT 200
    `,
  ]);

  const porDia: DiaAcceso[] = diaRows.map((r) => ({
    dia: String(r.dia),
    visitantes: Number(r.visitantes),
    diagnosticos: Number(r.diagnosticos),
    leads: Number(r.leads),
  }));

  const ips: IpAcceso[] = ipRows.map((r) => ({
    ip: enmascararIp(String(r.ip)),
    peticiones: Number(r.peticiones),
    dias: Number(r.dias),
    primera: String(r.primera),
    ultima: String(r.ultima),
    topada: Boolean(r.topada),
  }));

  const visitantes: VisitanteAnonimo[] = visRows.map((r) => ({
    id: String(r.visitor_id),
    primera: String(r.primera),
    ultima: String(r.ultima),
    pasos: Number(r.pasos),
    eventos: String(r.eventos ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
  }));

  return {
    dias: rango,
    porDia,
    ips,
    visitantes,
    totales: {
      visitantes: visitantes.length,
      diagnosticos: porDia.reduce((s, d) => s + d.diagnosticos, 0),
      leads: porDia.reduce((s, d) => s + d.leads, 0),
      ips: ips.length,
    },
  };
}

// ============================================================================
// DIAGNÓSTICOS (pestaña «Diagnósticos» del panel)
// ============================================================================

// Los tipos del panel viven en `@/types/diagnostico` (fuente única para cliente
// y servidor) y se reexportan aquí para no romper a quien los importaba de aquí.
export type { DiagnosticoPanelFila, DiagnosticosPanel } from "@/types/diagnostico";

/**
 * Diagnósticos del panel.
 *
 * `diagnosticos` solo contiene análisis que TERMINARON con éxito: si un análisis
 * falló, no hay fila, y su rastro está en `eventos` (`analisis_error`). Por eso
 * se devuelven las dos lecturas por separado (totales exactos frente a intentos
 * por visitante y día) y el panel no las suma ni presenta una como si fuera la
 * otra.
 */
export async function obtenerDiagnosticosPanel(
  dias: number = 90,
  limit: number = 200
): Promise<DiagnosticosPanel> {
  const db = getSql();
  const rango = Math.min(Math.max(Math.trunc(dias), 1), 365);
  const maxFilas = Math.min(Math.max(Math.trunc(limit), 1), 500);

  const [itemsRows, resumenRows, intentosRows, proveedorRows, tipoRows, gravedadRows] =
    await Promise.all([
      db`
        SELECT id, usuario_id, organo, especie, nombre_planta, proveedor,
               feedback_usuario, contexto_usuario, diagnostico_json, created_at
        FROM diagnosticos
        ORDER BY created_at DESC
        LIMIT ${maxFilas}
      `,
      db`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE (diagnostico_json->>'requiere_experto')::boolean IS TRUE)::int AS requiere_experto,
          COUNT(*) FILTER (WHERE feedback_usuario IS NOT NULL AND btrim(feedback_usuario) <> '')::int AS con_feedback,
          AVG((diagnostico_json->'diagnostico'->>'confianza')::numeric) AS confianza_media
        FROM diagnosticos
      `,
      db`
        SELECT
          COUNT(*) FILTER (WHERE evento = 'analisis_iniciado')::int AS iniciados,
          COUNT(*) FILTER (WHERE evento = 'analisis_completado')::int AS completados,
          COUNT(*) FILTER (WHERE evento = 'analisis_error')::int AS errores
        FROM eventos
        WHERE evento IN ('analisis_iniciado', 'analisis_completado', 'analisis_error')
          AND created_at >= NOW() - make_interval(days => ${rango}::int)
      `,
      db`
        SELECT proveedor, COUNT(*)::int AS total
        FROM diagnosticos
        WHERE proveedor IS NOT NULL AND btrim(proveedor) <> ''
        GROUP BY proveedor ORDER BY total DESC
      `,
      db`
        SELECT diagnostico_json->'diagnostico'->>'tipo' AS tipo, COUNT(*)::int AS total
        FROM diagnosticos
        WHERE diagnostico_json->'diagnostico'->>'tipo' IS NOT NULL
        GROUP BY 1 ORDER BY total DESC
      `,
      db`
        SELECT diagnostico_json->'diagnostico'->>'gravedad' AS gravedad, COUNT(*)::int AS total
        FROM diagnosticos
        WHERE diagnostico_json->'diagnostico'->>'gravedad' IS NOT NULL
        GROUP BY 1 ORDER BY total DESC
      `,
    ]);

  const items: DiagnosticoPanelFila[] = itemsRows.map((r) => ({
    id: String(r.id),
    usuario_id: r.usuario_id != null ? String(r.usuario_id) : null,
    organo: (r.organo as string | null) ?? null,
    especie: (r.especie as string | null) ?? null,
    nombre_planta: (r.nombre_planta as string | null) ?? null,
    proveedor: (r.proveedor as string | null) ?? null,
    feedback_usuario: (r.feedback_usuario as string | null) ?? null,
    contexto_usuario: (r.contexto_usuario as ContextoUsuario | null) ?? null,
    created_at: String(r.created_at),
    diagnostico: parsearDiagnostico(r.diagnostico_json),
  }));

  const resumen = resumenRows[0] ?? {};
  const intentos = intentosRows[0] ?? {};

  return {
    dias: rango,
    items,
    intentos: {
      iniciados: Number(intentos.iniciados ?? 0),
      completados: Number(intentos.completados ?? 0),
      errores: Number(intentos.errores ?? 0),
    },
    totales: {
      diagnosticos: Number(resumen.total ?? 0),
      requiereExperto: Number(resumen.requiere_experto ?? 0),
      conFeedback: Number(resumen.con_feedback ?? 0),
    },
    confianzaMedia: resumen.confianza_media != null ? Number(resumen.confianza_media) : null,
    porProveedor: proveedorRows.map((r) => ({
      proveedor: String(r.proveedor),
      total: Number(r.total),
    })),
    porTipo: tipoRows.map((r) => ({ tipo: String(r.tipo), total: Number(r.total) })),
    porGravedad: gravedadRows.map((r) => ({
      gravedad: String(r.gravedad),
      total: Number(r.total),
    })),
  };
}

/**
 * `diagnostico_json` es JSONB confiable, pero una fila deforme no debería tumbar
 * el panel entero: se devuelve null y la tabla muestra el fallo de esa fila.
 */
function parsearDiagnostico(valor: unknown): DiagnosticoResponse | null {
  if (valor && typeof valor === "object") return valor as DiagnosticoResponse;
  if (typeof valor !== "string") return null;
  try {
    const parseado = JSON.parse(valor);
    return parseado && typeof parseado === "object" ? (parseado as DiagnosticoResponse) : null;
  } catch {
    return null;
  }
}
