import { createHash } from "node:crypto";
import type { Observacion } from "./system-prompt";

/**
 * Caché de observaciones (fase 1) por contenido de las imágenes.
 *
 * Cuando el usuario reintenta tras un fallo, vuelve a subir EXACTAMENTE las
 * mismas fotos (se conservan en el cliente para reintentar, page.tsx) y hoy se
 * repagaba la observación: una llamada completa con las imágenes de nuevo.
 * El hash SHA-256 de los bytes permite saltarla.
 *
 * La clave incluye el proveedor: la observación la emite un modelo concreto y
 * no se debe mezclar la salida de Gemini con la de DeepSeek.
 *
 * Es una caché en memoria por instancia: en serverless puede evaporarse entre
 * peticiones, y no pasa nada — el caso normal de acierto es el reintento
 * inmediato, que aterriza en la misma instancia. Nunca guarda imágenes, solo
 * el JSON de la observación, y caduca a los 15 minutos.
 */

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRADAS = 200;

interface Entrada {
  observacion: Observacion;
  caduca: number;
}

const cache = new Map<string, Entrada>();

export function claveObservacion(
  proveedor: string,
  imagenes: Array<{ base64: string; mimeType: string }>
): string {
  const hash = createHash("sha256");
  hash.update(proveedor);
  for (const img of imagenes) {
    hash.update(img.mimeType);
    hash.update(":");
    hash.update(img.base64);
    hash.update("|");
  }
  return hash.digest("hex");
}

export function obtenerObservacion(clave: string): Observacion | undefined {
  const entrada = cache.get(clave);
  if (!entrada) return undefined;
  if (Date.now() > entrada.caduca) {
    cache.delete(clave);
    return undefined;
  }
  return entrada.observacion;
}

export function guardarObservacion(clave: string, observacion: Observacion): void {
  const ahora = Date.now();
  // Purga de caducados al insertar: sin temporizador periódico, que en
  // serverless no hay garantía de proceso largo.
  for (const [claveVieja, entrada] of cache) {
    if (ahora > entrada.caduca) cache.delete(claveVieja);
  }
  if (cache.size >= MAX_ENTRADAS) {
    // Map conserva el orden de inserción: la primera es la más vieja.
    const masVieja = cache.keys().next().value;
    if (masVieja !== undefined) cache.delete(masVieja);
  }
  cache.set(clave, { observacion, caduca: ahora + TTL_MS });
}

/** Solo para pruebas. */
export function vaciarCache(): void {
  cache.clear();
}
