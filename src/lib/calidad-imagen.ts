import type { DiagnosticoResponse } from "@/types/diagnostico";
import type { Observacion } from "./system-prompt";

/**
 * El modelo de diagnóstico no emite `calidad_imagen` (su esquema no la
 * incluye); la emite la fase de observación. Antes este vacío hacía que
 * `requiereExpertoPorValidacion` y `notaCalidadImagen` (route.ts) nunca
 * entraran en vigor: la calidad de la foto quedaba sin evaluar en la
 * decisión de derivar a técnico.
 */
export function propagarCalidadImagen(
  diagnostico: DiagnosticoResponse,
  observacion: Observacion | undefined
): void {
  if (!observacion?.calidad_imagen) return;
  diagnostico.calidad_imagen = observacion.calidad_imagen;
}

/** Nota para el usuario cuando la foto limita la orientación. Sin porcentajes
 * ni jerga: es el texto que da el aviso de que la imagen arrastraba defectos.
 * Devuelve "" si no hay nada reseñable, para no contaminar la recomendación. */
export function sugerenciaPorCalidad(
  observacion: Observacion | undefined
): string {
  const calidad = observacion?.calidad_imagen;
  if (!calidad) return "";

  const consejos: string[] = [];
  if (calidad.nitidez !== "alta") consejos.push("una foto más nítida");
  if (calidad.encuadre !== "adecuado") consejos.push("el síntoma bien encuadrado");
  if (calidad.iluminacion !== "adecuada") consejos.push("otra hora de luz natural");

  if (consejos.length === 0) return "";
  return ` Para afinar más, intenta ${consejos.join(" y ")}.`;
}
