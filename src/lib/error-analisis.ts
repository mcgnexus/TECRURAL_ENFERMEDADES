/**
 * Traducción de errores del análisis a mensajes para el agricultor.
 *
 * Vive aquí, y no dentro de `page.tsx`, porque es lógica pura y sin React: así
 * se puede comprobar con una prueba. La variante "error del servidor con un
 * estado concreto" no se puede provocar desde la interfaz sin gastar cuota de
 * IA, y es justo la que antes fallaba.
 */

/**
 * Error de una respuesta HTTP fallida, con el estado conservado.
 *
 * Antes el `catch` lanzaba un `Error` con el mensaje de la API y llamaba a la
 * traducción sin el estado, así que las ramas de 400/429/502/503 no se
 * ejecutaban nunca: el agricultor recibía el mensaje genérico aunque el
 * servidor hubiera devuelto un error perfectamente reconocible.
 *
 * El estado es lo que distingue "la foto no se pudo interpretar" de "te has
 * pasado del límite de uso" o de "el servicio está caído", y cada caso se
 * resuelve de forma distinta: reintentar, esperar o repetir la foto.
 */
export class ErrorAnalisis extends Error {
  readonly status: number;

  constructor(status: number, mensaje?: string) {
    super(mensaje ?? "");
    this.name = "ErrorAnalisis";
    this.status = status;
  }
}

/**
 * Traduce errores técnicos a mensajes claros para el agricultor.
 *
 * Se apoya en dos datos y usa los dos: el estado HTTP para saber qué clase de
 * problema es, y el mensaje que envía la API cuando lo trae, porque está
 * redactado en español y es más concreto que cualquier texto genérico
 * ("Falta la foto principal", "Has alcanzado el límite de análisis...").
 *
 * El mensaje del servidor solo llega aquí si venía en el JSON de nuestra API.
 * Una respuesta que no sea JSON (la plataforma devuelve texto plano en un 413)
 * se queda sin mensaje y usa el de reserva: mostrarla tal cual sería enseñar un
 * texto técnico en inglés.
 */
export function mensajeAmigable(err: unknown): string {
  // Un TypeError es una caída de red, no una respuesta HTTP: el fetch ni
  // siquiera llegó a completarse.
  if (err instanceof TypeError) {
    return "Sin conexión suficiente. Comprueba tu red y reintenta: no has perdido las fotos ni los datos.";
  }

  const status = err instanceof ErrorAnalisis ? err.status : undefined;
  const delServidor = err instanceof Error ? err.message.trim() : "";

  if (status === 429) {
    return delServidor || "Se ha alcanzado el límite de uso temporal. Espera un rato y vuelve a intentarlo.";
  }
  if (status === 400) {
    return delServidor || "Revisa los datos y la foto, e inténtalo de nuevo.";
  }
  if (status === 413) {
    return delServidor || "La foto es demasiado grande para enviarla. Hazla de nuevo con la cámara de la app.";
  }
  if (status === 502) {
    return delServidor || "No hemos podido interpretar bien esta foto. Repítela con más luz y el síntoma enfocado.";
  }
  if (status === 503) {
    return delServidor || "El servicio de análisis no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.";
  }

  // Sin estado reconocible se prefiere el del servidor si existe, porque suele
  // ser más informativo que el genérico.
  return delServidor || "No hemos podido completar el análisis. Comprueba tu conexión e inténtalo de nuevo.";
}

/**
 * Lee el cuerpo de una respuesta fallida y lanza `ErrorAnalisis` con el estado
 * y, si la respuesta era el JSON de nuestra API, con su mensaje.
 *
 * El cuerpo se lee UNA sola vez (un `Response` no se puede consumir dos veces)
 * y sin exigir que sea JSON: un `response.json()` directo lanzaría un
 * SyntaxError con un 413 de la plataforma, que responde texto plano, y se
 * perdería incluso el estado.
 */
export async function errorDeRespuesta(response: Response): Promise<ErrorAnalisis> {
  let cuerpo: unknown;
  try {
    cuerpo = await response.json();
  } catch {
    cuerpo = undefined;
  }

  const posibleError = (cuerpo as { error?: unknown } | undefined)?.error;
  const mensaje = typeof posibleError === "string" && posibleError.trim() ? posibleError : undefined;

  return new ErrorAnalisis(response.status, mensaje);
}
