/**
 * Listas de ayuda para los selectores, orientadas a la zona de trabajo de
 * TecRural (Altiplano de Granada y Costa Tropical). Son ayudas de selección:
 * el usuario siempre puede elegir "Otro" y escribir un valor libre.
 */

export const MUNICIPIOS_POR_COMARCA: Record<string, string[]> = {
  "Altiplano de Granada": [
    "Baza",
    "Benamaurel",
    "Caniles",
    "Castril",
    "Castilléjar",
    "Cortes de Baza",
    "Cuevas del Campo",
    "Cúllar",
    "Freila",
    "Galera",
    "Huéscar",
    "Puebla de Don Fadrique",
    "Zújar",
  ],
  "Costa Tropical": [
    "Albondón",
    "Albuñol",
    "Almuñécar",
    "Gualchos",
    "Itrabo",
    "Jete",
    "Lentegí",
    "Lújar",
    "Molvízar",
    "Motril",
    "Otívar",
    "Polopos",
    "Rubite",
    "Salobreña",
    "Sorvilán",
    "Vélez de Benaudalla",
  ],
};

export const MUNICIPIOS_ZONA: string[] = Object.values(MUNICIPIOS_POR_COMARCA).flat();

export const CULTIVOS_FRECUENTES: string[] = [
  "Olivo",
  "Almendro",
  "Cítricos (naranjo, limonero, mandarino)",
  "Vid",
  "Tomate",
  "Pimiento",
  "Berenjena",
  "Calabacín",
  "Lechuga",
  "Aguacate",
  "Chirimoyo",
  "Mango",
  "Níspero",
  "Cereal",
];

export const SINTOMAS_FRECUENTES: string[] = [
  "Manchas en hojas o frutos",
  "Amarilleo (hojas amarillas)",
  "Marchitez o decaimiento",
  "Deformación de hojas o frutos",
  "Insectos o plagas visibles",
  "Caída de hojas o flores",
  "Otro / no lo sé",
];

export const DURACIONES: string[] = [
  "Hoy, acaba de aparecer",
  "Desde hace unos días",
  "Desde hace semanas",
  "Desde hace meses",
  "No lo sé",
];
