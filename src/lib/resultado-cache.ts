import { createHash } from "node:crypto";
import type { DiagnosticoResponse } from "@/types/diagnostico";

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRADAS = 100;
const VERSION_PIPELINE = "gemini-openai-v1";

export interface ResultadoCacheado {
  diagnostico: DiagnosticoResponse;
  proveedor: "gemini" | "openai";
}

interface Entrada extends ResultadoCacheado {
  caduca: number;
}

const cache = new Map<string, Entrada>();

export function claveResultado(
  imagenes: Array<{ base64: string; mimeType: string }>,
  contexto: unknown,
  visitanteId: string
): string {
  const hash = createHash("sha256");
  hash.update(VERSION_PIPELINE);
  hash.update(visitanteId);
  for (const img of imagenes) hash.update(`${img.mimeType}:${img.base64}|`);
  hash.update(JSON.stringify(contexto ?? {}));
  return hash.digest("hex");
}

export function obtenerResultado(clave: string): ResultadoCacheado | undefined {
  const entrada = cache.get(clave);
  if (!entrada) return undefined;
  if (Date.now() > entrada.caduca) {
    cache.delete(clave);
    return undefined;
  }
  return structuredClone({ diagnostico: entrada.diagnostico, proveedor: entrada.proveedor });
}

export function guardarResultado(clave: string, resultado: ResultadoCacheado): void {
  const ahora = Date.now();
  for (const [key, entrada] of cache) if (ahora > entrada.caduca) cache.delete(key);
  if (!cache.has(clave) && cache.size >= MAX_ENTRADAS) {
    const masAntigua = cache.keys().next().value;
    if (masAntigua !== undefined) cache.delete(masAntigua);
  }
  cache.set(clave, { ...structuredClone(resultado), caduca: ahora + TTL_MS });
}

export function vaciarCacheResultados(): void {
  cache.clear();
}
