"use client";

import { useState } from "react";
import Link from "next/link";
import type { DiagnosticoWithMeta, ContextoUsuario } from "@/types/diagnostico";
import { LeadForm } from "@/components/LeadForm";
import { trackEvento } from "@/lib/analitica";
import type { ContextoDiagnosticoLead } from "@/types/lead";
import {
  ORGANO_LABELS,
  TIPO_LABELS,
  GRAVEDAD_LABELS,
  nombreCorto,
  nivelSenal,
} from "@/lib/formato";

interface ResultsProps {
  diagnostico: DiagnosticoWithMeta;
  imagenPreview: string;
  /** Fotos comprimidas como data URL completo (WebP o JPEG) para adjuntar a la revisión */
  fotosDataUrl?: string[];
  contextoUsuario?: ContextoUsuario;
  onRetry: () => void;
  onImprovePhoto: () => void;
  isLoading?: boolean;
}

const badgeBase = "inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-semibold font-[var(--tr-font-body)]";

const badgeBlue = `${badgeBase} bg-tr-cyan/15 text-tr-cyan-text`;
const badgeGreen = `${badgeBase} bg-tr-lime text-tr-forest`;
const badgeYellow = `${badgeBase} bg-tr-warning/15 text-tr-warning-text`;
const badgeRed = `${badgeBase} bg-red-100 text-red-800`;
const badgeSecondary = `${badgeBase} bg-tr-paper text-tr-ink border border-tr-line`;
const badgeEspecie = `${badgeBase} bg-tr-leaf/15 text-tr-leaf-text`;

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold transition-all duration-200 ";

const btnPrimary = `${btnBase} bg-tr-green-strong text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;

/** Para las causas descartadas el interes es el contrario: cuanto mas alta la
 * confianza del diferencial, mas probable parecia y mas motivos hay para
 * mencionarla. Se invierte la escala para que el texto signifique algo. */
function etiquetaDiferencial(conf: number): string {
  if (conf < 0.25) return "muy descartada";
  if (conf < 0.5) return "poco probable";
  return "aún posible";
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
  onImprovePhoto,
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
  const [informeDesbloqueado, setInformeDesbloqueado] = useState(false);
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

  const esSano = diag.tipo === "sano";
  const nivel = nivelSenal(diag.confianza);
  const nivelBadge =
    diag.confianza >= 0.7 ? badgeGreen : diag.confianza >= 0.4 ? badgeYellow : badgeRed;

  const tratamiento = diagnostico.tratamiento;
  const tieneTratamiento = Boolean(tratamiento && tratamiento.medida.trim() && tratamiento.dosis.trim());
  const advertencias = tratamiento?.advertencias?.filter(Boolean) ?? [];

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

  const desbloquearInforme = () => {
    setInformeDesbloqueado(true);
    trackEvento("informe_desbloqueado", {
      gravedad: diag.gravedad,
      tipo: diag.tipo,
      tiene_tratamiento: tieneTratamiento,
    });
  };

  const guardarPDF = () => {
    trackEvento("informe_pdf", { tipo: diag.tipo });
    window.print();
  };

  const textoCompartir = [
    `Orientación inicial TecRural — ${especie_identificada}`,
    `Observado: ${diag.sintomas_observados.slice(0, 2).join("; ") || "sin síntomas claros en la foto"}.`,
    esSano
      ? "Resultado: sin síntomas claros en esta foto."
      : `Diagnóstico más probable: ${diag.nombre} (nivel de certeza: ${nivel.label.toLowerCase()}, impacto potencial ${GRAVEDAD_LABELS[diag.gravedad] || diag.gravedad}).`,
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
    <div className="space-y-5" id="informe-print" role="region" aria-label="Resultado de la orientación">
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
          <span className={nivelBadge}>Nivel de certeza: {nivel.label}</span>
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

      {/* Informe completo: imán suave. Se revela tras dejar el teléfono. */}
      {informeDesbloqueado ? (
        <div className={`${cardStyles} p-5 border-l-4 border-tr-brand-green`} aria-label="Informe completo">
          <div className="flex flex-wrap items-center gap-2">
            <span className={badgeGreen}>Informe completo</span>
            {tieneTratamiento && <span className={badgeSecondary}>Tratamiento orientativo</span>}
          </div>

          <h3 className="mt-3 font-heading font-semibold text-tr-forest">
            {esSano ? "Qué hacer a partir de ahora" : "Tratamiento y dosis"}
          </h3>

          {tieneTratamiento && tratamiento ? (
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-caption font-semibold uppercase tracking-wide text-tr-muted">Medida o materia activa</dt>
                <dd className="text-body font-semibold text-tr-ink">{tratamiento.medida}</dd>
              </div>
              <div>
                <dt className="text-caption font-semibold uppercase tracking-wide text-tr-muted">Dosis</dt>
                <dd className="text-body text-tr-ink">{tratamiento.dosis}</dd>
              </div>
              <div>
                <dt className="text-caption font-semibold uppercase tracking-wide text-tr-muted">Momento y forma de aplicación</dt>
                <dd className="text-body text-tr-ink">{tratamiento.momento}</dd>
              </div>
              {tratamiento.plazo_seguridad_dias != null && (
                <div>
                  <dt className="text-caption font-semibold uppercase tracking-wide text-tr-muted">Plazo de seguridad</dt>
                  <dd className="text-body text-tr-ink">
                    {clave(`${tratamiento.plazo_seguridad_dias} días`)} antes de la recolección.
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-2 text-body text-tr-muted">
              Con esta foto no procede proponer un tratamiento concreto. Mantén las labores habituales y
              vuelve a analizar si aparecen síntomas nuevos.
            </p>
          )}

          {advertencias.length > 0 && (
            <div className="mt-4 p-4 bg-tr-warning/5 border border-tr-line rounded-[var(--tr-radius-control)]">
              <p className="text-small font-semibold text-tr-forest">Antes de aplicarlo, ten en cuenta</p>
              <ul className="mt-2 space-y-1.5" role="list">
                {advertencias.map((a, i) => (
                  <li key={i} className="text-small text-tr-muted flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-tr-warning mt-2 flex-shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diagnostico.validacion_segunda_foto && (
            <div className="mt-4 p-4 bg-tr-paper border border-tr-line rounded-[var(--tr-radius-control)]">
              <p className="text-small font-semibold text-tr-forest">Confirma el diagnóstico con una segunda foto</p>
              <p className="mt-1 text-small text-tr-muted">{diagnostico.validacion_segunda_foto}</p>
            </div>
          )}

          <div className="mt-4 no-print">
            <button onClick={guardarPDF} type="button" className={`${btnPrimary} w-full`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
              Descargar el informe en PDF
            </button>
          </div>

          <p className="mt-3 text-small text-tr-muted leading-relaxed">
            El informe es orientativo: parte de una foto y puede contener errores. Confirma que el producto
            está autorizado para tu cultivo y respeta siempre la etiqueta y el plazo de seguridad.
            Hemos registrado tu caso: un técnico de TecRural te responderá en un plazo máximo de 48 horas.
          </p>
        </div>
      ) : (
        <div className={`${cardStyles} p-5 border-l-4 border-tr-brand-green`}>
          <h3 className="font-heading font-semibold text-tr-forest">
            {esSano ? "Llévate el informe completo de tu cultivo" : "Llévate el informe con el tratamiento concreto"}
          </h3>
          <p className="mt-1 text-body text-tr-muted">
            Lo que acabas de ver es la orientación inicial. El informe completo añade lo que de verdad
            cambia la decisión:
          </p>
          <ul className="mt-3 space-y-2" role="list">
            {(esSano
              ? [
                  "Qué vigilar y en qué épocas de riesgo",
                  "Cuándo merece la pena preocuparse",
                  "Qué foto repetir para confirmar que el cultivo sigue sano",
                ]
              : [
                  "Materia activa y dosis recomendada (en rango)",
                  "Momento de aplicación y plazo de seguridad antes de cosechar",
                  "Qué segunda foto confirma que el diagnóstico es correcto",
                ]
            ).map((t, i) => (
              <li key={i} className="text-body text-tr-ink flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-body text-tr-muted">
            Déjanos tu teléfono y verás el informe al momento en pantalla, listo para descargar en PDF. Un
            técnico puede además revisar tu caso contigo.
          </p>

          {!ctaAbierto ? (
            <div className="mt-4 no-print">
              <button onClick={abrirCTA} type="button" className={`${btnPrimary} w-full`}>
                Ver mi informe completo
              </button>
            </div>
          ) : (
            <div className="mt-4 no-print">
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
                onEnviado={desbloquearInforme}
              />
            </div>
          )}
          <p className="mt-3 text-small text-tr-muted leading-relaxed">
            La foto se comparte con el técnico solo si envías la solicitud. No tiene coste ni compromiso
            de contratación; el tiempo de respuesta depende de la demanda.
          </p>
        </div>
      )}

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
                    <span className="text-caption text-tr-muted">
                      {etiquetaDiferencial(d.confianza)}
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

      <div className={`${cardStyles} p-4 bg-tr-paper`}>
        <p className="text-caption text-tr-muted leading-relaxed">
          <span className="font-semibold text-tr-ink">Aviso:</span> esta orientación y el tratamiento
          propuesto se generan automáticamente a partir de tu foto y pueden contener errores. El
          tratamiento es una sugerencia orientativa, no una prescripción: confirma que el producto está
          autorizado para tu cultivo y respeta la etiqueta y el plazo de seguridad, o valóralo con un
          técnico agronómico. El nivel de certeza describe cuánto encajan los síntomas de la foto con la
          causa propuesta, no la probabilidad de que sea correcta. Tu foto se envía a un servicio de IA
          externo para el análisis y no se guarda, salvo que solicites una revisión (en ese caso se
          comparte con el técnico, informándote antes).
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

      <div className="flex flex-col sm:flex-row gap-3 pt-2 no-print">
        {diagnostico.calidad_imagen && (diagnostico.calidad_imagen.nitidez === "baja" || diagnostico.calidad_imagen.encuadre === "insuficiente" || diagnostico.calidad_imagen.iluminacion !== "adecuada") && (
          <button
            onClick={onImprovePhoto}
            disabled={isLoading}
            type="button"
            className={`${btnSecondary} flex-1`}
          >
            Mejorar la foto
          </button>
        )}
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

      {!informeDesbloqueado && (
        <p className="text-small text-tr-muted text-center">
          {esSano
            ? "El cultivo se ve bien en esta foto. Vigílalo y repite el análisis si notas cambios."
            : "Vigila la evolución y repite el análisis en unos días."}{" "}
          <Link href="/contacto" className="text-tr-green-strong font-semibold hover:underline">
            ¿Dudas? Contacta con TecRural
          </Link>
        </p>
      )}
    </div>
  );
}
