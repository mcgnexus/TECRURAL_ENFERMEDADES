import OpenAI from "openai";
import { SYSTEM_PROMPT, RETRY_PROMPT, conContextoPlanta } from "./system-prompt";
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
    recomendacion: { type: "string" },
    requiere_experto: { type: "boolean" },
  },
  required: [
    "organo_detectado",
    "especie_identificada",
    "confianza_identificacion",
    "diagnostico",
    "estado_madurez",
    "recomendacion",
    "requiere_experto",
  ],
};

function buildDeepSeekPrompt(basePrompt: string): string {
  return `${basePrompt}

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto extra). El JSON debe seguir exactamente este esquema:
${JSON.stringify(RESPONSE_SCHEMA, null, 2)}`;
}

export async function analizarImagenDeepSeek(
  base64Image: string,
  mimeType: string,
  isRetry = false,
  nombrePlanta?: string
): Promise<DiagnosticoResponse> {
  const basePrompt = conContextoPlanta(
    isRetry ? RETRY_PROMPT : SYSTEM_PROMPT,
    nombrePlanta
  );
  const prompt = buildDeepSeekPrompt(basePrompt);
  const client = getDeepSeek();

  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 2048,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Respuesta vacía de DeepSeek");
  }

  try {
    const parsed = JSON.parse(text) as DiagnosticoResponse;
    return parsed;
  } catch (e) {
    throw new Error(`JSON inválido de DeepSeek: ${text.substring(0, 200)}`);
  }
}

export async function analizarConReintentoDeepSeek(
  base64Image: string,
  mimeType: string,
  nombrePlanta?: string
): Promise<DiagnosticoResponse> {
  try {
    return await analizarImagenDeepSeek(base64Image, mimeType, false, nombrePlanta);
  } catch (error) {
    console.warn("Primer intento DeepSeek fallido, reintentando...", error);
    return await analizarImagenDeepSeek(base64Image, mimeType, true, nombrePlanta);
  }
}