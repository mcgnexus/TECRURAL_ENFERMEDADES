import { describe, expect, it } from "vitest";
import { leerProgresoAnalisis } from "./progreso-analisis";

function responseStream(events: unknown[]): Response {
  const body = events.map((event) => `${JSON.stringify(event)}\n`).join("");
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
}

describe("leerProgresoAnalisis", () => {
  it("emite fases y devuelve el resultado final", async () => {
    const fases: string[] = [];
    const result = await leerProgresoAnalisis<{ ok: boolean }>(responseStream([
      { type: "phase", phase: "observacion" },
      { type: "phase", phase: "hipotesis" },
      { type: "result", data: { ok: true } },
    ]), (phase) => fases.push(phase));
    expect(fases).toEqual(["observacion", "hipotesis"]);
    expect(result).toEqual({ ok: true });
  });

  it("mantiene estado y mensaje de errores enviados dentro del stream", async () => {
    await expect(leerProgresoAnalisis(responseStream([
      { type: "error", status: 503, data: { error: "Servicio no disponible" } },
    ]), () => undefined)).rejects.toMatchObject({ status: 503, message: "Servicio no disponible" });
  });
});
