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
  telefono: string;
  municipio?: string;
  cultivo?: string;
  sintoma?: string;
  hectareas?: number;
  mensaje?: string;
  diagnostico_id?: string;
  origen: OrigenLead;
  solicitud_respuesta: true;
  canal_contacto?: string;
  consentimiento_comercial?: boolean;
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
  telefono: string;
  municipio: string | null;
  cultivo: string | null;
  sintoma: string | null;
  hectareas: number | null;
  mensaje: string | null;
  origen: OrigenLead;
  canal_contacto: string | null;
  prioridad: PrioridadLead;
  puntuacion: number;
  estado: EstadoLead;
  contexto_diagnostico: ContextoDiagnosticoLead | null;
  consentimiento_comercial: boolean;
  consentimiento_texto_version: string | null;
  canal_comercial: string | null;
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

export interface MetricasCaptacion {
  visitantes: number;
  diagnosticos: number;
  diagnosticosPorVisitante: number;
  leads: number;
  visitantesConLead: number;
  tasaConversion: number | null;
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
