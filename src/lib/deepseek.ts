import OpenAI from "openai";
import {
  SYSTEM_PROMPT,
  RETRY_PROMPT,
  OBSERVATION_PROMPT,
  VERIFICATION_PROMPT,
  conContextoPlanta,
  selectFewShots,
  type Observacion,
  type Verificacion,
} from "./system-prompt";
import type { DiagnosticoResponse } from "@/types/diagnostico";

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

// ---------------------------------------------------------------------------
// FASE 1 — OBSERVACIÓN
// ---------------------------------------------------------------------------

async function observarImagen(
  base64Image: string,
  mimeType: string
): Promise<Observacion> {
  const client = getDeepSeek();
  const prompt = buildPromptWithSchema(OBSERVATION_PROMPT, OBSERVATION_SCHEMA);

  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 2048,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Respuesta vacía de DeepSeek (observación)");

  try {
    return JSON.parse(text) as Observacion;
  } catch {
    throw new Error(`JSON inválido en observación DeepSeek: ${text.substring(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// FASE 2 — DIAGNÓSTICO
// ---------------------------------------------------------------------------

function buildDiagnosisPrompt(
  basePrompt: string,
  fewShots: string,
  observacion: Observacion | undefined,
  nombrePlanta: string | undefined,
  retroalimentacion: string | undefined
): string {
  let prompt = basePrompt;

  if (fewShots) {
    prompt += `\n\n${fewShots}`;
  }

  if (observacion) {
    prompt += `\n\nOBSERVACIÓN PREVIA EXTRAÍDA DE LA IMAGEN (hechos verificados, úsala como base para tu diagnóstico):\n${JSON.stringify(observacion, null, 2)}`;
  }

  if (retroalimentacion) {
    prompt += `\n\nRETROALIMENTACIÓN DEL REVISOR (corrige tu diagnóstico anterior):\n${retroalimentacion}`;
  }

  return conContextoPlanta(prompt, nombrePlanta);
}

export async function analizarImagenDeepSeek(
  base64Image: string,
  mimeType: string,
  isRetry = false,
  nombrePlanta?: string,
  observacion?: Observacion,
  retroalimentacion?: string
): Promise<DiagnosticoResponse> {
  const fewShots = selectFewShots(nombrePlanta, observacion?.organo_detectado);
  const prompt = buildDiagnosisPrompt(
    isRetry ? RETRY_PROMPT : SYSTEM_PROMPT,
    fewShots,
    observacion,
    nombrePlanta,
    retroalimentacion
  );
  const fullPrompt = buildPromptWithSchema(prompt, RESPONSE_SCHEMA);
  const client = getDeepSeek();

  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: fullPrompt },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 4096,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Respuesta vacía de DeepSeek");

  try {
    return JSON.parse(text) as DiagnosticoResponse;
  } catch {
    throw new Error(`JSON inválido de DeepSeek: ${text.substring(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// FASE 3 — VERIFICACIÓN ADVERSARIAL
// ---------------------------------------------------------------------------

async function verificarDiagnostico(
  base64Image: string,
  mimeType: string,
  diagnostico: DiagnosticoResponse,
  observacion: Observacion
): Promise<Verificacion> {
  const prompt = `${VERIFICATION_PROMPT}

HECHOS OBSERVADOS:
${JSON.stringify(observacion, null, 2)}

DIAGNÓSTICO PROPUESTO:
${JSON.stringify(diagnostico, null, 2)}`;

  const fullPrompt = buildPromptWithSchema(prompt, VERIFICATION_SCHEMA);
  const client = getDeepSeek();

  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: fullPrompt },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 2048,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Respuesta vacía de DeepSeek (verificación)");

  try {
    return JSON.parse(text) as Verificacion;
  } catch {
    throw new Error(`JSON inválido en verificación DeepSeek: ${text.substring(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// FLUJO COMPLETO CON VERIFICACIÓN Y REINTENTO
// ---------------------------------------------------------------------------

async function analizarConVerificacion(
  base64Image: string,
  mimeType: string,
  nombrePlanta: string | undefined,
  observacion: Observacion,
  isRetry: boolean
): Promise<DiagnosticoResponse> {
  const diag = await analizarImagenDeepSeek(
    base64Image,
    mimeType,
    isRetry,
    nombrePlanta,
    observacion
  );
  const verificacion = await verificarDiagnostico(
    base64Image,
    mimeType,
    diag,
    observacion
  );

  if (!verificacion.diagnostico_validado && !isRetry) {
    try {
      const diag2 = await analizarImagenDeepSeek(
        base64Image,
        mimeType,
        true,
        nombrePlanta,
        observacion,
        verificacion.inconsistencias.join("; ")
      );
      const ver2 = await verificarDiagnostico(
        base64Image,
        mimeType,
        diag2,
        observacion
      );

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
  base64Image: string,
  mimeType: string,
  nombrePlanta?: string
): Promise<DiagnosticoResponse> {
  const observacion = await observarImagen(base64Image, mimeType);
  try {
    return await analizarConVerificacion(
      base64Image,
      mimeType,
      nombrePlanta,
      observacion,
      false
    );
  } catch (error) {
    console.warn("Primer intento DeepSeek fallido, reintentando...", error);
    return await analizarConVerificacion(
      base64Image,
      mimeType,
      nombrePlanta,
      observacion,
      true
    );
  }
}
