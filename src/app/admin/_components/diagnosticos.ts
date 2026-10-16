import type { DiagnosticoPanelFila } from "@/types/diagnostico";
import { diaLead } from "./filtros";

/**
 * Lógica pura de la pestaña de diagnósticos: filtros, ordenación y extracción
 * del resultado de cada análisis.
 *
 * Vive aparte de los componentes para probarse sin navegador, igual que
 * `filtros.ts` hace con los leads.
 */

export const FILTROS_DIAG_VACIOS = {
  texto: "",
  tipo: "",
  gravedad: "",
  proveedor: "",
  requiereExperto: "" as boolean | "",
  conFeedback: "" as boolean | "",
  desde: "",
  hasta: "",
};

export type FiltrosDiag = typeof FILTROS_DIAG_VACIOS;

export type CampoOrdenDiag = "created_at" | "confianza" | "gravedad" | "tipo";

export interface OrdenDiag {
  campo: CampoOrdenDiag;
  dir: "asc" | "desc";
}

export const ORDEN_DIAG_POR_DEFECTO: OrdenDiag = { campo: "created_at", dir: "desc" };

const RANGO_GRAVEDAD: Record<string, number> = { severa: 3, moderada: 2, leve: 1 };

/** Resultado legible de un diagnóstico, extraído del JSONB. */
export interface ResultadoDiagnostico {
  tipo: string | null;
  nombre: string | null;
  gravedad: string | null;
  confianza: number | null;
  sintomas: string[];
  recomendacion: string | null;
  requiere_experto: boolean;
  diferenciales: { nombre: string; confianza: number | null; por_que_descartado: string }[];
  hallazgos_negativos: string[];
  datos_faltantes: string[];
  /** true si la fila existe pero su JSONB no se pudo leer: no se oculta el error. */
  ilegible: boolean;
}

const RESULTADO_VACIO: ResultadoDiagnostico = {
  tipo: null,
  nombre: null,
  gravedad: null,
  confianza: null,
  sintomas: [],
  recomendacion: null,
  requiere_experto: false,
  diferenciales: [],
  hallazgos_negativos: [],
  datos_faltantes: [],
  ilegible: false,
};

function lista(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((v): v is string => typeof v === "string")
    : [];
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;
}

function numero(valor: unknown): number | null {
  // `Number(null)` es 0 y `Number("")` también: sin esta guarda, un campo sin
  // confianza aparecería como 0 % y no como sin dato.
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Extrae el resultado de `diagnostico_json`. Nunca lanza: una fila mala no tumba la tabla. */
export function resultadoDe(fila: DiagnosticoPanelFila): ResultadoDiagnostico {
  const diag = fila.diagnostico;
  if (!diag || typeof diag !== "object") {
    return { ...RESULTADO_VACIO, ilegible: true };
  }

  // El JSONB real puede venir incompleto aunque el tipo lo declare obligatorio,
  // así que `diag.diagnostico` se lee como opcional a propósito.
  const d = diag.diagnostico;
  const diferenciales = diag.diagnosticos_diferenciales;

  return {
    tipo: texto(d?.tipo),
    nombre: texto(d?.nombre),
    gravedad: texto(d?.gravedad),
    confianza: numero(d?.confianza),
    sintomas: lista(d?.sintomas_observados),
    recomendacion: texto(diag.recomendacion),
    requiere_experto: Boolean(diag.requiere_experto),
    diferenciales: Array.isArray(diferenciales)
      ? diferenciales
          .map((e) => ({
            nombre: texto(e?.nombre) ?? "?",
            confianza: numero(e?.confianza),
            por_que_descartado: texto(e?.por_que_descartado) ?? "",
          }))
          .filter((e) => e.nombre !== "?")
      : [],
    hallazgos_negativos: lista(diag.hallazgos_negativos),
    datos_faltantes: lista(diag.datos_faltantes),
    ilegible: false,
  };
}

function cadenasDe(fila: DiagnosticoPanelFila): string[] {
  const r = resultadoDe(fila);
  const contexto = fila.contexto_usuario ?? {};
  return [
    fila.especie,
    fila.nombre_planta,
    fila.organo,
    fila.proveedor,
    r.tipo,
    r.nombre,
    r.gravedad,
    r.recomendacion,
    contexto.cultivo,
    contexto.municipio,
    contexto.sintoma,
    contexto.variedad,
    fila.feedback_usuario,
    ...r.sintomas,
  ].filter((v): v is string => typeof v === "string");
}

export function aplicarFiltrosDiag(
  items: DiagnosticoPanelFila[],
  filtros: FiltrosDiag
): DiagnosticoPanelFila[] {
  const textoBuscado = filtros.texto.trim().toLowerCase();

  return items.filter((fila) => {
    const r = resultadoDe(fila);

    if (filtros.tipo && (r.tipo ?? "") !== filtros.tipo) return false;
    if (filtros.gravedad && (r.gravedad ?? "") !== filtros.gravedad) return false;
    if (filtros.proveedor && (fila.proveedor ?? "") !== filtros.proveedor) return false;

    if (filtros.requiereExperto !== "") {
      if (r.requiere_experto !== filtros.requiereExperto) return false;
    }
    if (filtros.conFeedback !== "") {
      const tiene = Boolean(fila.feedback_usuario?.trim());
      if (tiene !== filtros.conFeedback) return false;
    }

    if (filtros.desde || filtros.hasta) {
      const dia = diaLead(fila.created_at);
      if (filtros.desde && dia < filtros.desde) return false;
      if (filtros.hasta && dia > filtros.hasta) return false;
    }

    if (textoBuscado) {
      const heno = cadenasDe(fila).join(" ").toLowerCase();
      if (!heno.includes(textoBuscado)) return false;
    }

    return true;
  });
}

function compararPresentes(a: DiagnosticoPanelFila, b: DiagnosticoPanelFila, campo: CampoOrdenDiag): number {
  const ra = resultadoDe(a);
  const rb = resultadoDe(b);
  switch (campo) {
    case "created_at":
      return a.created_at.localeCompare(b.created_at);
    case "tipo":
      return (ra.tipo ?? "").localeCompare(rb.tipo ?? "", "es", { sensitivity: "base" });
    case "confianza": {
      const ha = ra.confianza;
      const hb = rb.confianza;
      if (ha === null && hb === null) return 0;
      if (ha === null) return 1;
      if (hb === null) return -1;
      return ha - hb;
    }
    case "gravedad":
      return (RANGO_GRAVEDAD[ra.gravedad ?? ""] ?? 0) - (RANGO_GRAVEDAD[rb.gravedad ?? ""] ?? 0);
  }
}

function ausente(fila: DiagnosticoPanelFila, campo: CampoOrdenDiag): boolean {
  const r = resultadoDe(fila);
  switch (campo) {
    case "confianza":
      return r.confianza === null;
    case "gravedad":
      return r.gravedad === null;
    case "tipo":
      return r.tipo === null;
    default:
      return false;
  }
}

export function ordenarDiagnosticos(items: DiagnosticoPanelFila[], orden: OrdenDiag): DiagnosticoPanelFila[] {
  const signo = orden.dir === "asc" ? 1 : -1;
  return items.slice().sort((a, b) => {
    const aAusente = ausente(a, orden.campo);
    const bAusente = ausente(b, orden.campo);
    if (aAusente || bAusente) {
      if (aAusente && bAusente) return 0;
      return aAusente ? 1 : -1;
    }
    const base = compararPresentes(a, b, orden.campo);
    return base === 0 ? 0 : base * signo;
  });
}

export function opcionesDiag(items: DiagnosticoPanelFila[]): {
  tipo: string[];
  gravedad: string[];
  proveedor: string[];
} {
  const tipos = new Set<string>();
  const gravedades = new Set<string>();
  const proveedores = new Set<string>();
  for (const fila of items) {
    const r = resultadoDe(fila);
    if (r.tipo) tipos.add(r.tipo);
    if (r.gravedad) gravedades.add(r.gravedad);
    if (fila.proveedor?.trim()) proveedores.add(fila.proveedor.trim());
  }
  const ordenar = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  return { tipo: ordenar(tipos), gravedad: ordenar(gravedades), proveedor: ordenar(proveedores) };
}

export function hayFiltrosDiagActivos(filtros: FiltrosDiag): boolean {
  return (Object.keys(FILTROS_DIAG_VACIOS) as (keyof FiltrosDiag)[]).some(
    (clave) => filtros[clave] !== FILTROS_DIAG_VACIOS[clave]
  );
}

/** `confianza` se guarda en 0–1 y se lee como porcentaje. */
export function confianzaPct(confianza: number | null): string {
  return confianza === null ? "—" : `${(confianza * 100).toFixed(0)} %`;
}

/** Nivel cualitativo, sin porcentajes de confianza no calibrados. */
export function nivelSenalDiag(confianza: number | null): "claras" | "moderadas" | "pocas" | null {
  if (confianza === null) return null;
  if (confianza >= 0.7) return "claras";
  if (confianza >= 0.4) return "moderadas";
  return "pocas";
}
