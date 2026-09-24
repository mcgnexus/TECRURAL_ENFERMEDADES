import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, RETRY_PROMPT } from "./system-prompt";
import type { DiagnosticoResponse } from "@/types/diagnostico";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

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

export async function analizarImagen(
  base64Image: string,
  mimeType: string,
  isRetry = false
): Promise<DiagnosticoResponse> {
  const prompt = isRetry ? RETRY_PROMPT : SYSTEM_PROMPT;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Respuesta vacía de Gemini");
  }

  try {
    const parsed = JSON.parse(text) as DiagnosticoResponse;
    return parsed;
  } catch (e) {
    throw new Error(`JSON inválido de Gemini: ${text.substring(0, 200)}`);
  }
}

export async function analizarConReintento(
  base64Image: string,
  mimeType: string
): Promise<DiagnosticoResponse> {
  try {
    return await analizarImagen(base64Image, mimeType, false);
  } catch (error) {
    console.warn("Primer intento fallido, reintentando...", error);
    return await analizarImagen(base64Image, mimeType, true);
  }
}