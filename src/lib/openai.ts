import OpenAI from "openai";
import {
  SYSTEM_PROMPT,
  RETRY_PROMPT,
  OBSERVATION_PROMPT,
  VERIFICATION_PROMPT,
  selectFewShots,
  type Observacion,
  type Verificacion,
} from "./system-prompt";
import type { ContextoUsuario, DiagnosticoResponse } from "@/types/diagnostico";
import type { ImagenAnalisis } from "./gemini";
import { propagarCalidadImagen } from "./calidad-imagen";
import { ErrorProveedorIA } from "./errores-proveedor";
import { DeadlineDiagnosticoError } from "./errores-proveedor";
import { tiempoRestanteMs, type OpcionesAnalisis } from "./opciones-analisis";
import { PRESUPUESTO_LLAMADAS, Presupuesto, PresupuestoAgotadoError } from "./presupuesto-llamadas";
import { construirPromptDiagnostico } from "./construir-prompt-diagnostico";
import {
  claveObservacion,
  obtenerObservacion,
  guardarObservacion,
} from "./observacion-cache";

export type { ImagenAnalisis };

let deepseek: OpenAI | null = null;
let openaiVision: OpenAI | null = null;

type ProveedorVision = "deepseek" | "openai";
const nombreProveedor = (proveedor: ProveedorVision) => proveedor === "openai" ? "OpenAI" : "DeepSeek";

function getClient(proveedor: ProveedorVision) {
  if (proveedor === "openai") {
    if (!openaiVision) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
      openaiVision = new OpenAI({ apiKey, timeout: 35_000, maxRetries: 0 });
    }
    return openaiVision;
  }
  if (!deepseek) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY no configurada");
    }
    deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey,
      // Tope por llamada. Sin él, un proveedor colgado consumía los 120 s de
      // maxDuration y la petición moría en un 504 genérico.
      timeout: 45_000,
      maxRetries: 0,
    });
  }
  return deepseek;
}

// ---------------------------------------------------------------------------
// SCHEMAS
// ---------------------------------------------------------------------------

const OBSERVATION_SCHEMA = {
  type: "object",
  properties: {
    organo_detectado: {
      type: "string",
      enum: ["hoja", "flor", "fruto", "tallo", "planta_completa"],
    },
    parte_visible: {
      type: "string",
      enum: ["haz", "enves", "ambas", "no_determinable"],
    },
    descripcion_hechos: { type: "array", items: { type: "string" } },
    signos_presentes: { type: "array", items: { type: "string" } },
    distribucion_sintomas: { type: "string" },
    calidad_imagen: {
      type: "object",
      properties: {
        nitidez: { type: "string", enum: ["alta", "media", "baja"] },
        iluminacion: { type: "string", enum: ["adecuada", "deficiente", "excesiva"] },
        encuadre: { type: "string", enum: ["adecuado", "parcial", "insuficiente"] },
      },
      required: ["nitidez", "iluminacion", "encuadre"],
    },
    observaciones_adicionales: { type: "string" },
  },
  required: [
    "organo_detectado",
    "parte_visible",
    "descripcion_hechos",
    "signos_presentes",
    "distribucion_sintomas",
    "calidad_imagen",
    "observaciones_adicionales",
  ],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    organo_detectado: {
      type: "string",
      enum: ["hoja", "flor", "fruto", "tallo", "planta_completa"],
    },
    especie_identificada: { type: "string" },
    confianza_identificacion: { type: "number", minimum: 0, maximum: 1 },
    diagnostico: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: ["enfermedad", "deficiencia_nutricional", "plaga", "sano"],
        },
        nombre: { type: "string" },
        sintomas_observados: { type: "array", items: { type: "string" } },
        confianza: { type: "number", minimum: 0, maximum: 1 },
        gravedad: { type: "string", enum: ["leve", "moderada", "severa"] },
      },
      required: ["tipo", "nombre", "sintomas_observados", "confianza", "gravedad"],
    },
    estado_madurez: {
      type: "object",
      properties: {
        aplica: { type: "boolean" },
        estado: { type: "string" },
        dias_estimados_cosecha: { type: "number", minimum: 0 },
      },
      required: ["aplica", "estado", "dias_estimados_cosecha"],
    },
    hallazgos_negativos: { type: "array", items: { type: "string" } },
    diagnosticos_diferenciales: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          confianza: { type: "number", minimum: 0, maximum: 1 },
          por_que_descartado: { type: "string" },
        },
        required: ["nombre", "confianza", "por_que_descartado"],
      },
    },
    recomendacion: { type: "string" },
    tratamiento: {
      type: "object",
      properties: {
        medida: { type: "string" },
        dosis: { type: "string" },
        momento: { type: "string" },
        plazo_seguridad_dias: { type: "number", minimum: 0, nullable: true },
        advertencias: { type: "array", items: { type: "string" } },
      },
      required: ["medida", "dosis", "momento", "plazo_seguridad_dias", "advertencias"],
    },
    validacion_segunda_foto: { type: "string" },
    datos_faltantes: { type: "array", items: { type: "string" } },
    requiere_experto: { type: "boolean" },
    razonamiento: { type: "string" },
  },
  required: [
    "organo_detectado",
    "especie_identificada",
    "confianza_identificacion",
    "diagnostico",
    "estado_madurez",
    "hallazgos_negativos",
    "diagnosticos_diferenciales",
    "datos_faltantes",
    "recomendacion",
    "tratamiento",
    "validacion_segunda_foto",
    "requiere_experto",
    "razonamiento",
  ],
};

const VERIFICATION_SCHEMA = {
  type: "object",
  properties: {
    consistente: { type: "boolean" },
    inconsistencias: { type: "array", items: { type: "string" } },
    sintomas_no_explicados: { type: "array", items: { type: "string" } },
    confianza_ajustada: { type: "number", minimum: 0, maximum: 1 },
    diagnostico_validado: { type: "boolean" },
  },
  required: [
    "consistente",
    "inconsistencias",
    "sintomas_no_explicados",
    "confianza_ajustada",
    "diagnostico_validado",
  ],
};

function buildPromptWithSchema(basePrompt: string, schema: object): string {
  return `${basePrompt}

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto extra). El JSON debe seguir exactamente este esquema:
${JSON.stringify(schema, null, 2)}`;
}

function contenidoMultimodal(
  texto: string,
  imagenes: ImagenAnalisis[],
  conImagenes = true
): Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  return [
    { type: "text", text: texto },
    ...(conImagenes
      ? imagenes.map((img) => ({
          type: "image_url" as const,
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        }))
      : []),
  ];
}

// Mismo criterio que en gemini.ts: dos reintentos y un presupuesto por
// análisis. Este proveedor es el fallback, así que su presupuesto solo corre
// si el primero ha fallado de verdad por una causa suya.
const ESPERA_REINTENTO_MS = [800, 2500];
const MAX_INTENTOS = ESPERA_REINTENTO_MS.length + 1;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Contador de llamadas del análisis en curso. Vive por petición, no global. */
/** Saturación o corte de red: transitorio, merece la pena reintentar. */
function esReintentable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 429 || status === 500 || status === 502 || status === 503) return true;
  return /rate limit|overloaded|timeout|ECONN|fetch failed|socket/i.test(
    String((error as { message?: string })?.message ?? "")
  );
}

/**
 * deepseek-chat no es multimodal: si rechaza las imágenes, analizar 3 veces lo
 * mismo solo confirma el fallo. Detectado el rechazo, se reintenta una vez sin
 * imágenes y con aviso explícito para que no alucine fotos que no ha visto.
 */
function esRechazoDeImagenes(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status !== 400) return false;
  return /image|imagen|multimodal|vision|not support|unsupport/i.test(
    String((error as { message?: string })?.message ?? "")
  );
}

const AVISO_SIN_IMAGENES = `LAS IMÁGENES NO HAN PODIDO ENVIARSE. NO has visto ninguna foto: razona únicamente con la observación previa incluida en el texto y, si no la hay, di que no es posible orientar sin imagen. No inventes detalles visuales.`;

interface LlamadaOpts {
  prompt: string;
  maxTokens: number;
  imagenes: ImagenAnalisis[];
  /** Paso de imágenes explícito por llamada: la verificación reenvía solo la
   * principal (ver verificarDiagnostico). */
  conImagenes?: boolean;
  /** En la observación NO se acepta el plan B sin imágenes: si el proveedor
   * rechaza las fotos, la observación sería inventada y el diagnóstico entero
   * se apoyaría en ella. Mejor propagar el fallo al proveedor anterior. */
  sinImagenesSiRechazo?: boolean;
  etiqueta: string;
  /** Presupuesto del análisis en curso. Sin él, la llamada no se reintenta. */
  presupuesto?: Presupuesto;
  proveedor?: ProveedorVision;
  opciones?: OpcionesAnalisis;
}

async function llamarConReintento<T>(opts: LlamadaOpts): Promise<T> {
  const proveedor = opts.proveedor ?? "deepseek";
  const client = getClient(proveedor);
  let ultimoError: unknown;
  const presupuesto = opts.presupuesto;
  // Si el proveedor rechazó las imágenes, el reintento de cortesía va sin
  // ellas (y solo una vez: la segunda vez ya no habría nada que cambiar).
  let imagenesDelIntento = opts.conImagenes !== false ? opts.imagenes : [];
  let avisoSinImagenes = false;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    if (presupuesto && !presupuesto.disponible()) {
      console.warn(
        `Presupuesto agotado en ${opts.etiqueta}; quedan ${presupuesto.restantes()} de ${PRESUPUESTO_LLAMADAS}`
      );
      break;
    }
    try {
      presupuesto?.consumir();
      const tiempoRestante = tiempoRestanteMs(opts.opciones);
      if (tiempoRestante <= 0) throw new DeadlineDiagnosticoError();
      const response = await client.chat.completions.create({
        model: proveedor === "openai" ? "gpt-4o-mini" : "deepseek-chat",
        messages: [
          {
            role: "user",
            content: contenidoMultimodal(
              avisoSinImagenes ? `${AVISO_SIN_IMAGENES}\n\n${opts.prompt}` : opts.prompt,
              imagenesDelIntento,
              true
            ),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: opts.maxTokens,
      }, { timeout: Math.min(35_000, tiempoRestante) });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error(`Respuesta vacía de ${nombreProveedor(proveedor)} (${opts.etiqueta})`);

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`JSON inválido en ${opts.etiqueta}: ${text.substring(0, 200)}`);
      }
    } catch (error) {
      ultimoError = error;
      const esJson = /JSON inválido/.test(String((error as Error)?.message ?? ""));
      // Rechazo de imágenes: una oportunidad sin ellas antes de abandonar,
      // salvo en la observación (ver sinImagenesSiRechazo).
      if (
        !esJson &&
        esRechazoDeImagenes(error) &&
        imagenesDelIntento.length > 0 &&
        !avisoSinImagenes &&
        opts.sinImagenesSiRechazo !== false
      ) {
        imagenesDelIntento = [];
        avisoSinImagenes = true;
        ultimoError = undefined;
        continue;
      }
      if (esJson || !esReintentable(error) || intento === MAX_INTENTOS) break;
      const restante = tiempoRestanteMs(opts.opciones);
      if (restante <= 0) throw new DeadlineDiagnosticoError();
      await dormir(Math.min(ESPERA_REINTENTO_MS[intento - 1], restante));
    }
  }

  if (ultimoError instanceof Error) throw ultimoError;
  throw new PresupuestoAgotadoError();
}

// ---------------------------------------------------------------------------
// FASE 1 — OBSERVACIÓN
// ---------------------------------------------------------------------------

async function observarImagen(
  imagenes: ImagenAnalisis[],
  presupuesto: Presupuesto,
  proveedor: ProveedorVision,
  opciones: OpcionesAnalisis
): Promise<Observacion> {
  opciones.onPhase?.("observacion");
  return llamarConReintento<Observacion>({
    prompt: buildPromptWithSchema(OBSERVATION_PROMPT, OBSERVATION_SCHEMA),
    maxTokens: 2048,
    imagenes,
    sinImagenesSiRechazo: false,
    etiqueta: `observación ${nombreProveedor(proveedor)}`,
    presupuesto,
    proveedor,
    opciones,
  });
}

// ---------------------------------------------------------------------------
// FASE 2 — DIAGNÓSTICO
// ---------------------------------------------------------------------------

export async function analizarImagenDeepSeek(
  imagenes: ImagenAnalisis[],
  isRetry = false,
  contexto?: ContextoUsuario,
  observacion?: Observacion,
  retroalimentacion?: string,
  presupuesto?: Presupuesto,
  proveedor: ProveedorVision = "deepseek",
  opciones?: OpcionesAnalisis
): Promise<DiagnosticoResponse> {
  const fewShots = selectFewShots(contexto?.variedad || contexto?.cultivo, observacion?.organo_detectado);
  const prompt = construirPromptDiagnostico(
    isRetry ? RETRY_PROMPT : SYSTEM_PROMPT,
    fewShots,
    observacion,
    contexto,
    retroalimentacion
  );
  return llamarConReintento<DiagnosticoResponse>({
    prompt: buildPromptWithSchema(prompt, RESPONSE_SCHEMA),
    maxTokens: 6144,
    imagenes,
    etiqueta: `diagnóstico ${nombreProveedor(proveedor)}`,
    presupuesto,
    proveedor,
    opciones,
  });
}

// ---------------------------------------------------------------------------
// FASE 3 — VERIFICACIÓN ADVERSARIAL
// ---------------------------------------------------------------------------

async function verificarDiagnostico(
  diagnostico: DiagnosticoResponse,
  observacion: Observacion,
  imagenes: ImagenAnalisis[],
  presupuesto: Presupuesto | undefined,
  proveedor: ProveedorVision,
  opciones: OpcionesAnalisis
): Promise<Verificacion> {
  opciones.onPhase?.("verificacion");
  const prompt = `${VERIFICATION_PROMPT}

HECHOS OBSERVADOS:
${JSON.stringify(observacion, null, 2)}

HIPÓTESIS PROPUESTA:
${JSON.stringify(diagnostico, null, 2)}`;

  return llamarConReintento<Verificacion>({
    prompt: buildPromptWithSchema(prompt, VERIFICATION_SCHEMA),
    maxTokens: 2048,
    // El verificador ve la foto principal: la coherencia se comprueba contra
    // la imagen, no solo contra el texto de la observación.
    imagenes: imagenes.length > 0
      ? [observacion.parte_visible === "enves" && imagenes.length > 1 ? imagenes[1] : imagenes[0]]
      : [],
    conImagenes: true,
    etiqueta: `verificación ${nombreProveedor(proveedor)}`,
    presupuesto,
    proveedor,
    opciones,
  });
}

// ---------------------------------------------------------------------------
// FLUJO COMPLETO CON VERIFICACIÓN Y REINTENTO
// ---------------------------------------------------------------------------

async function analizarConVerificacion(
  imagenes: ImagenAnalisis[],
  contexto: ContextoUsuario | undefined,
  observacion: Observacion,
  isRetry: boolean,
  presupuesto: Presupuesto,
  proveedor: ProveedorVision,
  opciones: OpcionesAnalisis
): Promise<DiagnosticoResponse> {
  opciones.onPhase?.(isRetry ? "reintento" : "hipotesis");
  const diag = await analizarImagenDeepSeek(
    imagenes,
    isRetry,
    contexto,
    observacion,
    undefined,
    presupuesto,
    proveedor,
    opciones
  );
  const verificacion = await verificarDiagnostico(diag, observacion, imagenes, presupuesto, proveedor, opciones);

  // El cuarto turno solo aporta si la verificación aporta algo que corregir y
  // si queda presupuesto: son dos llamadas más.
  const hayFeedback =
    verificacion.inconsistencias.length > 0 ||
    verificacion.sintomas_no_explicados.length > 0;

  if (
    !verificacion.diagnostico_validado &&
    !isRetry &&
    hayFeedback &&
    presupuesto.disponible()
  ) {
    try {
      const diag2 = await analizarImagenDeepSeek(
        imagenes,
        true,
        contexto,
        observacion,
        verificacion.inconsistencias.join("; "),
        presupuesto,
        proveedor,
        opciones
      );
      const ver2 = await verificarDiagnostico(diag2, observacion, imagenes, presupuesto, proveedor, opciones);

      if (ver2.confianza_ajustada >= verificacion.confianza_ajustada) {
        diag2.requiere_experto = !ver2.diagnostico_validado;
        diag2.diagnostico.confianza = Math.min(
          diag2.diagnostico.confianza,
          ver2.confianza_ajustada
        );
        return diag2;
      }
    } catch {
      console.warn(`Reintento ${nombreProveedor(proveedor)} con retroalimentación fallido; se conserva el diagnóstico original.`);
    }
  }

  diag.requiere_experto = !verificacion.diagnostico_validado;
  diag.diagnostico.confianza = Math.min(
    diag.diagnostico.confianza,
    verificacion.confianza_ajustada
  );
  return diag;
}

async function analizarConProveedorVision(
  imagenes: ImagenAnalisis[],
  contexto: ContextoUsuario | undefined,
  proveedor: ProveedorVision,
  opcionesInput?: OpcionesAnalisis
): Promise<DiagnosticoResponse> {
  const opciones = opcionesInput ?? { deadlineAt: Date.now() + 100_000 };
  const presupuesto = new Presupuesto(PRESUPUESTO_LLAMADAS);
  // La observación se comparte entre ambos intentos y, si las fotos son las
  // mismas que un reintento reciente, también entre peticiones (caché por hash).
  const claveCache = claveObservacion(proveedor, imagenes);
  const enCache = obtenerObservacion(claveCache);
  const observacion = enCache ?? (await observarImagen(imagenes, presupuesto, proveedor, opciones));
  if (!enCache) guardarObservacion(claveCache, observacion);
  else console.info(`Observación ${nombreProveedor(proveedor)} reutilizada de la caché.`);
  try {
    const resultado = await analizarConVerificacion(
      imagenes,
      contexto,
      observacion,
      false,
      presupuesto,
      proveedor,
      opciones
    );
    propagarCalidadImagen(resultado, observacion);
    return resultado;
  } catch (error) {
    if (error instanceof PresupuestoAgotadoError || error instanceof DeadlineDiagnosticoError) throw error;
    console.warn(
      `Primer intento ${nombreProveedor(proveedor)} fallido (presupuesto ${PRESUPUESTO_LLAMADAS - presupuesto.restantes()}/${PRESUPUESTO_LLAMADAS}), reintentando...`
    );
    const resultado = await analizarConVerificacion(
      imagenes,
      contexto,
      observacion,
      true,
      presupuesto,
      proveedor,
      opciones
    );
    propagarCalidadImagen(resultado, observacion);
    return resultado;
  }
}

export async function analizarConReintentoDeepSeek(
  imagenes: ImagenAnalisis[],
  contexto?: ContextoUsuario
): Promise<DiagnosticoResponse> {
  try {
    return await analizarConProveedorVision(imagenes, contexto, "deepseek");
  } catch (error) {
    if (error instanceof ErrorProveedorIA) throw error;
    throw new ErrorProveedorIA("DeepSeek", error);
  }
}

export async function analizarConReintentoOpenAI(
  imagenes: ImagenAnalisis[],
  contexto?: ContextoUsuario,
  opciones?: OpcionesAnalisis
): Promise<DiagnosticoResponse> {
  try {
    return await analizarConProveedorVision(imagenes, contexto, "openai", opciones);
  } catch (error) {
    if (error instanceof ErrorProveedorIA) throw error;
    throw new ErrorProveedorIA("OpenAI", error);
  }
}
