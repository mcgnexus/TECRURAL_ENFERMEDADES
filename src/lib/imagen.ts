/**
 * Validación real de imágenes: tipo por firma binaria (magic bytes), tamaño
 * y coherencia con el tipo declarado. Ni el frontend ni el backend confían
 * solo en la extensión.
 */

export const MAX_BYTES_IMAGEN = 12 * 1024 * 1024; // 12 MB antes de comprimir
export const TIPOS_ACEPTADOS_FRONTEND = "image/jpeg,image/png,image/webp";

export type TipoImagen = "jpeg" | "png" | "webp";

function bytesIguales(datos: Uint8Array, offset: number, firma: number[]): boolean {
  if (datos.length < offset + firma.length) return false;
  return firma.every((b, i) => datos[offset + i] === b);
}

export function detectarTipoImagen(datos: Uint8Array): TipoImagen | null {
  if (bytesIguales(datos, 0, [0xff, 0xd8, 0xff])) return "jpeg";
  if (bytesIguales(datos, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (
    bytesIguales(datos, 0, [0x52, 0x49, 0x46, 0x46]) && // "RIFF"
    bytesIguales(datos, 8, [0x57, 0x45, 0x42, 0x50]) // "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export interface ResultadoValidacionImagen {
  ok: boolean;
  tipo?: TipoImagen;
  error?: string;
}

/** Mensajes pensados para el agricultor, sin detalles técnicos. */
export function validarImagenServidor(
  buffer: ArrayBuffer,
  tipoDeclarado: string
): ResultadoValidacionImagen {
  if (!tipoDeclarado.startsWith("image/")) {
    return { ok: false, error: "El archivo seleccionado no es una imagen. Usa una foto JPG, PNG o WebP." };
  }

  if (buffer.byteLength === 0) {
    return { ok: false, error: "El archivo está vacío o dañado. Prueba a hacer la foto de nuevo." };
  }

  if (buffer.byteLength > MAX_BYTES_IMAGEN) {
    return { ok: false, error: "La imagen es demasiado grande. Haz la foto con la cámara de la app o reduce su tamaño." };
  }

  const tipoReal = detectarTipoImagen(new Uint8Array(buffer));
  if (!tipoReal) {
    return {
      ok: false,
      error: "No podemos leer esta imagen (puede ser un formato no compatible como HEIC o un archivo dañado). Usa una foto JPG, PNG o WebP.",
    };
  }

  return { ok: true, tipo: tipoReal };
}

/** Verifica un data URL recibido por JSON (para fotos adjuntas a un lead). */
export function validarDataUrlImagen(dataUrl: string): ResultadoValidacionImagen {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    return { ok: false, error: "Formato de imagen no válido" };
  }

  const base64 = match[2];
  // ~4/3 del tamaño binario en base64; límite por imagen ~1.7 MB binarios
  if (base64.length > 2_300_000) {
    return { ok: false, error: "Una de las imágenes es demasiado grande" };
  }

  let cabecera: Uint8Array;
  try {
    const bin = Buffer.from(base64.substring(0, 24), "base64");
    cabecera = new Uint8Array(bin);
  } catch {
    return { ok: false, error: "Imagen dañada" };
  }

  const tipoReal = detectarTipoImagen(cabecera);
  if (!tipoReal || tipoReal !== match[1]) {
    return { ok: false, error: "El contenido de la imagen no coincide con su formato declarado" };
  }

  return { ok: true, tipo: tipoReal };
}
