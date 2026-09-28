"use client";

import { useState } from "react";
import Link from "next/link";
import type { DiagnosticoWithMeta, ContextoUsuario } from "@/types/diagnostico";
import { debeOfrecerRevision } from "@/lib/leads";
import { LeadForm } from "@/components/LeadForm";
import { urlWhatsApp, whatsappDisponible } from "@/lib/contacto";
import { trackEvento } from "@/lib/analitica";
import type { ContextoDiagnosticoLead } from "@/types/lead";
import {
  ORGANO_LABELS,
  TIPO_LABELS,
  GRAVEDAD_LABELS,
  nombreCorto,
  porcentajeConfianza,
} from "@/lib/formato";

interface ResultsProps {
  diagnostico: DiagnosticoWithMeta;
  imagenPreview: string;
  /** Fotos comprimidas como data URL completo (WebP o JPEG) para adjuntar a la revisión */
  fotosDataUrl?: string[];
  contextoUsuario?: ContextoUsuario;
  onRetry: () => void;
  isLoading?: boolean;
}

const badgeBase = "inline-flex items-center px-2.5 py-0.5 rounded-full text-[var(--tr-text-caption)] font-semibold font-[var(--tr-font-body)]";

const badgeBlue = `${badgeBase} bg-tr-cyan/15 text-tr-cyan-text`;
const badgeGreen = `${badgeBase} bg-tr-lime text-tr-forest`;
const badgeYellow = `${badgeBase} bg-tr-warning/15 text-tr-warning-text`;
const badgeRed = `${badgeBase} bg-red-100 text-red-800`;
const badgeSecondary = `${badgeBase} bg-tr-paper text-tr-ink border border-tr-line`;
const badgeEspecie = `${badgeBase} bg-tr-leaf/15 text-tr-leaf-text`;

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 ";

const btnPrimary = `${btnBase} bg-tr-green-strong text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;

/** Nivel cualitativo de la confianza. El porcentaje acompaña siempre a la
 * etiqueta para que el agricultor pueda valorar de un vistazo el grado de
 * seguridad, sin tomarlo como una certeza. */
function nivelSenal(conf: number): { label: string; badge: string; ayuda: string } {
  if (conf >= 0.7) return { label: "Señales claras", badge: badgeGreen, ayuda: "La foto muestra señales consistentes con esta hipótesis." };
  if (conf >= 0.4) return { label: "Indicios moderados", badge: badgeYellow, ayuda: "Hay indicios, pero harían falta más datos o fotos para afinar." };
  return { label: "Señales poco claras", badge: badgeRed, ayuda: "La foto no aporta suficiente evidencia: tómala como orientación muy preliminar." };
}

/** Subrayado de resalte para los puntos clave que el agricultor debe leer. */
function clave(texto: string) {
  return (
    <span className="font-semibold text-tr-ink underline decoration-tr-lime decoration-2 underline-offset-4">
      {texto}
    </span>
  );
}

function seccion(titulo: string, children: React.ReactNode) {
  return (
    <div className={`p-5 ${cardStyles}`}>
      <h3 className="font-heading font-semibold text-tr-forest mb-2">{titulo}</h3>
      {children}
    </div>
  );
}

export function Results({
  diagnostico,
  imagenPreview,
  fotosDataUrl,
  contextoUsuario,
  onRetry,
  isLoading = false,
}: ResultsProps) {
  const {
    diagnostico: diag,
    estado_madurez,
    organo_detectado,
    especie_identificada,
    recomendacion,
    requiere_experto,
    datos_faltantes,
    diagnosticos_diferenciales,
  } = diagnostico;

  const [ctaAbierto, setCtaAbierto] = useState(false);
  const [feedbackEstado, setFeedbackEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [compartido, setCompartido] = useState<"idle" | "ok" | "error">("idle");

  const contexto: ContextoDiagnosticoLead = {
    especie: especie_identificada,
    gravedad: diag.gravedad,
    tipo: diag.tipo,
    requiere_experto,
    organo: organo_detectado,
    cultivo: contextoUsuario?.cultivo,
    municipio: contextoUsuario?.municipio,
    sintoma: contextoUsuario?.sintoma,
  };

  const mostrarCTA = debeOfrecerRevision(contexto);
  const esSano = diag.tipo === "sano";
  const nivel = nivelSenal(diag.confianza);

  const enviarFeedback = async (feedback: string) => {
    if (!diagnostico.id || !feedback) return;
    setFeedbackEstado("enviando");
    try {
      const response = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: diagnostico.id, feedback }),
      });
      if (!response.ok) throw new Error();
      setFeedbackEstado("ok");
    } catch {
      setFeedbackEstado("error");
    }
  };

  const showFeedback = () => {
    const feedback = prompt("¿Qué corregirías de esta orientación? (opcional)");
    if (feedback !== null) {
      enviarFeedback(feedback);
    }
  };

  const abrirCTA = () => {
    setCtaAbierto(true);
    trackEvento("cta_revision_abierto", {
      gravedad: diag.gravedad,
      requiere_experto,
      tipo: diag.tipo,
    });
  };

  const textoCompartir = [
    `Orientación inicial TecRural — ${especie_identificada}`,
    `Observado: ${diag.sintomas_observados.slice(0, 2).join("; ") || "sin síntomas claros en la foto"}.`,
    esSano
      ? "Resultado: sin síntomas claros en esta foto."
      : `Diagnóstico más probable: ${diag.nombre} (seguridad ${porcentajeConfianza(diag.confianza)} %, impacto potencial ${GRAVEDAD_LABELS[diag.gravedad] || diag.gravedad}).`,
    recomendacion ? `Pasos prudentes: ${recomendacion}` : "",
    "Orientación generada automáticamente a partir de una foto; no sustituye una inspección técnica.",
  ].filter(Boolean).join("\n");

  const compartir = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Orientación TecRural", text: textoCompartir });
        setCompartido("ok");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(textoCompartir);
        setCompartido("ok");
      } else {
        setCompartido("error");
      }
    } catch {
      setCompartido("error");
    }
  };

  const datosFaltantes = (() => {
    if (datos_faltantes && datos_faltantes.length > 0) return datos_faltantes;
    const fallback: string[] = [];
    if (diagnostico.calidad_imagen?.nitidez === "baja") fallback.push("Una foto más nítida del síntoma");
    if (diagnostico.calidad_imagen?.encuadre !== "adecuado") fallback.push("Una foto con el síntoma bien encuadrado");
    if (!contextoUsuario?.municipio) fallback.push("Tu municipio o comarca");
    if (!contextoUsuario?.sintoma) fallback.push("Qué síntoma has observado principalmente");
    return fallback;
  })();

  return (
    <div className="space-y-5" role="region" aria-label="Resultado de la orientación">
      <div className="relative aspect-[4/3] rounded-[var(--tr-radius-card)] overflow-hidden border border-tr-line">
        <img
          src={imagenPreview}
          alt="Foto analizada"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="text-white text-small font-medium truncate font-body">
            {ORGANO_LABELS[organo_detectado] || organo_detectado} · {especie_identificada}
          </p>
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-2 p-4 ${cardStyles}`}>
        <span className={badgeBlue}>
          Órgano: {ORGANO_LABELS[organo_detectado] || organo_detectado}
        </span>
        <span className={badgeEspecie}>
          Especie: {especie_identificada}
        </span>
        {diagnostico.nombre_planta && (
          <span className={badgeSecondary}>
            Indicada: {diagnostico.nombre_planta}
          </span>
        )}
      </div>

      {/* Resumen destacado: lo primero que el agricultor necesita leer */}
      <div
        className={`p-5 ${cardStyles} border-l-4 ${
          esSano ? "border-tr-brand-green" : diag.gravedad === "severa" ? "border-red-500" : "border-tr-warning"
        } bg-tr-surface`}
        aria-label="Resumen del diagnóstico"
      >
        <p className="text-caption font-semibold uppercase tracking-wide text-tr-muted">
          {esSano ? "Resultado" : "Diagnóstico más probable"}
        </p>
        <p className="mt-1 font-heading font-bold text-2xl text-tr-forest underline decoration-tr-lime decoration-4 underline-offset-4">
          {esSano ? "Sin síntomas claros" : nombreCorto(diag.nombre)}
        </p>
        {!esSano && diag.nombre.trim() !== nombreCorto(diag.nombre).trim() && (
          <p className="mt-2 text-body text-tr-ink">
            {clave("Lo que sugiere la foto:")} {diag.nombre}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={badgeSecondary}>{TIPO_LABELS[diag.tipo] || diag.tipo}</span>
          <span className={nivel.badge}>Seguridad: {porcentajeConfianza(diag.confianza)} %</span>
          <span
            className={
              diag.gravedad === "leve" ? badgeGreen : diag.gravedad === "moderada" ? badgeYellow : badgeRed
            }
          >
            Impacto potencial: {GRAVEDAD_LABELS[diag.gravedad] || diag.gravedad}
          </span>
        </div>
        <p className="mt-2 text-caption text-tr-muted">{nivel.ayuda}</p>
      </div>

      {seccion("1. Qué se observa en la foto", (
        diag.sintomas_observados.length > 0 ? (
          <ul className="space-y-2" role="list">
            {diag.sintomas_observados.map((sintoma, i) => (
              <li key={i} className="text-body text-tr-muted flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
                <span>{sintoma}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-tr-muted">
            No se aprecian síntomas claros en esta foto. Ten en cuenta que el problema puede
            estar en una parte de la planta que no aparece en la imagen.
          </p>
        )
      ))}

      {seccion("2. Otras posibilidades", (
        <div>
          {esSano && (
            <p className="text-body text-tr-ink">
              En esta foto el cultivo no muestra señales claras de problema. Es una observación
              puntual: sigue atento por si aparecen síntomas.
            </p>
          )}
          {!esSano && (
            <ul className="space-y-3" role="list">
              {(diagnosticos_diferenciales ?? []).map((d, i) => (
                <li key={i} className="text-body text-tr-muted">
                  <div className="flex flex-wrap items-baseline gap-2">
                    {clave(nombreCorto(d.nombre))}
                    <span className="text-caption font-semibold text-tr-muted">
                      {porcentajeConfianza(d.confianza)} %
                    </span>
                  </div>
                  {d.por_que_descartado && <p className="mt-0.5">{d.por_que_descartado}</p>}
                </li>
              ))}
            </ul>
          )}
          {diagnosticos_diferenciales && diagnosticos_diferenciales.length === 0 && (
            <p className="text-body text-tr-muted">
              No se han identificado otras causas alternativas a partir de esta foto.
            </p>
          )}
        </div>
      ))}

      {datosFaltantes.length > 0 && seccion("3. Qué faltaría para afinar la orientación", (
        <ul className="space-y-2" role="list">
          {datosFaltantes.map((d, i) => (
            <li key={i} className="text-body text-tr-muted flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-tr-warning mt-2 flex-shrink-0" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      ))}

      {recomendacion && seccion("4. Próximos pasos prudentes", (
        <p className="text-body text-tr-ink leading-relaxed">{recomendacion}</p>
      ))}

      {estado_madurez.aplica && (
        <div className={`${cardStyles} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-heading font-semibold text-tr-forest">Estado de madurez (estimación)</h3>
            <span className={badgeSecondary}>{estado_madurez.estado}</span>
          </div>
          <p className="text-small text-tr-muted">
            {estado_madurez.dias_estimados_cosecha > 0 ? (
              <>
                {clave(`~${estado_madurez.dias_estimados_cosecha} días`)} estimados para la cosecha
                (orientativo).
              </>
            ) : (
              "Cosecha inminente o no estimable."
            )}
          </p>
        </div>
      )}

      {requiere_experto && (
        <div className={`${cardStyles} p-5 border-l-4 border-tr-warning bg-tr-warning/5`}>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-tr-warning-text flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-heading font-semibold text-tr-forest">Cuándo conviene una revisión técnica</p>
              <p className="mt-1 text-body text-tr-muted">
                En este caso, la fotografía no aporta evidencia suficiente: conviene añadir más
                fotos o que un técnico agronómico lo compruebe.
              </p>
            </div>
          </div>
        </div>
      )}

      {mostrarCTA && (
        <div className={`${cardStyles} p-5 border-l-4 ${diag.gravedad === "severa" ? "border-red-500" : "border-tr-brand-green"}`}>
          <h3 className="font-heading font-semibold text-tr-forest">¿Quieres que revisemos este caso contigo?</h3>
          <p className="mt-1 text-body text-tr-muted">
            Solicita una revisión de la fotografía y cuéntanos el cultivo y el municipio. Un
            técnico de TecRural valorará tu caso y te propondrá el siguiente paso.
          </p>
          {!ctaAbierto ? (
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button onClick={abrirCTA} type="button" className={`${btnPrimary} flex-1`}>
                Solicitar revisión de TecRural
              </button>
              {whatsappDisponible && (
                <a
                  href={urlWhatsApp(`Hola, he hecho un diagnóstico con la app de TecRural sobre ${especie_identificada} y quiero que revisen mi caso.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvento("whatsapp_click", { origen: "post_diagnostico" })}
                  className={`${btnSecondary} flex-1`}
                >
                  WhatsApp
                </a>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <LeadForm
                origen="post_diagnostico"
                diagnosticoId={diagnostico.id}
                contexto={contexto}
                prefill={{
                  cultivo: contextoUsuario?.cultivo,
                  municipio: contextoUsuario?.municipio,
                  variedad: diagnostico.nombre_planta || contextoUsuario?.variedad,
                  sintoma: contextoUsuario?.sintoma,
                }}
                mensajeInicial={diag.tipo !== "sano" ? `Me sale esta orientación: ${diag.nombre} en ${especie_identificada}.` : ""}
                adjuntarFotos={fotosDataUrl}
              />
            </div>
          )}
        </div>
      )}

      {!mostrarCTA && (
        <div className={`${cardStyles} p-4 text-center`}>
          <p className="text-small text-tr-muted">
            {esSano
              ? "El cultivo se ve bien en esta foto. Vigílalo y repite el análisis si notas cambios."
              : "Vigila la evolución y repite el análisis en unos días."}{" "}
            <Link href="/contacto" className="text-tr-green-strong font-semibold hover:underline">
              ¿Dudas? Contacta con TecRural
            </Link>
          </p>
        </div>
      )}

      <div className={`${cardStyles} p-4 bg-tr-paper`}>
        <p className="text-caption text-tr-muted leading-relaxed">
          <span className="font-semibold text-tr-ink">Aviso:</span> esta orientación se genera
          automáticamente a partir de tu foto y puede contener errores. Es una hipótesis inicial,
          no un diagnóstico definitivo, y no sustituye una inspección profesional ni una
          prescripción de tratamientos. El porcentaje de seguridad indica el grado de coincidencia
          con los síntomas de la foto, no una certeza. Tu foto se envía a un servicio de IA externo
          para el análisis y no se guarda, salvo que solicites una revisión (en ese caso se comparte
          con el técnico, informándote antes).
        </p>
      </div>

      {feedbackEstado !== "idle" && feedbackEstado !== "enviando" && (
        <p
          className={`text-small text-center ${feedbackEstado === "ok" ? "text-tr-green-strong" : "text-tr-warning-text"}`}
          role="status"
        >
          {feedbackEstado === "ok"
            ? "Gracias por tu feedback. Nos ayuda a mejorar."
            : "No se pudo guardar el feedback. Inténtalo de nuevo."}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={showFeedback}
          disabled={isLoading || feedbackEstado === "enviando"}
          type="button"
          className={`${btnSecondary} flex-1`}
        >
          Esto no es correcto
        </button>
        <button
          onClick={compartir}
          disabled={isLoading}
          type="button"
          className={`${btnSecondary} flex-1`}
        >
          {compartido === "ok" ? "Copiado / compartido" : "Compartir resultado"}
        </button>
        <button
          onClick={onRetry}
          disabled={isLoading}
          type="button"
          className={`${btnPrimary} flex-1`}
        >
          Nuevo análisis
        </button>
      </div>
    </div>
  );
}
