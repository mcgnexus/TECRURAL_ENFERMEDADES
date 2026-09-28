import OpenAI from "openai";
import {
  SYSTEM_PROMPT,
  RETRY_PROMPT,
  OBSERVATION_PROMPT,
  VERIFICATION_PROMPT,
  conContextoUsuario,
  selectFewShots,
  type Observacion,
  type Verificacion,
} from "./system-prompt";
import type { ContextoUsuario, DiagnosticoResponse } from "@/types/diagnostico";
import type { ImagenAnalisis } from "./gemini";

export type { ImagenAnalisis };

let deepseek: OpenAI | null = null;

function getDeepSeek() {
  if (!deepseek) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY no configurada");
    }
    deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey,
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

const ESPERA_REINTENTO_MS = [600, 1500, 3000];
const MAX_INTENTOS = ESPERA_REINTENTO_MS.length + 1;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Saturación o corte de red: transitorio, merece la pena reintentar. */
function esReintentable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 429 || status === 500 || status === 502 || status === 503) return true;
  return /rate limit|overloaded|timeout|ECONN|fetch failed|socket/i.test(
    String((error as { message?: string })?.message ?? "")
  );
}

interface LlamadaOpts {
  prompt: string;
  maxTokens: number;
  imagenes: ImagenAnalisis[];
  /** La verificación solo razona sobre texto ya extraído: reenviar la imagen
   * multiplica el coste sin aportar información. */
  conImagenes?: boolean;
  etiqueta: string;
}

async function llamarConReintento<T>(opts: LlamadaOpts): Promise<T> {
  const client = getDeepSeek();
  let ultimoError: unknown;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      const response = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: contenidoMultimodal(opts.prompt, opts.imagenes, opts.conImagenes !== false),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: opts.maxTokens,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error(`Respuesta vacía de DeepSeek (${opts.etiqueta})`);

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`JSON inválido en ${opts.etiqueta}: ${text.substring(0, 200)}`);
      }
    } catch (error) {
      ultimoError = error;
      const esJson = /JSON inválido/.test(String((error as Error)?.message ?? ""));
      if (esJson || !esReintentable(error) || intento === MAX_INTENTOS) break;
      await dormir(ESPERA_REINTENTO_MS[intento - 1]);
    }
  }

  throw ultimoError instanceof Error ? ultimoError : new Error(`Fallo en ${opts.etiqueta}`);
}

// ---------------------------------------------------------------------------
// FASE 1 — OBSERVACIÓN
// ---------------------------------------------------------------------------

async function observarImagen(imagenes: ImagenAnalisis[]): Promise<Observacion> {
  return llamarConReintento<Observacion>({
    prompt: buildPromptWithSchema(OBSERVATION_PROMPT, OBSERVATION_SCHEMA),
    maxTokens: 2048,
    imagenes,
    etiqueta: "observación DeepSeek",
  });
}

// ---------------------------------------------------------------------------
// FASE 2 — DIAGNÓSTICO
// ---------------------------------------------------------------------------

function buildDiagnosisPrompt(
  basePrompt: string,
  fewShots: string,
  observacion: Observacion | undefined,
  contexto: ContextoUsuario | undefined,
  retroalimentacion: string | undefined
): string {
  let prompt = basePrompt;

  if (fewShots) {
    prompt += `\n\n${fewShots}`;
  }

  if (observacion) {
    prompt += `\n\nOBSERVACIÓN PREVIA EXTRAÍDA DE LA(S) IMAGEN(ES) (hechos verificados, úsalos como base para tu diagnóstico):\n${JSON.stringify(observacion, null, 2)}`;
  }

  if (retroalimentacion) {
    prompt += `\n\nRETROALIMENTACIÓN DEL REVISOR (corrige tu diagnóstico anterior):\n${retroalimentacion}`;
  }

  return conContextoUsuario(prompt, contexto);
}

export async function analizarImagenDeepSeek(
  imagenes: ImagenAnalisis[],
  isRetry = false,
  contexto?: ContextoUsuario,
  observacion?: Observacion,
  retroalimentacion?: string
): Promise<DiagnosticoResponse> {
  const fewShots = selectFewShots(contexto?.variedad || contexto?.cultivo, observacion?.organo_detectado);
  const prompt = buildDiagnosisPrompt(
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
    etiqueta: "diagnóstico DeepSeek",
  });
}

// ---------------------------------------------------------------------------
// FASE 3 — VERIFICACIÓN ADVERSARIAL
// ---------------------------------------------------------------------------

async function verificarDiagnostico(
  diagnostico: DiagnosticoResponse,
  observacion: Observacion
): Promise<Verificacion> {
  const prompt = `${VERIFICATION_PROMPT}

HECHOS OBSERVADOS:
${JSON.stringify(observacion, null, 2)}

HIPÓTESIS PROPUESTA:
${JSON.stringify(diagnostico, null, 2)}`;

  return llamarConReintento<Verificacion>({
    prompt: buildPromptWithSchema(prompt, VERIFICATION_SCHEMA),
    maxTokens: 2048,
    imagenes: [],
    conImagenes: false,
    etiqueta: "verificación DeepSeek",
  });
}

// ---------------------------------------------------------------------------
// FLUJO COMPLETO CON VERIFICACIÓN Y REINTENTO
// ---------------------------------------------------------------------------

async function analizarConVerificacion(
  imagenes: ImagenAnalisis[],
  contexto: ContextoUsuario | undefined,
  observacion: Observacion,
  isRetry: boolean
): Promise<DiagnosticoResponse> {
  const diag = await analizarImagenDeepSeek(
    imagenes,
    isRetry,
    contexto,
    observacion
  );
  const verificacion = await verificarDiagnostico(diag, observacion);

  // El cuarto turno solo aporta si la verificación aporta algo que corregir.
  const hayFeedback =
    verificacion.inconsistencias.length > 0 ||
    verificacion.sintomas_no_explicados.length > 0;

  if (!verificacion.diagnostico_validado && !isRetry && hayFeedback) {
    try {
      const diag2 = await analizarImagenDeepSeek(
        imagenes,
        true,
        contexto,
        observacion,
        verificacion.inconsistencias.join("; ")
      );
      const ver2 = await verificarDiagnostico(diag2, observacion);

      if (ver2.confianza_ajustada >= verificacion.confianza_ajustada) {
        diag2.requiere_experto = !ver2.diagnostico_validado;
        diag2.diagnostico.confianza = Math.min(
          diag2.diagnostico.confianza,
          ver2.confianza_ajustada
        );
        return diag2;
      }
    } catch {
      console.warn("Reintento DeepSeek con retroalimentación fallido, usando diagnóstico original");
    }
  }

  diag.requiere_experto = !verificacion.diagnostico_validado;
  diag.diagnostico.confianza = Math.min(
    diag.diagnostico.confianza,
    verificacion.confianza_ajustada
  );
  return diag;
}

export async function analizarConReintentoDeepSeek(
  imagenes: ImagenAnalisis[],
  contexto?: ContextoUsuario
): Promise<DiagnosticoResponse> {
  const observacion = await observarImagen(imagenes);
  try {
    return await analizarConVerificacion(imagenes, contexto, observacion, false);
  } catch (error) {
    console.warn("Primer intento DeepSeek fallido, reintentando...", error);
    return await analizarConVerificacion(imagenes, contexto, observacion, true);
  }
}
