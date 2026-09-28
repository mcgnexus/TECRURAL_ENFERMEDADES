import { GoogleGenAI } from "@google/genai";
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

export interface ImagenAnalisis {
  base64: string;
  mimeType: string;
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const MODELO = "gemini-2.5-flash";

/**
 * Razonamiento desactivado a propósito. El modelo piensa ~1.900 tokens por
 * llamada (medido: 11,5 s de media en la fase de observación frente a 2,4 s
 * sin pensar) y, al consumir el presupuesto de maxOutputTokens, dejaba el JSON
 * truncado e inválido en varias llamadas. Aquí el razonamiento ya está
 * estructurado en fases separadas, así que el thinking no aporta.
 */
const CONFIG_BASE = {
  thinkingConfig: { thinkingBudget: 0 },
} as const;

/** El esquema deja tokens para el JSON aunque el thinking esté desactivado. */
const MAX_TOKENS_OBSERVACION = 2048;
const MAX_TOKENS_DIAGNOSTICO = 6144;
const MAX_TOKENS_VERIFICACION = 2048;

const ESPERA_REINTENTO_MS = [600, 1500, 3000];
const MAX_INTENTOS = ESPERA_REINTENTO_MS.length + 1;

function parteImagenes(imagenes: ImagenAnalisis[], conImagenes = true) {
  if (!conImagenes) return [];
  return imagenes.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
}

/** Un 503 por saturación del modelo es transitorio: reintentar es más rápido
 * que caer al proveedor alternativo, que repetiría las tres fases. */
function esReintentable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 503 || status === 429 || status === 500 || status === 502) return true;
  return /overloaded|high demand|UNAVAILABLE|RESOURCE_EXHAUSTED|fetch failed|timeout|ECONN/i.test(
    String((error as { message?: string })?.message ?? "")
  );
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface LlamadaOpts {
  prompt: string;
  schema: object;
  maxOutputTokens: number;
  imagenes: ImagenAnalisis[];
  /** La verificación solo razona sobre texto ya extraído: reenviar la imagen
   * multiplica el coste sin aportar información. */
  conImagenes?: boolean;
  etiqueta: string;
}

async function llamarConReintento<T>(opts: LlamadaOpts): Promise<T> {
  let ultimoError: unknown;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      const response = await ai.models.generateContent({
        model: MODELO,
        contents: [
          {
            role: "user",
            parts: [
              { text: opts.prompt },
              ...parteImagenes(opts.imagenes, opts.conImagenes !== false),
            ],
          },
        ],
        config: {
          ...CONFIG_BASE,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
          temperature: 0.1,
          maxOutputTokens: opts.maxOutputTokens,
        },
      });

      const text = response.text;
      if (!text) throw new Error(`Respuesta vacía de Gemini (${opts.etiqueta})`);

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`JSON inválido en ${opts.etiqueta}: ${text.substring(0, 200)}`);
      }
    } catch (error) {
      ultimoError = error;
      // Un JSON truncado no mejora reintentando: es un problema de formato.
      const esJson = /JSON inválido/.test(String((error as Error)?.message ?? ""));
      if (esJson || !esReintentable(error) || intento === MAX_INTENTOS) break;
      await dormir(ESPERA_REINTENTO_MS[intento - 1]);
    }
  }

  throw ultimoError instanceof Error ? ultimoError : new Error(`Fallo en ${opts.etiqueta}`);
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
    descripcion_hechos: {
      type: "array",
      items: { type: "string" },
    },
    signos_presentes: {
      type: "array",
      items: { type: "string" },
    },
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
        sintomas_observados: {
          type: "array",
          items: { type: "string" },
        },
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
    hallazgos_negativos: {
      type: "array",
      items: { type: "string" },
    },
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
    inconsistencias: {
      type: "array",
      items: { type: "string" },
    },
    sintomas_no_explicados: {
      type: "array",
      items: { type: "string" },
    },
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

// ---------------------------------------------------------------------------
// FASE 1 — OBSERVACIÓN
// ---------------------------------------------------------------------------

async function observarImagen(
  imagenes: ImagenAnalisis[]
): Promise<Observacion> {
  return llamarConReintento<Observacion>({
    prompt: OBSERVATION_PROMPT,
    schema: OBSERVATION_SCHEMA,
    maxOutputTokens: MAX_TOKENS_OBSERVACION,
    imagenes,
    etiqueta: "observación",
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

export async function analizarImagen(
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
    prompt,
    schema: RESPONSE_SCHEMA,
    maxOutputTokens: MAX_TOKENS_DIAGNOSTICO,
    imagenes,
    etiqueta: "diagnóstico",
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
    prompt,
    schema: VERIFICATION_SCHEMA,
    maxOutputTokens: MAX_TOKENS_VERIFICACION,
    imagenes: [],
    conImagenes: false,
    etiqueta: "verificación",
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
  const diag = await analizarImagen(
    imagenes,
    isRetry,
    contexto,
    observacion
  );
  const verificacion = await verificarDiagnostico(diag, observacion);

  // El cuarto turno solo aporta si la verificación aporta algo que corregir.
  // Antes se disparaba con "no validado", que es el caso habitual en fotos
  // difíciles y convertía cada análisis en 5 llamadas (~35 s en lugar de ~13 s).
  const hayFeedback =
    verificacion.inconsistencias.length > 0 ||
    verificacion.sintomas_no_explicados.length > 0;

  if (!verificacion.diagnostico_validado && !isRetry && hayFeedback) {
    try {
      const diag2 = await analizarImagen(
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
      console.warn("Reintento con retroalimentación fallido, usando diagnóstico original");
    }
  }

  diag.requiere_experto = !verificacion.diagnostico_validado;
  diag.diagnostico.confianza = Math.min(
    diag.diagnostico.confianza,
    verificacion.confianza_ajustada
  );
  return diag;
}

export async function analizarConReintento(
  imagenes: ImagenAnalisis[],
  contexto?: ContextoUsuario
): Promise<DiagnosticoResponse> {
  // La observación se comparte entre ambos intentos: si falla el diagnóstico,
  // repetir la fase 1 añadiría ~4 s sin aportar nada nuevo.
  const observacion = await observarImagen(imagenes);
  try {
    return await analizarConVerificacion(imagenes, contexto, observacion, false);
  } catch (error) {
    console.warn("Primer intento fallido, reintentando...", error);
    return await analizarConVerificacion(imagenes, contexto, observacion, true);
  }
}
