/**
 * Analítica de conversión en el cliente.
 *
 * Guarda un buffer local en localStorage para depuración y persiste eventos
 * permitidos en first-party, sin enviar datos a servicios de analítica externos.
 *
 * Eventos del embudo, en el orden en que ocurren:
 * - portada_vista: llegada a la portada. Es el denominador real de la tasa de
 *   conversión, y antes no se registraba: sin él no había forma de contar las
 *   visitas que se marchaban sin analizar.
 * - captura_realizada: el usuario cargó u hizo una foto
 * - analisis_iniciado / analisis_completado / analisis_error
 * - resultado_visto: con gravedad y si requiere experto (calidad del lead)
 * - cta_revision_abierto: empezó a rellenar un formulario tras el diagnóstico
 *   (lleva `intencion`: guardar el informe o pedir revisión)
 * - informe_desbloqueado: dejó su contacto y vio el informe completo (lleva
 *   `intencion`: informe o revisión, porque ambas acciones lo abren)
 * - informe_pdf: guardó o imprimió el informe en PDF
 * - lead_enviado / lead_error: formulario enviado (lleva `intencion`)
 * - informe_envio_aceptado: Resend confirmó el enlace (2xx con id). Solo
 *   entonces la pantalla puede decir "enviado"; entrega ≠ recepción.
 * - informe_envio_fallido: no se pudo entregar a Resend (red, 4xx/5xx, sin id).
 * - whatsapp_click: contacto por WhatsApp
 * - ejemplo_visto: abrió el ejemplo de la portada. Es informativo y NO forma
 *   parte del embudo: no equivale a un análisis real.
 */

export type NombreEvento =
  | "portada_vista"
  | "captura_realizada"
  | "analisis_iniciado"
  | "analisis_completado"
  | "analisis_error"
  | "resultado_visto"
  | "cta_revision_abierto"
  | "informe_desbloqueado"
  | "informe_pdf"
  | "lead_enviado"
  | "lead_error"
  | "informe_envio_aceptado"
  | "informe_envio_fallido"
  | "whatsapp_click"
  | "ejemplo_visto";

const CLAVE_BUFFER = "tr-eventos";

/** Eventos pendientes de enviar al servidor, para agruparlos en una llamada. */
let cola: { nombre: NombreEvento; params: Record<string, unknown> }[] = [];
let vaciando = false;

function vaciar(): void {
  if (vaciando || cola.length === 0) return;
  vaciando = true;
  const lote = cola;
  cola = [];

  void fetch("/api/eventos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // keepalive para que la petición salga aunque el usuario navegue o cierre.
    keepalive: true,
    body: JSON.stringify({ eventos: lote }),
  })
    .catch(() => {
      // Si falla, no se reintenta: perder un dato de analítica es preferible a
      // reintentar en el teléfono de un agricultor con cobertura justa.
    })
    .finally(() => {
      vaciando = false;
      if (cola.length > 0) vaciar();
    });
}

export function trackEvento(nombre: NombreEvento, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;

  try {
    // Buffer local: solo para depurar en las herramientas del navegador. Este
    // contenido NUNCA sale del dispositivo.
    const buffer = JSON.parse(localStorage.getItem(CLAVE_BUFFER) || "[]");
    buffer.push({ nombre, params, t: Date.now() });
    localStorage.setItem(CLAVE_BUFFER, JSON.stringify(buffer.slice(-100)));

    // Persistencia en nuestra base de datos (first party), que es la que usa
    // el panel. Se agrupa para no generar una petición por evento.
    cola.push({ nombre, params });
    if (cola.length >= 5) vaciar();
  } catch {
    // La analítica nunca debe romper el flujo del usuario
  }
}

/**
 * Vacía la cola. Se llama al esconder la pestaña y al descargar la página,
 * que es cuando se perderían los eventos pendientes. Devuelve una promesa para
 * que quien la llame pueda esperar en `visibilitychange`.
 */
export function volcarEventos(): Promise<void> {
  if (typeof window === "undefined" || cola.length === 0) return Promise.resolve();
  const pendiente = cola;
  cola = [];
  vaciando = true;
  return fetch("/api/eventos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ eventos: pendiente }),
  })
    .catch(() => {})
    .then(() => undefined)
    .finally(() => {
      vaciando = false;
    });
}
