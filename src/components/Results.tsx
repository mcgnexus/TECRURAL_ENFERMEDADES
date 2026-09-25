"use client";

import type { DiagnosticoWithMeta } from "@/types/diagnostico";

interface ResultsProps {
  diagnostico: DiagnosticoWithMeta;
  imagenPreview: string;
  onFeedback: (feedback: string) => void;
  onRetry: () => void;
  isLoading?: boolean;
}

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

const badgeBase = "inline-flex items-center px-2.5 py-0.5 rounded-full text-[var(--tr-text-caption)] font-semibold font-[var(--tr-font-body)]";

const badgeBlue = `${badgeBase} bg-tr-cyan/15 text-tr-cyan`;
const badgePurple = `${badgeBase} bg-purple-100 text-purple-800`;
const badgeGreen = `${badgeBase} bg-tr-lime text-tr-forest`;
const badgeYellow = `${badgeBase} bg-tr-warning/15 text-tr-warning`;
const badgeRed = `${badgeBase} bg-red-100 text-red-800`;
const badgeSecondary = `${badgeBase} bg-tr-paper text-tr-ink border border-tr-line`;
const badgeModel = `${badgeBase} bg-tr-cyan/15 text-tr-cyan`;

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-[var(--tr-focus)]";

const btnPrimary = `${btnBase} bg-tr-brand-green text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;

const SEVERITY_CLASSES = {
  leve: badgeGreen,
  moderada: badgeYellow,
  severa: badgeRed,
};

const CONFIDENCE_CLASSES = (conf: number) =>
  conf >= 0.7 ? badgeGreen : conf >= 0.4 ? badgeYellow : badgeRed;

export function Results({
  diagnostico,
  imagenPreview,
  onFeedback,
  onRetry,
  isLoading = false,
}: ResultsProps) {
  const {
    diagnostico: diag,
    estado_madurez,
    organo_detectado,
    especie_identificada,
    confianza_identificacion,
    recomendacion,
    requiere_experto,
  } = diagnostico;

  const showFeedback = () => {
    const feedback = prompt("¿Qué corregirías del diagnóstico? (opcional)");
    if (feedback !== null) {
      onFeedback(feedback);
    }
  };

  return (
    <div className="space-y-5" role="region" aria-label="Resultados del diagnóstico">
      <div className="relative aspect-[4/3] rounded-[var(--tr-radius-card)] overflow-hidden border border-tr-line">
        <img
          src={imagenPreview}
          alt="Foto analizada"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="text-white text-small font-medium truncate font-body">
            {ORGANO_LABELS[organo_detectado] || organo_detectado} - {especie_identificada}
          </p>
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-2 p-4 ${cardStyles}`}>
        <span className={badgeBlue}>
          Órgano: {ORGANO_LABELS[organo_detectado] || organo_detectado}
        </span>
        <span className={badgePurple}>
          Especie: {especie_identificada}
        </span>
        {diagnostico.nombre_planta && (
          <span className={badgeSecondary}>
            Planta indicada: {diagnostico.nombre_planta}
          </span>
        )}
        <span className={CONFIDENCE_CLASSES(confianza_identificacion)}>
          Confianza ID: {Math.round(confianza_identificacion * 100)}%
        </span>
        {diagnostico.proveedor_usado && (
          <span className={badgeModel}>
            Modelo: {diagnostico.proveedor_usado === "gemini" ? "Gemini 2.5 Flash" : "DeepSeek Chat"}
          </span>
        )}
      </div>

      <div className={`p-5 border-l-4 ${cardStyles} ${
        diag.gravedad === "leve" ? "border-tr-brand-green" :
        diag.gravedad === "moderada" ? "border-tr-warning" :
        "border-red-500"
      }`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 text-tr-brand-green">{GRAVEDAD_ICONS[diag.gravedad]}</div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading font-semibold text-tr-forest capitalize">{TIPO_LABELS[diag.tipo] || diag.tipo}</span>
              <span className={badgeSecondary}>{diag.nombre}</span>
              <span className={CONFIDENCE_CLASSES(diag.confianza)}>
                Confianza: {Math.round(diag.confianza * 100)}%
              </span>
              <span className={SEVERITY_CLASSES[diag.gravedad as keyof typeof SEVERITY_CLASSES] || badgeSecondary}>
                {diag.gravedad.charAt(0).toUpperCase() + diag.gravedad.slice(1)}
              </span>
            </div>
            <p className="mt-3 text-body text-tr-ink leading-relaxed">{recomendacion}</p>

            {diag.sintomas_observados.length > 0 && (
              <div className="mt-4">
                <p className="font-body font-semibold text-tr-forest text-small">Síntomas observados</p>
                <ul className="mt-2 space-y-2" role="list">
                  {diag.sintomas_observados.map((sintoma, i) => (
                    <li key={i} className="text-body text-tr-muted flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
                      <span>{sintoma}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {estado_madurez.aplica && (
        <div className={`${cardStyles} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-tr-forest">Estado de madurez</h3>
            <span className={badgeSecondary}>{estado_madurez.estado}</span>
          </div>
          <div className="w-full bg-tr-line rounded-full h-2.5">
            <div
              className="bg-tr-brand-green h-2.5 rounded-full transition-all duration-500"
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
          <p className="mt-2 text-small text-tr-muted">
            {estado_madurez.dias_estimados_cosecha > 0
              ? `~${estado_madurez.dias_estimados_cosecha} días para cosecha`
              : "Cosecha inminente o no estimable"}
          </p>
        </div>
      )}

      {requiere_experto && (
        <div className={`${cardStyles} p-5 border-l-4 border-tr-warning bg-tr-warning/5`}>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-tr-warning flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-heading font-semibold text-tr-forest">Se recomienda validación experta</p>
              <p className="mt-1 text-body text-tr-muted">
                La confianza es baja. Considera tomar otra foto (envés de hoja, detalle de síntoma, planta completa) o consultar a un técnico agronómico.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={showFeedback}
          disabled={isLoading}
          type="button"
          className={`${btnSecondary} flex-1`}
        >
          Esto no es correcto
        </button>
        <button
          onClick={onRetry}
          disabled={isLoading}
          type="button"
          className={`${btnPrimary} flex-1`}
        >
          Nueva análisis
        </button>
      </div>
    </div>
  );
}