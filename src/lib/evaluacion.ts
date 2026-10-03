/**
 * Lógica pura de la evaluación agronómica: qué cuenta como acuerdo, cómo se
 * resume por cultivo/tipo y cómo se agrupa la confianza en tramos para ver si
 * está calibrada. Sin E/S para poder probarla sin proveedores ni ficheros.
 */

export interface RespuestaEvaluable {
  diagnostico: { tipo: string; nombre: string; confianza?: number };
  confianza_identificacion?: number;
  requiere_experto?: boolean;
}

export interface CasoEvaluable {
  id: string;
  cultivo?: string;
  sintoma?: string;
  esperado?: {
    tipo?: "enfermedad" | "deficiencia_nutricional" | "plaga" | "sano";
    categoriaAceptable?: string[];
    requiereExperto?: boolean;
    nota?: string;
  };
}

export interface ResultadoCaso {
  casoId: string;
  cultivo: string;
  sintoma: string;
  tipoEsperado: string | undefined;
  tipoObtenido: string;
  nombreObtenido: string;
  requiereEsperado: boolean | undefined;
  requiereObtenido: boolean;
  acuerdo: boolean;
  confianza: number | undefined;
  error?: string;
}

/** Criterio de acuerdo: tipo exacto + nombre dentro de las categorías
 * aceptables + `requiere_experto` coincidente (si el técnico lo definió). */
export function acierta(
  caso: CasoEvaluable,
  respuesta: RespuestaEvaluable
): boolean {
  const esperado = caso.esperado;
  if (!esperado) return false;
  if (esperado.tipo && respuesta.diagnostico.tipo !== esperado.tipo) return false;
  if (esperado.categoriaAceptable?.length) {
    const nombre = respuesta.diagnostico.nombre.toLowerCase();
    if (!esperado.categoriaAceptable.some((c) => nombre.includes(c.toLowerCase()))) {
      return false;
    }
  }
  if (
    esperado.requiereExperto !== undefined &&
    Boolean(respuesta.requiere_experto) !== esperado.requiereExperto
  ) {
    return false;
  }
  return true;
}

/** Tramos de confianza para juzgar calibración. En cada tramo importa la tasa
 * de acuerdo: si los casos con confianza alta no acuerdan más que los de baja,
 * el número no significa nada y los umbrales de route.ts (0.3/0.4/0.6) están
 * ajustados a ojo. */
export const TRAMOS_CONFIANZA = [
  { etiqueta: "0.0-0.4", min: 0, max: 0.4 },
  { etiqueta: "0.4-0.6", min: 0.4, max: 0.6 },
  { etiqueta: "0.6-0.8", min: 0.6, max: 0.8 },
  { etiqueta: "0.8-1.0", min: 0.8, max: 1.01 },
] as const;

function tramoDe(confianza: number | undefined): string | undefined {
  if (confianza === undefined || Number.isNaN(confianza)) return undefined;
  const tramo = TRAMOS_CONFIANZA.find((t) => confianza >= t.min && confianza < t.max);
  return tramo?.etiqueta;
}

export interface GrupoResumen {
  clave: string;
  total: number;
  acuerdos: number;
}

export interface BalanceExperto {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

export interface ResumenEvaluacion {
  total: number;
  acuerdos: number;
  porCultivo: GrupoResumen[];
  porTipoEsperado: GrupoResumen[];
  calibracion: Array<{ tramo: string; casos: number; acuerdos: number }>;
  requiereExperto: BalanceExperto;
}

export function resumirEvaluacion(resultados: ResultadoCaso[]): ResumenEvaluacion {
  const conResultado = resultados.filter((r) => !r.error);
  const acuerdos = conResultado.filter((r) => r.acuerdo).length;

  const agrupar = (claveDe: (r: ResultadoCaso) => string): GrupoResumen[] => {
    const mapa = new Map<string, GrupoResumen>();
    for (const r of conResultado) {
      const clave = claveDe(r);
      const g = mapa.get(clave) ?? { clave, total: 0, acuerdos: 0 };
      g.total++;
      if (r.acuerdo) g.acuerdos++;
      mapa.set(clave, g);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  };

  const calibracion = TRAMOS_CONFIANZA.map(({ etiqueta }) => {
    const delTramo = conResultado.filter((r) => tramoDe(r.confianza) === etiqueta);
    return {
      tramo: etiqueta,
      casos: delTramo.length,
      acuerdos: delTramo.filter((r) => r.acuerdo).length,
    };
  });

  const requiereExperto: BalanceExperto = { tp: 0, tn: 0, fp: 0, fn: 0 };
  for (const r of conResultado) {
    if (r.requiereEsperado === undefined) continue;
    if (r.requiereEsperado && r.requiereObtenido) requiereExperto.tp++;
    else if (!r.requiereEsperado && !r.requiereObtenido) requiereExperto.tn++;
    else if (!r.requiereEsperado && r.requiereObtenido) requiereExperto.fp++;
    else requiereExperto.fn++;
  }

  return {
    total: conResultado.length,
    acuerdos,
    porCultivo: agrupar((r) => r.cultivo || "sin cultivo"),
    porTipoEsperado: agrupar((r) => r.tipoEsperado || "sin esperado"),
    calibracion,
    requiereExperto,
  };
}

/** Fila de resultado a partir del caso y la respuesta (o el error de la llamada). */
export function resultadoDe(
  caso: CasoEvaluable,
  respuesta?: RespuestaEvaluable,
  error?: string
): ResultadoCaso {
  if (!respuesta || error) {
    return {
      casoId: caso.id,
      cultivo: caso.cultivo ?? "",
      sintoma: caso.sintoma ?? "",
      tipoEsperado: caso.esperado?.tipo,
      tipoObtenido: "",
      nombreObtenido: "",
      requiereEsperado: caso.esperado?.requiereExperto,
      requiereObtenido: false,
      acuerdo: false,
      confianza: undefined,
      error: error ?? "sin respuesta",
    };
  }
  return {
    casoId: caso.id,
    cultivo: caso.cultivo ?? "",
    sintoma: caso.sintoma ?? "",
    tipoEsperado: caso.esperado?.tipo,
    tipoObtenido: respuesta.diagnostico.tipo,
    nombreObtenido: respuesta.diagnostico.nombre,
    requiereEsperado: caso.esperado?.requiereExperto,
    requiereObtenido: Boolean(respuesta.requiere_experto),
    acuerdo: acierta(caso, respuesta),
    confianza: respuesta.diagnostico.confianza,
  };
}
