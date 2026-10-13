export interface AvisoCalidadFoto {
  nitidezBaja: boolean;
  exposicionDeficiente: boolean;
}

/** Heurística orientativa en el navegador; no sustituye el control del servidor. */
export async function evaluarCalidadFoto(file: Blob): Promise<AvisoCalidadFoto> {
  if (typeof createImageBitmap === "undefined") {
    return { nitidezBaja: false, exposicionDeficiente: false };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { nitidezBaja: false, exposicionDeficiente: false };
  }
  try {
    const canvas = document.createElement("canvas");
    const escala = Math.min(1, 160 / bitmap.width, 120 / bitmap.height);
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return { nitidezBaja: false, exposicionDeficiente: false };
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const gray = new Float32Array(canvas.width * canvas.height);
    let extremos = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const luminancia = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      gray[p] = luminancia;
      if (luminancia < 12 || luminancia > 243) extremos++;
    }

    let suma = 0;
    let sumaCuadrados = 0;
    let muestras = 0;
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const i = y * canvas.width + x;
        const laplaciano = gray[i - 1] + gray[i + 1] + gray[i - canvas.width] + gray[i + canvas.width] - 4 * gray[i];
        suma += laplaciano;
        sumaCuadrados += laplaciano * laplaciano;
        muestras++;
      }
    }
    const varianza = muestras ? sumaCuadrados / muestras - (suma / muestras) ** 2 : 0;
    return {
      nitidezBaja: varianza < 38,
      exposicionDeficiente: extremos / gray.length > 0.55,
    };
  } finally {
    bitmap.close();
  }
}
