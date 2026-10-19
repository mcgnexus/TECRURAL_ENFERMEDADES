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

export interface DiagnosticoDiferencial {
  nombre: string;
  confianza: number;
  por_que_descartado: string;
}

export interface CalidadImagen {
  nitidez: "alta" | "media" | "baja";
  iluminacion: "adecuada" | "deficiente" | "excesiva";
  encuadre: "adecuado" | "parcial" | "insuficiente";
}

/**
 * Pauta orientativa de tratamiento. Es lo que la app entrega en el informe
 * completo y lo que Google no da: una propuesta concreta de actuación.
 *
 * Sigue siendo una hipótesis a partir de una foto, no una prescripción: por eso
 * la dosis es siempre un rango/orden de magnitud, `plazo_seguridad_dias` es
 * obligatorio cuando hay producto y las advertencias recuerdan confirmar el
 * registro del producto para el cultivo y leer la etiqueta.
 */
export interface TratamientoOrientativo {
  /** Materia activa o medida propuesta (p. ej. "azufre micronizado", "trampas cromáticas"). */
  medida: string;
  /** Dosis orientativa con su unidad (p. ej. "2-3 g por litro de agua"). */
  dosis: string;
  /** Cuándo y cómo aplicarlo (momento fenológico, cobertura, número de pases). */
  momento: string;
  /** Días de plazo de seguridad antes de cosecha; null si la medida no lo tiene. */
  plazo_seguridad_dias: number | null;
  /** Condiciones, incompatibilidades y precauciones de uso. */
  advertencias: string[];
}

export interface DiagnosticoResponse {
  organo_detectado: OrganoDetectado;
  especie_identificada: string;
  confianza_identificacion: number;
  diagnostico: Diagnostico;
  estado_madurez: EstadoMadurez;
  recomendacion: string;
  /**
   * Pauta orientativa que solo se entrega en el informe completo, tras dejar el
   * teléfono. Ausente cuando no procede proponer nada (tipo "sano").
   */
  tratamiento?: TratamientoOrientativo;
  /**
   * Qué foto o dato concreto ayudaría a confirmar que la hipótesis es correcta
   * (validación con una segunda imagen).
   */
  validacion_segunda_foto?: string;
  requiere_experto: boolean;
  razonamiento?: string;
  hallazgos_negativos?: string[];
  diagnosticos_diferenciales?: DiagnosticoDiferencial[];
  calidad_imagen?: CalidadImagen;
  datos_faltantes?: string[];
}

export interface ContextoUsuario {
  cultivo?: string;
  municipio?: string;
  sintoma?: string;
  duracion?: string;
  variedad?: string;
}

export interface DiagnosticoWithMeta extends DiagnosticoResponse {
  id?: string;
  usuario_id?: string;
  imagen_url?: string;
  nombre_planta?: string | null;
  feedback_usuario?: string;
  created_at?: string;
  proveedor_usado?: "gemini" | "openai";
  angulo_usado?: "haz" | "enves" | "planta_completa";
  contexto_usuario?: ContextoUsuario;
}

/**
 * Fila de diagnóstico para la pestaña del panel. Fuente única para cliente y
 * servidor; `database.ts` la importa de aquí para que no puedan divergir.
 *
 * No lleva la foto: `imagen_url` se guarda siempre vacío porque las imágenes no
 * se persisten, solo se adjuntan al lead si el agricultor pide revisión.
 */
export interface DiagnosticoPanelFila {
  id: string;
  usuario_id: string | null;
  organo: string | null;
  especie: string | null;
  nombre_planta: string | null;
  proveedor: string | null;
  feedback_usuario: string | null;
  contexto_usuario: ContextoUsuario | null;
  created_at: string;
  /** Contenido de `diagnostico_json`, o null si estaba mal formado. */
  diagnostico: DiagnosticoResponse | null;
}

export interface DiagnosticosPanel {
  dias: number;
  items: DiagnosticoPanelFila[];
  /**
   * Intentos registrados en `eventos`. Esa tabla deduplica por
   * (visitante, evento, día), así que son visitantes que iniciaron un análisis
   * en la ventana, no intentos crudos; no es comparable uno a uno con el número
   * de filas de `diagnosticos`.
   */
  intentos: { iniciados: number; completados: number; errores: number };
  totales: { diagnosticos: number; requiereExperto: number; conFeedback: number };
  confianzaMedia: number | null;
  porProveedor: { proveedor: string; total: number }[];
  porTipo: { tipo: string; total: number }[];
  porGravedad: { gravedad: string; total: number }[];
}
