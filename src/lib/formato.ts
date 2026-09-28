/**
 * Utilidades de presentación de un diagnóstico, compartidas entre la vista de
 * resultado y el historial.
 */

export const TIPO_LABELS: Record<string, string> = {
  enfermedad: "Enfermedad",
  deficiencia_nutricional: "Deficiencia nutricional",
  plaga: "Plaga",
  sano: "Sin síntomas claros",
};

export const GRAVEDAD_LABELS: Record<string, string> = {
  leve: "Leve",
  moderada: "Moderada",
  severa: "Severa",
};

export const ORGANO_LABELS: Record<string, string> = {
  hoja: "Hoja",
  flor: "Flor",
  fruto: "Fruto",
  tallo: "Tallo",
  planta_completa: "Planta completa",
};

/** Etiquetas por tramo de confianza. Es la unica representacion de la
 * confianza que ve el agricultor: la confianza del modelo no esta calibrada
 * contra casos confirmados por un tecnico, asi que un porcentaje daria una
 * precision que no existe. */
export const NIVELES_SENAL = [
  { minimo: 0.7, label: "Señales claras", ayuda: "La foto muestra señales consistentes con esta hipótesis." },
  { minimo: 0.4, label: "Indicios moderados", ayuda: "Hay indicios, pero harían falta más datos o fotos para afinar." },
  { minimo: 0, label: "Señales poco claras", ayuda: "La foto no aporta suficiente evidencia: tómala como orientación muy preliminar." },
] as const;

export function nivelSenal(confianza: number | undefined) {
  const valor = typeof confianza === "number" && Number.isFinite(confianza) ? confianza : 0;
  return NIVELES_SENAL.find((n) => valor >= n.minimo) ?? NIVELES_SENAL[NIVELES_SENAL.length - 1];
}

/** Prefijos divulgativos que el modelo añade al nombre del diagnóstico. */
const PREFIJOS_HIPOTESIS = [
  /^síntomas compatibles con\s*/i,
  /^sintomas compatibles con\s*/i,
  /^patrón típico de\s*/i,
  /^patron tipico de\s*/i,
  /^compatible con un(?:a)?\s*/i,
  /^compatible con\s*/i,
  /^posible\s*/i,
  /^probable\s*/i,
  /^sugiere\s*/i,
  /^indicios de\s*/i,
  /^apariencia de\s*/i,
];

/**
 * Limpia el prefijo divulgativo ("compatible con", "síntomas compatibles
 * con"...) para obtener una etiqueta corta y escaneable de un vistazo. Si no
 * reconoce ningún prefijo conocido, devuelve el nombre normalizado.
 */
export function nombreCorto(nombre: string | undefined | null): string {
  const limpio = (nombre ?? "").trim().replace(/[.\s]+$/, "");
  if (!limpio) return "";
  for (const patron of PREFIJOS_HIPOTESIS) {
    if (patron.test(limpio)) {
      const resto = limpio.replace(patron, "").trim();
      if (resto.length > 0) {
        return capitalizar(resto);
      }
    }
  }
  return capitalizar(limpio);
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
