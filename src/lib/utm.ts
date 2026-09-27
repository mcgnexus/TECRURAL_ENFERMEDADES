/**
 * Captura de parámetros UTM y origen de campaña en el cliente.
 *
 * Los parámetros se leen de la URL al cargar la app y se conservan durante la
 * sesión (sessionStorage) para que sigan disponibles cuando el usuario envíe
 * la solicitud de revisión, aunque navegue entre pantallas (la SPA no recarga).
 */

import type { UtmParams } from "@/types/lead";

const CLAVE_SESSION = "tr-utm";

const CAMPOS: (keyof UtmParams)[] = ["source", "medium", "campaign", "content", "term"];

function leerDeUrl(): UtmParams {
  const params = new URLSearchParams(window.location.search);
  const utm: UtmParams = {};
  for (const campo of CAMPOS) {
    const valor = params.get(`utm_${campo}`);
    if (valor) utm[campo] = valor;
  }
  return utm;
}

function guardarEnSession(utm: UtmParams): void {
  try {
    sessionStorage.setItem(CLAVE_SESSION, JSON.stringify(utm));
  } catch {
    // sin sessionStorage disponible: se pierde la persistencia entre pantallas
  }
}

function leerDeSession(): UtmParams {
  try {
    const crudo = sessionStorage.getItem(CLAVE_SESSION);
    if (crudo) return JSON.parse(crudo) as UtmParams;
  } catch {
    // ignorar
  }
  return {};
}

/**
 * Devuelve los parámetros UTM de la visita. La primera vez prioriza los
 * presentes en la URL y los guarda; en llamadas posteriores devuelve el valor
 * ya capturado (para no perderlos si el usuario navega por la SPA).
 */
export function obtenerUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  const enUrl = leerDeUrl();
  const hayUtmEnUrl = CAMPOS.some((c) => enUrl[c]);

  if (hayUtmEnUrl) {
    const previo = leerDeSession();
    const combinado: UtmParams = { ...previo, ...enUrl };
    guardarEnSession(combinado);
    return combinado;
  }

  return leerDeSession();
}
