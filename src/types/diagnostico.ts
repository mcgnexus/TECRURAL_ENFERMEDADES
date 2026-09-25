export type OrganoDetectado = "hoja" | "flor" | "fruto" | "tallo" | "planta_completa";
export type TipoDiagnostico = "enfermedad" | "deficiencia_nutricional" | "plaga" | "sano";
export type Gravedad = "leve" | "moderada" | "severa";

export interface Diagnostico {
  tipo: TipoDiagnostico;
  nombre: string;
  sintomas_observados: string[];
  confianza: number;
  gravedad: Gravedad;
}

export interface EstadoMadurez {
  aplica: boolean;
  estado: string;
  dias_estimados_cosecha: number;
}

export interface DiagnosticoResponse {
  organo_detectado: OrganoDetectado;
  especie_identificada: string;
  confianza_identificacion: number;
  diagnostico: Diagnostico;
  estado_madurez: EstadoMadurez;
  recomendacion: string;
  requiere_experto: boolean;
}

export interface DiagnosticoWithMeta extends DiagnosticoResponse {
  id?: string;
  usuario_id?: string;
  imagen_url?: string;
  nombre_planta?: string | null;
  feedback_usuario?: string;
  created_at?: string;
  proveedor_usado?: "gemini" | "deepseek";
}