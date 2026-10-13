const GENERICOS = new Set([
  "manchas", "color raro", "extraño", "raro", "malo", "enfermo",
  "amarillo", "marron", "negro", "blanco", "verde", "seco", "marchito",
  "mancha", "punto", "rayas", "lineas", "zonas", "areas",
]);

export function sanitizarSintomas(sintomas: string[]): string[] {
  return sintomas
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !GENERICOS.has(s.toLowerCase()))
    .filter((s, i, arr) => arr.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i)
    .slice(0, 8);
}
