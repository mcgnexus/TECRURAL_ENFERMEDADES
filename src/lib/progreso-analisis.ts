import { errorDeRespuesta, ErrorAnalisis } from "./error-analisis";
import type { FaseAnalisis } from "./opciones-analisis";

type EventoStream<T> =
  | { type: "phase"; phase: FaseAnalisis }
  | { type: "result"; data: T }
  | { type: "error"; status: number; data: { error?: string; cuota?: { requiereTelefono?: boolean } } };

export async function leerProgresoAnalisis<T>(
  response: Response,
  onPhase: (phase: FaseAnalisis) => void
): Promise<T> {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson") || !response.body) {
    if (!response.ok) throw await errorDeRespuesta(response);
    return response.json() as Promise<T>;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;
  const procesarLinea = (linea: string) => {
    if (!linea.trim()) return;
    let evento: EventoStream<T>;
    try {
      evento = JSON.parse(linea) as EventoStream<T>;
    } catch {
      throw new Error("La respuesta del análisis llegó incompleta. Comprueba tu conexión e inténtalo de nuevo.");
    }
    if (evento.type === "phase") onPhase(evento.phase);
    if (evento.type === "result") result = evento.data;
    if (evento.type === "error") {
      throw new ErrorAnalisis(evento.status, evento.data.error, Boolean(evento.data.cuota?.requiereTelefono));
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lineas = buffer.split("\n");
    buffer = lineas.pop() ?? "";
    for (const linea of lineas) procesarLinea(linea);
    if (done) break;
  }
  if (buffer.trim()) procesarLinea(buffer);
  if (result === undefined) throw new Error("El servicio cerró la respuesta antes de completar el análisis.");
  return result;
}
