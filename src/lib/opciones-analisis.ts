export type FaseAnalisis = "observacion" | "hipotesis" | "verificacion" | "reintento" | "proveedor_alternativo";

export interface OpcionesAnalisis {
  deadlineAt: number;
  onPhase?: (phase: FaseAnalisis) => void;
}

export function tiempoRestanteMs(opciones?: OpcionesAnalisis): number {
  return opciones ? Math.max(0, opciones.deadlineAt - Date.now()) : Number.POSITIVE_INFINITY;
}
