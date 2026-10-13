import type { ContextoUsuario } from "@/types/diagnostico";
import { conContextoUsuario, type Observacion } from "./system-prompt";

export function construirPromptDiagnostico(
  basePrompt: string,
  fewShots: string,
  observacion: Observacion | undefined,
  contexto: ContextoUsuario | undefined,
  retroalimentacion: string | undefined
): string {
  let prompt = basePrompt;
  if (fewShots) prompt += `\n\n${fewShots}`;
  if (observacion) {
    prompt += `\n\nOBSERVACIÓN PREVIA EXTRAÍDA DE LA(S) IMAGEN(ES) (hechos verificados, úsalos como base para tu diagnóstico):\n${JSON.stringify(observacion, null, 2)}`;
  }
  if (retroalimentacion) {
    prompt += `\n\nRETROALIMENTACIÓN DEL REVISOR (corrige tu diagnóstico anterior):\n${retroalimentacion}`;
  }
  return conContextoUsuario(prompt, contexto);
}
