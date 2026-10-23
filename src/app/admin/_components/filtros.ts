import { ESTADOS_LEAD } from "@/types/lead";
import type { EstadoLead, LeadFila, OrigenLead, PrioridadLead } from "@/types/lead";

/**
 * Lógica pura del panel de leads: filtrado, ordenación y paginación.
 *
 * Vive aparte de los componentes para poder probarse sin navegador (el entorno
 * de vitest de este proyecto es `node`). Los componentes solo pintan el
 * resultado de estas funciones.
 */

export interface Filtros {
  texto: string;
  estado: EstadoLead | "";
  prioridad: PrioridadLead | "";
  origen: OrigenLead | "";
  campana: string;
  municipio: string;
  cultivo: string;
  canal: string;
  /** Fecha ISO `YYYY-MM-DD`, inclusive. Cadena vacía = sin límite. */
  desde: string;
  /** Fecha ISO `YYYY-MM-DD`, inclusive. Cadena vacía = sin límite. */
  hasta: string;
}

export const FILTROS_VACIOS: Filtros = {
  texto: "",
  estado: "",
  prioridad: "",
  origen: "",
  campana: "",
  municipio: "",
  cultivo: "",
  canal: "",
  desde: "",
  hasta: "",
};

export type CampoOrden =
  | "created_at"
  | "puntuacion"
  | "prioridad"
  | "estado"
  | "num_imagenes"
  | "respuesta"
  | "municipio"
  | "cultivo";

export type DireccionOrden = "asc" | "desc";

export interface Orden {
  campo: CampoOrden;
  dir: DireccionOrden;
}

/** Orden por defecto, el mismo que aplica el SQL del listado. */
export const ORDEN_POR_DEFECTO: Orden = { campo: "puntuacion", dir: "desc" };

const RANGO_PRIORIDAD: Record<PrioridadLead, number> = { alta: 3, media: 2, baja: 1 };

const RANGO_ESTADO: Record<string, number> = Object.fromEntries(
  ESTADOS_LEAD.map((estado, i) => [estado, i])
);

function normalizar(valor: string): string {
  return valor.trim().toLowerCase();
}

/**
 * Día del lead en UTC (`YYYY-MM-DD`).
 *
 * Se deriva en UTC a propósito para que coincida con la serie diaria del
 * servidor (`date_trunc('day', created_at)` sobre la sesión UTC) y para que las
 * pruebas sean deterministas.
 */
export function diaLead(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toISOString().slice(0, 10);
}

/**
 * Horas transcurridas entre la entrada del lead y su primera respuesta.
 * `null` mientras nadie lo ha respondido.
 */
export function horasRespuesta(lead: LeadFila): number | null {
  if (!lead.primera_response_at) return null;
  const entrada = new Date(lead.created_at).getTime();
  const respuesta = new Date(lead.primera_response_at).getTime();
  if (Number.isNaN(entrada) || Number.isNaN(respuesta)) return null;
  return (respuesta - entrada) / 3_600_000;
}

function campanaDe(lead: LeadFila): string {
  return lead.utm_campaign ?? lead.origen_campana ?? "";
}

/** ¿Hay algún filtro distinto del valor por defecto? */
export function hayFiltrosActivos(filtros: Filtros): boolean {
  return (Object.keys(FILTROS_VACIOS) as (keyof Filtros)[]).some(
    (clave) => filtros[clave] !== FILTROS_VACIOS[clave]
  );
}

export function aplicarFiltros(leads: LeadFila[], filtros: Filtros): LeadFila[] {
  const texto = normalizar(filtros.texto);
  const desde = filtros.desde;
  const hasta = filtros.hasta;

  return leads.filter((lead) => {
    if (filtros.estado && lead.estado !== filtros.estado) return false;
    if (filtros.prioridad && lead.prioridad !== filtros.prioridad) return false;
    if (filtros.origen && lead.origen !== filtros.origen) return false;
    if (filtros.municipio && lead.municipio !== filtros.municipio) return false;
    if (filtros.cultivo && lead.cultivo !== filtros.cultivo) return false;
    if (filtros.canal && lead.canal_contacto !== filtros.canal) return false;
    if (filtros.campana && campanaDe(lead) !== filtros.campana) return false;

    if (desde || hasta) {
      const dia = diaLead(lead.created_at);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
    }

    if (texto) {
      const heno = [
        lead.nombre,
        lead.telefono,
        lead.email,
        lead.municipio,
        lead.cultivo,
        lead.sintoma,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!heno.includes(texto)) return false;
    }

    return true;
  });
}

/**
 * ¿El campo de ordenación está ausente en este lead? Los ausentes (sin
 * municipio, sin cultivo, sin respuesta) van siempre al final, sin importar la
 * dirección: dejar filas vacías intercaladas dificultaría la lectura.
 */
function ordenAusente(lead: LeadFila, campo: CampoOrden): boolean {
  switch (campo) {
    case "municipio":
      return !lead.municipio?.trim();
    case "cultivo":
      return !lead.cultivo?.trim();
    case "respuesta":
      return horasRespuesta(lead) === null;
    default:
      return false;
  }
}

/** Compara dos leads con valores presentes por el campo pedido. */
function compararPresentes(a: LeadFila, b: LeadFila, campo: CampoOrden): number {
  switch (campo) {
    case "created_at":
      return a.created_at.localeCompare(b.created_at);
    case "puntuacion":
      return a.puntuacion - b.puntuacion;
    case "prioridad":
      return RANGO_PRIORIDAD[a.prioridad] - RANGO_PRIORIDAD[b.prioridad];
    case "estado":
      return (RANGO_ESTADO[a.estado] ?? 0) - (RANGO_ESTADO[b.estado] ?? 0);
    case "num_imagenes":
      return a.num_imagenes - b.num_imagenes;
    case "municipio":
      return (a.municipio ?? "").localeCompare(b.municipio ?? "", "es", { sensitivity: "base" });
    case "cultivo":
      return (a.cultivo ?? "").localeCompare(b.cultivo ?? "", "es", { sensitivity: "base" });
    case "respuesta": {
      const ha = horasRespuesta(a);
      const hb = horasRespuesta(b);
      if (ha === null && hb === null) return 0;
      if (ha === null) return 1;
      if (hb === null) return -1;
      return ha - hb;
    }
  }
}

export function ordenarLeads(leads: LeadFila[], orden: Orden): LeadFila[] {
  const signo = orden.dir === "asc" ? 1 : -1;
  // Copia antes de ordenar: ordenar in-place mutaría el array de estado.
  return leads.slice().sort((a, b) => {
    const ausenteA = ordenAusente(a, orden.campo);
    const ausenteB = ordenAusente(b, orden.campo);
    if (ausenteA || ausenteB) {
      if (ausenteA && ausenteB) return 0;
      return ausenteA ? 1 : -1;
    }
    const base = compararPresentes(a, b, orden.campo);
    if (base === 0) return 0;
    return base * signo;
  });
}

export interface Pagina<T> {
  items: T[];
  pagina: number;
  totalPaginas: number;
  total: number;
}

export function paginar<T>(items: T[], pagina: number, porPagina: number): Pagina<T> {
  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaActual = Math.min(Math.max(Math.trunc(pagina), 1), totalPaginas);
  const inicio = (paginaActual - 1) * porPagina;
  return {
    items: items.slice(inicio, inicio + porPagina),
    pagina: paginaActual,
    totalPaginas,
    total,
  };
}

/** Valores distintos no vacíos de un campo, ordenados alfabéticamente. */
export function opcionesUnicas(
  leads: LeadFila[],
  campo: "municipio" | "cultivo"
): string[] {
  const valores = new Set<string>();
  for (const lead of leads) {
    const valor = lead[campo]?.trim();
    if (valor) valores.add(valor);
  }
  return [...valores].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

/** Valores distintos de campaña (utm_campaign u origen_campana). */
export function campanasUnicas(leads: LeadFila[]): string[] {
  const valores = new Set<string>();
  for (const lead of leads) {
    const valor = campanaDe(lead).trim();
    if (valor) valores.add(valor);
  }
  return [...valores].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

const ETIQUETA_CANAL_COMERCIAL: Record<string, string> = {
  correo: "Correo",
  whatsapp: "WhatsApp",
};

/** `YYYY-MM-DD` (o ISO completo) a `dd/mm/aaaa`, sin depender de la zona. */
function fechaComercial(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}

/**
 * Resumen legible del consentimiento comercial de un lead para el panel.
 *
 * Devuelve una línea por canal autorizado y distingue el histórico inferido de
 * la app antigua. La lógica vive aquí, no en el JSX, para poder probarla.
 */
export function resumenComercial(lead: LeadFila): string[] {
  const lineas: string[] = [];

  if (lead.consentimiento_fuente === "legacy_inferido") {
    const canal =
      ETIQUETA_CANAL_COMERCIAL[lead.canal_comercial ?? ""] ?? "canal sin verificar";
    lineas.push(`Histórico: ${canal} (inferido, sin verificar)`);
  } else if (lead.consentimiento_fuente === "explicito") {
    for (const consentimiento of lead.consentimientos_comerciales) {
      if (consentimiento.revocado_en) continue;
      const canal =
        ETIQUETA_CANAL_COMERCIAL[consentimiento.canal] ?? consentimiento.canal;
      lineas.push(
        `${canal} · ${consentimiento.texto_version} · ${fechaComercial(consentimiento.aceptado_en)}`
      );
    }
  }

  if (lineas.length === 0) lineas.push("Sin consentimiento");
  if (lead.baja_comercial) lineas.push("BAJA (suprime todos los canales)");
  return lineas;
}
