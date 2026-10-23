import type {
  CanalComercial,
  ConsentimientoComercialRegistrado,
  OrigenLead,
} from "@/types/lead";

/**
 * Consentimiento comercial explícito por canal.
 *
 * Cada autorización se liga al canal que se mostró en el formulario, nunca al
 * contacto que la persona dejara para otra finalidad. El teléfono de una
 * revisión no autoriza publicidad por WhatsApp: es exactamente el error que
 * este módulo impide.
 *
 * Es lógica pura: la validación del POST, la persistencia y la notificación
 * usan las mismas reglas y se pueden probar sin base de datos ni navegador.
 */

export const TEXTOS_COMERCIALES = {
  correo: {
    version: "v2-2026-10",
    texto: "Quiero recibir consejos y novedades por correo",
  },
  whatsapp: {
    version: "v2-2026-10",
    texto:
      "Quiero recibir por WhatsApp consejos y novedades comerciales de TecRural",
  },
} as const;

/**
 * Versión de los consentimientos guardados por la app anterior. Solo se usa al
 * aceptar un payload antiguo que todavía envía el booleano ambiguo.
 */
export const VERSION_CONSENTIMIENTO_LEGACY = "v1-2026-09";

/**
 * Canal comercial que se mostró en cada formulario. Es la única fuente de
 * verdad: inferirlo de "hay teléfono" fue la causa del bug.
 */
export const CANAL_COMERCIAL_PERMITIDO: Record<OrigenLead, CanalComercial> = {
  post_diagnostico: "correo",
  contacto_directo: "whatsapp",
};

export interface ConsentimientoSolicitado {
  canal: CanalComercial;
  texto_version: string;
}

export interface DatosValidacionConsentimientos {
  origen: OrigenLead;
  email?: string;
  telefono?: string;
  /** Array tal y como llega del cliente; se valida de forma defensiva. */
  consentimientosComerciales?: unknown;
  /** Booleano heredado de una PWA con JS antiguo. */
  consentimientoComercial?: boolean;
}

export interface ResultadoConsentimientos {
  ok: boolean;
  error?: string;
  /** Autorizaciones normalizadas; vacío si no se autorizó nada. */
  consentimientos: ConsentimientoSolicitado[];
  /** true cuando se dedujo del booleano antiguo y no de canales explícitos. */
  compatibilidad: boolean;
}

const ERROR_GENERICO =
  "No se pudo registrar la autorización de novedades. Recarga la página e inténtalo de nuevo.";
const ERROR_CANAL =
  "El canal de novedades no corresponde al formulario mostrado.";
const ERROR_VERSION =
  "La versión del texto de consentimiento no está actualizada. Recarga la página.";
const ERROR_DUPLICADO =
  "La autorización de novedades está repetida. Recarga la página.";

function fallo(error: string): ResultadoConsentimientos {
  return { ok: false, error, consentimientos: [], compatibilidad: false };
}

function esCanal(valor: unknown): valor is CanalComercial {
  return valor === "correo" || valor === "whatsapp";
}

function tieneContacto(
  canal: CanalComercial,
  datos: DatosValidacionConsentimientos
): boolean {
  if (canal === "correo") return Boolean(datos.email?.trim());
  return Boolean(datos.telefono?.trim());
}

function errorContacto(canal: CanalComercial): string {
  return canal === "correo"
    ? "La autorización de novedades por correo requiere un correo electrónico."
    : "La autorización de novedades por WhatsApp requiere un teléfono.";
}

/**
 * Valida una solicitud de consentimiento comercial.
 *
 * Reglas, en este orden:
 * - Un envío no puede mezclar el array nuevo con el booleano antiguo.
 * - Cada canal debe ser el que se mostró para el origen.
 * - Cada canal exige el contacto que necesita (correo o teléfono).
 * - No se admiten canales duplicados ni versiones de texto desconocidas.
 * - Sin autorización no es un error: simplemente no hay consentimiento.
 */
export function validarConsentimientosComerciales(
  datos: DatosValidacionConsentimientos
): ResultadoConsentimientos {
  const permitido = CANAL_COMERCIAL_PERMITIDO[datos.origen];
  const legacy = datos.consentimientoComercial === true;
  const bruto = datos.consentimientosComerciales;

  if (bruto !== undefined && bruto !== null && !Array.isArray(bruto)) {
    return fallo(ERROR_GENERICO);
  }

  const lista = Array.isArray(bruto) ? bruto : [];

  if (Array.isArray(bruto) && legacy) {
    return fallo(ERROR_GENERICO);
  }

  if (lista.length === 0) {
    if (!legacy) {
      return { ok: true, consentimientos: [], compatibilidad: false };
    }

    // Payload antiguo: se mapea por origen, jamás por "hay teléfono".
    if (!tieneContacto(permitido, datos)) {
      return fallo(errorContacto(permitido));
    }
    return {
      ok: true,
      consentimientos: [
        { canal: permitido, texto_version: VERSION_CONSENTIMIENTO_LEGACY },
      ],
      compatibilidad: true,
    };
  }

  const vistos = new Set<CanalComercial>();
  const consentimientos: ConsentimientoSolicitado[] = [];

  for (const item of lista) {
    if (!item || typeof item !== "object") return fallo(ERROR_GENERICO);

    const { canal, texto_version } = item as Record<string, unknown>;

    if (!esCanal(canal)) return fallo(ERROR_CANAL);
    if (canal !== permitido) return fallo(ERROR_CANAL);
    if (vistos.has(canal)) return fallo(ERROR_DUPLICADO);

    if (
      typeof texto_version !== "string" ||
      texto_version.trim() !== TEXTOS_COMERCIALES[canal].version
    ) {
      return fallo(ERROR_VERSION);
    }

    if (!tieneContacto(canal, datos)) return fallo(errorContacto(canal));

    vistos.add(canal);
    consentimientos.push({
      canal,
      texto_version: TEXTOS_COMERCIALES[canal].version,
    });
  }

  return { ok: true, consentimientos, compatibilidad: false };
}

/**
 * Parsea el JSONB almacenado sin lanzar nunca.
 *
 * Neon puede devolverlo como objeto o como cadena según el driver; ambas se
 * aceptan. Una entrada corrupta se descarta y el resto se conserva. Si no queda
 * ninguna válida, el resultado es `[]` y quien mapea decide si es histórico.
 */
export function parsearConsentimientosComerciales(
  valor: unknown
): ConsentimientoComercialRegistrado[] {
  let bruto = valor;
  if (typeof bruto === "string") {
    try {
      bruto = JSON.parse(bruto);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(bruto)) return [];

  const salida: ConsentimientoComercialRegistrado[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const registro = item as Record<string, unknown>;

    if (!esCanal(registro.canal)) continue;
    if (
      typeof registro.texto_version !== "string" ||
      registro.texto_version.trim() === ""
    ) {
      continue;
    }
    if (
      typeof registro.aceptado_en !== "string" ||
      registro.aceptado_en.trim() === ""
    ) {
      continue;
    }
    if (
      registro.origen !== "post_diagnostico" &&
      registro.origen !== "contacto_directo"
    ) {
      continue;
    }
    if (
      registro.revocado_en != null &&
      typeof registro.revocado_en !== "string"
    ) {
      continue;
    }

    salida.push({
      canal: registro.canal,
      texto_version: registro.texto_version,
      aceptado_en: registro.aceptado_en,
      origen: registro.origen,
      revocado_en:
        typeof registro.revocado_en === "string" ? registro.revocado_en : null,
      ...(registro.compatibilidad === true ? { compatibilidad: true } : {}),
    });
  }
  return salida;
}

export interface ConsentimientoAgregado {
  consentimiento_comercial: boolean;
  consentimiento_comercial_fecha: string | null;
  consentimiento_texto_version: string | null;
  canal_comercial: CanalComercial | null;
}

/**
 * Campos agregados que se derivan SIEMPRE del array, en un único punto.
 *
 * La tabla conserva el booleano y el canal heredados para no romper consultas
 * antiguas, pero nadie puede pasarlos sueltos: se calculan aquí para que no se
 * vuelvan a desincronizar del detalle por canal.
 */
export function derivarConsentimientoAgregado(
  registros: ConsentimientoComercialRegistrado[]
): ConsentimientoAgregado {
  const activos = registros.filter((registro) => !registro.revocado_en);
  const canales = [...new Set(activos.map((registro) => registro.canal))];
  const versiones = [
    ...new Set(activos.map((registro) => registro.texto_version)),
  ];
  const fecha = activos.reduce<string | null>((minima, registro) => {
    if (minima === null || registro.aceptado_en < minima) {
      return registro.aceptado_en;
    }
    return minima;
  }, null);

  return {
    consentimiento_comercial: activos.length > 0,
    consentimiento_comercial_fecha: fecha,
    consentimiento_texto_version: versiones.length === 1 ? versiones[0] : null,
    canal_comercial: canales.length === 1 ? canales[0] : null,
  };
}

/** Distingue un consentimiento explícito de uno inferido por la app antigua. */
export function fuenteConsentimientoComercial(
  registros: ConsentimientoComercialRegistrado[],
  consentimientoComercial: boolean
): "explicito" | "legacy_inferido" | "ninguno" {
  if (registros.length > 0) return "explicito";
  if (consentimientoComercial) return "legacy_inferido";
  return "ninguno";
}
