/**
 * Detección de síntomas declarados en los que la cara inferior de la hoja
 * (envés) es clave: ácaros, cochinillas y esporulaciones viven ahí, y sin esa
 * foto el análisis se queda a medias. Utilidad pura para poder probarla sin
 * montar el componente.
 */
const INDICIOS_ENVES = [
  "araña",
  "acaro",
  "ácaro",
  "cochinilla",
  "pulgón",
  "pulgon",
  "insecto",
  "plaga",
  "mosca",
  "minador",
  "oruga",
  "trips",
  "moho",
  "mildiu",
  "oidio",
  "oídio",
  "polvillo",
  "esporas",
  "mancha",
  "polvo en el envés",
  "debajo de la hoja",
  "cara inferior",
  "envés",
  "enves",
];

/** Acepta el valor del select y, si procede, el texto libre de "Otro". */
export function debeSugerirEnves(
  sintoma: string | undefined | null,
  sintomaOtro?: string
): boolean {
  const limpio = `${sintoma ?? ""} ${sintomaOtro ?? ""}`.toLowerCase();
  return INDICIOS_ENVES.some((indicio) => limpio.includes(indicio));
}
