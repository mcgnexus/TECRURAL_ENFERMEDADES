export type PrioridadLead = "alta" | "media" | "baja";
export type OrigenLead = "post_diagnostico" | "contacto_directo";
export type EstadoLead =
  | "nuevo"
  | "contactado"
  | "cualificado"
  | "presupuesto"
  | "ganado"
  | "perdido";

export const ESTADOS_LEAD = [
  "nuevo",
  "contactado",
  "cualificado",
  "presupuesto",
  "ganado",
  "perdido",
] as const;

/** Canal por el que se autorizaron comunicaciones comerciales. */
export type CanalComercial = "correo" | "whatsapp";

/** Una autorización comercial concreta, tal y como queda guardada en el lead. */
export interface ConsentimientoComercialRegistrado {
  canal: CanalComercial;
  /** Versión del texto que la persona vio al marcar la casilla. */
  texto_version: string;
  /** ISO generado en el servidor en el momento de guardar el lead. */
  aceptado_en: string;
  origen: OrigenLead;
  /** Reservado para una baja selectiva futura; la baja actual es global. */
  revocado_en: string | null;
  /** true solo si se dedujo de un payload antiguo con el booleano ambiguo. */
  compatibilidad?: boolean;
}

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

export interface ContextoDiagnosticoLead {
  especie?: string;
  gravedad?: "leve" | "moderada" | "severa";
  tipo?: "enfermedad" | "deficiencia_nutricional" | "plaga" | "sano";
  requiere_experto?: boolean;
  organo?: string;
  angulos_capturados?: number;
  cultivo?: string;
  municipio?: string;
  sintoma?: string;
}

export interface DatosLead {
  nombre?: string;
  /** Teléfono de contacto. Puede faltar si la persona solo deja el correo. */
  telefono?: string;
  /** Correo de contacto. Puede faltar si la persona solo deja el teléfono. */
  email?: string;
  municipio?: string;
  cultivo?: string;
  sintoma?: string;
  hectareas?: number;
  mensaje?: string;
  diagnostico_id?: string;
  origen: OrigenLead;
  /** true solo cuando la persona pide además la revisión técnica del caso. */
  solicitud_respuesta: boolean;
  canal_contacto?: string;
  /**
   * Canales comerciales autorizados explícitamente en el formulario mostrado.
   * Nunca se infiere del teléfono ni del canal de revisión.
   */
  consentimientos_comerciales?: Array<{
    canal: CanalComercial;
    texto_version: string;
  }>;
  contexto?: ContextoDiagnosticoLead;
  utm?: UtmParams;
  imagenes?: string[];
}

export interface LeadGuardado {
  id: string;
  prioridad: PrioridadLead;
  puntuacion: number;
  created_at: string;
}

export interface LeadFila {
  id: string;
  diagnostico_id: string | null;
  nombre: string;
  /**
   * Teléfono de contacto. La columna original es NOT NULL, así que un lead que
   * solo deja correo se guarda con cadena vacía: comprobar con `lead.email`
   * antes de asumir que hay número.
   */
  telefono: string;
  /** Correo de contacto; null en los leads anteriores al correo. */
  email: string | null;
  municipio: string | null;
  cultivo: string | null;
  sintoma: string | null;
  hectareas: number | null;
  mensaje: string | null;
  origen: OrigenLead;
  canal_contacto: string | null;
  /** true cuando la persona pidió además la revisión técnica (casilla aparte). */
  solicitud_revision: boolean;
  prioridad: PrioridadLead;
  puntuacion: number;
  estado: EstadoLead;
  contexto_diagnostico: ContextoDiagnosticoLead | null;
  /**
   * Agregado de compatibilidad: hay al menos una autorización activa. El
   * detalle por canal está en `consentimientos_comerciales`.
   */
  consentimiento_comercial: boolean;
  consentimiento_comercial_fecha: string | null;
  consentimiento_texto_version: string | null;
  /** Canal heredado: solo cuando hay exactamente un canal activo. */
  canal_comercial: string | null;
  /** Detalle explícito por canal; vacío en los registros históricos. */
  consentimientos_comerciales: ConsentimientoComercialRegistrado[];
  /** Distingue consentimiento explícito, inferido por la app antigua o ninguno. */
  consentimiento_fuente: "explicito" | "legacy_inferido" | "ninguno";
  baja_comercial: boolean;
  num_imagenes: number;
  origen_campana: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  /** Instante en que el lead salió de "nuevo" por primera vez. */
  primera_response_at: string | null;
  notas: string | null;
  created_at: string;
}

/**
 * Métricas agregadas del panel comercial. Fuente única de verdad: `database.ts`
 * la importa de aquí para que el cliente y el servidor compartan exactamente el
 * mismo tipo y no puedan divergir en el borde JSON.
 */
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
  /** Top municipios por número de leads (para dirigir la acción comercial). */
  porMunicipio: { municipio: string; total: number }[];
  /** Top cultivos por número de leads. */
  porCultivo: { cultivo: string; total: number }[];
  /** Reparto por canal de contacto solicitado (llamada / WhatsApp). */
  porCanal: { canal: string; total: number }[];
  /**
   * Mapa de calor de llegada de leads: filas = día de la semana (0=domingo),
   * columnas = hora local (Europe/Madrid). Solo la ventana de la serie.
   */
  porHoraDia: { dow: number; hora: number; total: number }[];
}
