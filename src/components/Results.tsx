"use client";

import type { DiagnosticoResponse } from "@/types/diagnostico";

interface ResultsProps {
  diagnostico: DiagnosticoResponse;
  imagenPreview: string;
  onFeedback: (feedback: string) => void;
  onRetry: () => void;
  isLoading?: boolean;
}

const GRAVEDAD_COLORS = {
  leve: "bg-green-100 text-green-800 border-green-200",
  moderada: "bg-yellow-100 text-yellow-800 border-yellow-200",
  severa: "bg-red-100 text-red-800 border-red-200",
};

const GRAVEDAD_ICONS = {
  leve: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  moderada: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  severa: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  ),
};

const TIPO_LABELS: Record<string, string> = {
  enfermedad: "Enfermedad",
  deficiencia_nutricional: "Deficiencia nutricional",
  plaga: "Plaga",
  sano: "Sano",
};

const ORGANO_LABELS: Record<string, string> = {
  hoja: "Hoja",
  flor: "Flor",
  fruto: "Fruto",
  tallo: "Tallo",
  planta_completa: "Planta completa",
};

export function Results({
  diagnostico,
  imagenPreview,
  onFeedback,
  onRetry,
  isLoading = false,
}: ResultsProps) {
  const { diagnostico: diag, estado_madurez, organo_detectado, especie_identificada, confianza_identificacion, recomendacion, requiere_experto } = diagnostico;

  const showFeedback = () => {
    const feedback = prompt("¿Qué corregirías del diagnóstico? (opcional)");
    if (feedback !== null) {
      onFeedback(feedback);
    }
  };

  return (
    <div className="space-y-6" role="region" aria-label="Resultados del diagnóstico">
      <div className="relative aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden">
        <img
          src={imagenPreview}
          alt="Foto analizada"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="text-white text-sm font-medium truncate">
            {ORGANO_LABELS[organo_detectado] || organo_detectado} - {especie_identificada}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
        <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
          Órgano: {ORGANO_LABELS[organo_detectado] || organo_detectado}
        </span>
        <span className="px-3 py-1 text-sm font-medium bg-purple-100 text-purple-800 rounded-full">
          Especie: {especie_identificada}
        </span>
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
          confianza_identificacion >= 0.7 ? "bg-green-100 text-green-800" :
          confianza_identificacion >= 0.4 ? "bg-yellow-100 text-yellow-800" :
          "bg-red-100 text-red-800"
        }`}>
          Confianza ID: {Math.round(confianza_identificacion * 100)}%
        </span>
      </div>

      <div className={`p-4 rounded-xl border ${GRAVEDAD_COLORS[diag.gravedad]}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{GRAVEDAD_ICONS[diag.gravedad]}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold capitalize">{TIPO_LABELS[diag.tipo] || diag.tipo}</span>
              <span className="px-2 py-0.5 text-xs font-medium bg-white/50 rounded">
                {diag.nombre}
              </span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                diag.confianza >= 0.7 ? "bg-green-100 text-green-800" :
                diag.confianza >= 0.4 ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }`}>
                Confianza: {Math.round(diag.confianza * 100)}%
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-700">{recomendacion}</p>
            
            {diag.sintomas_observados.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700">Síntomas observados:</p>
                <ul className="mt-1 space-y-1">
                  {diag.sintomas_observados.map((sintoma, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-current mt-1.5" />
                      {sintoma}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {estado_madurez.aplica && (
        <div className="p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900">Estado de madurez</h3>
            <span className="text-sm text-gray-600">{estado_madurez.estado}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, (1 - (estado_madurez.dias_estimados_cosecha / 60)) * 100))}%`,
              }}
              role="progressbar"
              aria-valuenow={Math.min(100, Math.max(0, (1 - (estado_madurez.dias_estimados_cosecha / 60)) * 100))}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso hacia cosecha"
            />
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {estado_madurez.dias_estimados_cosecha > 0
              ? `~${estado_madurez.dias_estimados_cosecha} días para cosecha`
              : "Cosecha inminente o no estimable"}
          </p>
        </div>
      )}

      {requiere_experto && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium text-amber-900">Se recomienda validación experta</p>
              <p className="text-sm text-amber-800 mt-1">
                La confianza es baja. Considera tomar otra foto (envés de hoja, detalle de síntoma, planta completa) o consultar a un técnico agronómico.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={showFeedback}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Esto no es correcto
        </button>
        <button
          onClick={onRetry}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          Nueva análisis
        </button>
      </div>
    </div>
  );
}