"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { debeSugerirEnves } from "@/lib/sugerir-fotos";
import type { DiagnosticoWithMeta } from "@/types/diagnostico";
import { leerProgresoAnalisis } from "@/lib/progreso-analisis";
import type { FaseAnalisis } from "@/lib/opciones-analisis";
import logoTecRural from "../../TecRural_icono.png";
import type { FotosEstado, FotoCapturada } from "@/components/CameraCapture";
import { CONTEXTO_INICIAL, cultivoSeleccionado, resumenContexto, type ContextoForm } from "@/lib/contexto-cultivo";
import { EJEMPLO_ORIENTACION } from "@/lib/ejemplo-orientacion";
import { PWAProviders } from "@/components/PWA/Providers";
import { CULTIVOS_FRECUENTES } from "@/lib/datos-zona";
import { trackEvento, volcarEventos } from "@/lib/analitica";
import { mensajeAmigable, ErrorAnalisis } from "@/lib/error-analisis";
import {
  LIMITE_GRATIS,
  LIMITE_AMPLIADO,
  TIEMPO_ANALISIS,
  IDENTIDAD,
  LIMITES_HONESTOS,
  SIN_REGISTRO,
  PROPOSITO_CORREO,
} from "@/lib/textos-publicos";
import { urlWhatsApp, whatsappDisponible } from "@/lib/contacto";

const CameraCapture = dynamic(
  () => import("@/components/CameraCapture").then((mod) => mod.CameraCapture),
  {
    ssr: false,
    loading: () => <p className="text-small text-tr-muted" role="status">Preparando la cámara…</p>,
  },
);
const CultivoSelector = dynamic(
  () => import("@/components/ContextoCultivo").then((mod) => mod.CultivoSelector),
  {
    loading: () => <p className="text-small text-tr-muted" role="status">Cargando opciones de cultivo…</p>,
  },
);
const ContextoOpcional = dynamic(
  () => import("@/components/ContextoCultivo").then((mod) => mod.ContextoOpcional),
  {
    loading: () => <p className="text-small text-tr-muted" role="status">Cargando datos opcionales…</p>,
  },
);
const Results = dynamic(
  () => import("@/components/Results").then((mod) => mod.Results),
  {
    loading: () => <p className="text-small text-tr-muted" role="status">Preparando la orientación…</p>,
  },
);

type Vista = "portada" | "captura" | "resultado";

/** Data URL completo (con su mimeType real, WebP o JPEG) de una foto capturada. */
function dataUrlFoto(foto: FotoCapturada): string {
  return `data:${foto.mimeType};base64,${foto.base64}`;
}

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold transition-all duration-200 ";

const btnPrimary = `${btnBase} bg-tr-forest text-white hover:bg-[#103b2f] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line";

function HomeContent() {
  const [vista, setVista] = useState<Vista>("portada");
  const [contexto, setContexto] = useState<ContextoForm>(CONTEXTO_INICIAL);
  const [fotos, setFotos] = useState<FotosEstado>({ principal: null, enves: null, planta_completa: null });
  const [modoMulti, setModoMulti] = useState(false);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoWithMeta | null>(null);
  const [editandoFoto, setEditandoFoto] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [faseAnalisis, setFaseAnalisis] = useState<FaseAnalisis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiereAmpliacion, setRequiereAmpliacion] = useState(false);
  const [correoCuota, setCorreoCuota] = useState("");
  const [confirmarCuotaContacto, setConfirmarCuotaContacto] = useState(false);
  const [guardandoCuota, setGuardandoCuota] = useState(false);
  const [errorCuota, setErrorCuota] = useState<string | null>(null);

  const handleFotosChange = useCallback((nuevas: FotosEstado) => {
    setFotos(nuevas);
  }, []);

  // Nudge del envés: si el síntoma declarado apunta a plaga u hongo que vive
  // en la cara inferior de la hoja, se abre el modo multi una sola vez para
  // que la tarjeta del envés sea visible. Solo se sugiere (nunca se fuerza) y
  // solo si el usuario no ha capturado ya el envés o abierto el modo a mano.
  const nudgeEnvesHecho = useRef(false);
  useEffect(() => {
    if (nudgeEnvesHecho.current) return;
    if (vista !== "captura") return;
    if (modoMulti || fotos.enves) {
      nudgeEnvesHecho.current = true;
      return;
    }
    if (debeSugerirEnves(contexto.sintoma, contexto.sintomaOtro)) {
      nudgeEnvesHecho.current = true;
      setModoMulti(true);
    }
  }, [vista, modoMulti, fotos.enves, contexto.sintoma, contexto.sintomaOtro]);

  // Llegada a la portada. Es el paso 1 del embudo y el denominador de la tasa
  // de conversión: sin él no se pueden contar las visitas que se van sin
  // analizar, que eran justo las que se escapaban de la métrica anterior.
  // Se dispara una vez por montaje, al volver de "resultado" no vuelve a
  // contar porque el componente no se desmonta.
  useEffect(() => {
    if (vista === "portada") {
      trackEvento("portada_vista");
    }
    // Solo al montar: depende de `vista` intentionally, pero recontar en cada
    // cambio de vista inflaría el embudo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al ocultar la pestaña o cerrar, se vuelca lo pendiente. Sin esto se perderían
  // los últimos eventos, que son precisamente los del final del embudo.
  useEffect(() => {
    const alOcultar = () => {
      if (document.visibilityState === "hidden") void volcarEventos();
    };
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("pagehide", () => void volcarEventos());
    return () => {
      document.removeEventListener("visibilitychange", alOcultar);
    };
  }, []);

  const handleAnalizar = useCallback(async () => {
    if (!fotos.principal || !cultivoSeleccionado(contexto) || isLoading) return;

    setIsLoading(true);
    setFaseAnalisis(null);
    setError(null);
    setRequiereAmpliacion(false);
    trackEvento("analisis_iniciado", { fotos: 1 + (fotos.enves ? 1 : 0) + (fotos.planta_completa ? 1 : 0) });

    try {
      const resumen = resumenContexto(contexto);
      const formData = new FormData();
      formData.append("imagen", fotos.principal.file);
      if (fotos.enves) formData.append("imagen_enves", fotos.enves.file);
      if (fotos.planta_completa) formData.append("imagen_planta", fotos.planta_completa.file);
      formData.append("cultivo", resumen.cultivo);
      formData.append("municipio", resumen.municipio);
      formData.append("sintoma", resumen.sintoma);
      formData.append("duracion", resumen.duracion);
      formData.append("nombre_planta", resumen.variedad);

      const response = await fetch("/api/diagnostico", {
        method: "POST",
        body: formData,
      });

      const data = await leerProgresoAnalisis<DiagnosticoWithMeta>(response, setFaseAnalisis);

      setDiagnostico(data);
      setEditandoFoto(false);
      setVista("resultado");
      window.dispatchEvent(new Event("tecrural:analysis-complete"));
      trackEvento("analisis_completado", {
        gravedad: data.diagnostico?.gravedad,
        tipo: data.diagnostico?.tipo,
        requiere_experto: data.requiere_experto,
      });
      trackEvento("resultado_visto", {
        gravedad: data.diagnostico?.gravedad,
        requiere_experto: data.requiere_experto,
      });
    } catch (err) {
      const mensaje = mensajeAmigable(err);
      setError(mensaje);
      if (err instanceof ErrorAnalisis && err.requiereAmpliacion) setRequiereAmpliacion(true);
      trackEvento("analisis_error", { message: mensaje });
      // Las fotos y el contexto se conservan para reintentar
    } finally {
      setIsLoading(false);
      setFaseAnalisis(null);
    }
  }, [fotos, contexto, isLoading]);

  const activarCuotaContacto = useCallback(async () => {
    setGuardandoCuota(true);
    setErrorCuota(null);
    try {
      const response = await fetch("/api/cuota/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: correoCuota, aviso_uso_datos: confirmarCuotaContacto }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo activar la ampliación.");
      setRequiereAmpliacion(false);
      setError(null);
      setErrorCuota(null);
      setConfirmarCuotaContacto(false);
    } catch (err) {
      setErrorCuota(err instanceof Error ? err.message : "No se pudo activar la ampliación.");
    } finally {
      setGuardandoCuota(false);
    }
  }, [correoCuota, confirmarCuotaContacto]);

  const handleReiniciar = useCallback(() => {
    setDiagnostico(null);
    setFotos({ principal: null, enves: null, planta_completa: null });
    setContexto(CONTEXTO_INICIAL);
    setError(null);
    setEditandoFoto(false);
    setVista("portada");
  }, []);

  const handleMejorarFoto = useCallback(() => {
    setEditandoFoto(true);
    setError(null);
    setVista("captura");
  }, []);

  const cancelarMejoraFoto = useCallback(() => {
    setEditandoFoto(false);
    setVista("resultado");
  }, []);

  // ---------------------------------------------------------------------------
  // VISTA: RESULTADO
  // ---------------------------------------------------------------------------

  if (vista === "resultado" && diagnostico && fotos.principal) {
    return (
      <main className="min-h-screen bg-tr-paper py-8 px-4">
        <div className="max-w-md mx-auto">
          <header className="mb-8 text-center">
            <h1 className="font-heading font-bold text-tr-forest">Orientación inicial</h1>
            <p className="text-tr-muted mt-1 text-body">
              Orientación a partir de tu foto · No es un diagnóstico definitivo
            </p>
          </header>

          <Results
            diagnostico={diagnostico}
            imagenPreview={dataUrlFoto(fotos.principal)}
            fotosDataUrl={[
              dataUrlFoto(fotos.principal),
              ...(fotos.enves ? [dataUrlFoto(fotos.enves)] : []),
              ...(fotos.planta_completa ? [dataUrlFoto(fotos.planta_completa)] : []),
            ]}
            contextoUsuario={resumenContexto(contexto)}
            onRetry={handleReiniciar}
            onImprovePhoto={handleMejorarFoto}
            isLoading={isLoading}
          />
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // VISTA: PORTADA
  // ---------------------------------------------------------------------------

  if (vista === "portada") {
    return (
      <main className="min-h-screen bg-tr-paper flex flex-col">
        <header className="border-b border-tr-line bg-tr-surface px-4 py-3">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-0 sm:flex-row sm:items-center sm:justify-between sm:px-2">
            <Link href="/" className="inline-flex w-fit items-center gap-3 rounded-[var(--tr-radius-control)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tr-green-strong" aria-label="TECRURAL, ir al inicio">
              <Image src={logoTecRural} alt="" width={40} height={40} priority className="object-contain" />
              <span className="flex flex-col">
                <span className="font-heading text-base font-extrabold tracking-wide text-tr-forest">TECRURAL</span>
                <span className="text-caption leading-tight text-tr-muted">Plagas y enfermedades de tu cultivo</span>
              </span>
            </Link>
            <nav aria-label="Navegación principal" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-end">
              <a href="#como-funciona" className="inline-flex min-h-[44px] items-center rounded-[var(--tr-radius-control)] text-small font-semibold text-tr-forest underline-offset-2 hover:underline">Cómo funciona</a>
              <Link href="/contacto" className="inline-flex min-h-[44px] items-center rounded-[var(--tr-radius-control)] text-small font-semibold text-tr-forest underline-offset-2 hover:underline">Contacto</Link>
              <Link href="/contacto" className={`${btnBase} px-3 py-2 text-small bg-tr-lime text-tr-forest hover:bg-[#c7dc83]`}>
                Hablar con TecRural
              </Link>
            </nav>
          </div>
        </header>
        <div className="flex-1">
          <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14" aria-labelledby="home-title">
            <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
              <div className="text-center lg:text-left">
                <p className="mb-3 text-small font-bold tracking-[0.14em] text-tr-green-strong">PLAGAS Y ENFERMEDADES · GRANADA</p>
                <h1 id="home-title" className="home-hero-title font-heading font-bold text-tr-forest text-balance">
                  Una foto de tu cultivo y sabrás qué puede tener.
                </h1>
                <p className="mt-4 text-body leading-relaxed text-tr-ink text-pretty">
                  Aguacate, mango, chirimoyo, cítricos, olivo y hortalizas de la Costa Tropical y el Altiplano.
                </p>
                <button onClick={() => setVista("captura")} type="button" className={`${btnPrimary} mt-6 w-full sm:w-auto sm:min-w-64`}>
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Analizar mi planta — gratis
                </button>
                <p className="mt-3 text-small leading-relaxed text-tr-muted">
                  {LIMITE_GRATIS}, {SIN_REGISTRO} · {TIEMPO_ANALISIS} · No sustituye el diagnóstico de un técnico.
                </p>
              </div>

              <figure className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl">
                <div className="relative aspect-[3/2]">
                  <Image
                    src="/aguacate.jpg"
                    alt="Hoja de aguacate con lesiones y punteado oscuro por chinches del aguacate."
                    preload
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    fill
                    quality={70}
                    className="object-cover"
                  />
                </div>
              </figure>
            </div>

            {/* Ejemplo sin foto propia: permite entender el resultado antes de
                capturar nada. Es contenido estático, no llama a la API y no
                cuenta como análisis real. */}
            <details
              id="ejemplo-resultado"
              onToggle={(e) => {
                if (e.currentTarget.open) trackEvento("ejemplo_visto");
              }}
              className="group mx-auto mt-8 w-full max-w-3xl overflow-hidden rounded-[var(--tr-radius-card)] border border-tr-line bg-tr-surface"
            >
              <summary
                className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-small font-semibold text-tr-forest hover:bg-tr-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tr-green-strong"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-tr-lime px-2 py-0.5 text-caption font-bold uppercase tracking-wide text-tr-forest">
                    {EJEMPLO_ORIENTACION.etiqueta}
                  </span>
                  Ver un ejemplo de resultado
                </span>
                <svg
                  className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div className="border-t border-tr-line p-4 sm:p-5">
                <h2 className="sr-only">Ejemplo de resultado</h2>
                <p className="text-caption leading-relaxed text-tr-muted">
                  {EJEMPLO_ORIENTACION.avisoNoCliente}
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr] sm:items-start">
                  <figure>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--tr-radius-control)] border border-tr-line">
                      <Image
                        src={EJEMPLO_ORIENTACION.foto.src}
                        alt={EJEMPLO_ORIENTACION.foto.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, 220px"
                        quality={70}
                        className="object-cover"
                      />
                      <span className="absolute left-2 top-2 rounded-full bg-tr-forest/90 px-2 py-0.5 text-caption font-bold uppercase tracking-wide text-white">
                        {EJEMPLO_ORIENTACION.etiqueta}
                      </span>
                    </div>
                    <figcaption className="mt-2 text-caption text-tr-muted">
                      {EJEMPLO_ORIENTACION.cultivo} · Foto de ejemplo
                    </figcaption>
                  </figure>

                  <div className="grid gap-4">
                    <section>
                      <h3 className="font-heading font-semibold text-tr-forest text-small">Posibles causas</h3>
                      <ul className="mt-1.5 space-y-1.5" role="list">
                        {EJEMPLO_ORIENTACION.posiblesCausas.map((causa) => (
                          <li key={causa.nombre} className="text-caption leading-relaxed text-tr-muted">
                            <span className="font-semibold text-tr-ink">{causa.nombre}</span>
                            <span className="text-tr-muted"> · {causa.certeza}</span>
                            <span className="block">{causa.indicio}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <h3 className="font-heading font-semibold text-tr-forest text-small">Qué comprobar</h3>
                      <ul className="mt-1.5 space-y-1.5" role="list">
                        {EJEMPLO_ORIENTACION.queComprobar.map((paso) => (
                          <li key={paso} className="flex items-start gap-2 text-caption leading-relaxed text-tr-muted">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-tr-brand-green" aria-hidden="true" />
                            <span>{paso}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <h3 className="font-heading font-semibold text-tr-forest text-small">Limitaciones</h3>
                      <ul className="mt-1.5 space-y-1.5" role="list">
                        {EJEMPLO_ORIENTACION.limitaciones.map((limite) => (
                          <li key={limite} className="flex items-start gap-2 text-caption leading-relaxed text-tr-muted">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-tr-warning" aria-hidden="true" />
                            <span>{limite}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <h3 className="font-heading font-semibold text-tr-forest text-small">Cuándo pedir ayuda</h3>
                      <p className="mt-1.5 text-caption leading-relaxed text-tr-muted">
                        {EJEMPLO_ORIENTACION.cuandoPedirAyuda}
                      </p>
                    </section>
                  </div>
                </div>

                <p className="mt-4 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper p-3 text-caption leading-relaxed text-tr-muted">
                  Esto lo genera la herramienta automáticamente. La revisión humana es aparte: la hace{" "}
                  {IDENTIDAD.responsable}, responsable de TecRural, y responde en un máximo de 48 horas si la
                  pides, sin coste.
                </p>
              </div>
            </details>
          </section>

          <section aria-label="Qué ofrece TecRural" className="border-y border-tr-line bg-[#E9EFE7]">
            <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-5 text-center sm:grid-cols-3 sm:gap-6 sm:px-6" role="list">
              <li>
                <span className="block text-small font-bold text-tr-forest">Orientación inicial gratis</span>
                <span className="mt-1 block text-caption text-tr-muted">Posibles causas y qué comprobar.</span>
              </li>
              <li>
                <span className="block text-small font-bold text-tr-forest">Informe completo</span>
                <span className="mt-1 block text-caption text-tr-muted">Pauta orientativa con dosis y plazo si procede. Con tu correo.</span>
              </li>
              <li>
                <span className="block text-small font-bold text-tr-forest">Revisión humana</span>
                <span className="mt-1 block text-caption text-tr-muted">Opcional, sin coste, respuesta en 48 h.</span>
              </li>
            </ul>
          </section>

          <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="como-funciona-title">
            <div className="max-w-2xl">
              <p className="text-small font-bold tracking-[0.12em] text-tr-green-strong">UN PROCESO SENCILLO</p>
              <h2 id="como-funciona-title" className="home-section-title mt-2 font-heading font-bold text-tr-forest">Cómo funciona</h2>
            </div>
            <ol className="mt-8 grid gap-8 md:grid-cols-3" role="list">
              <li className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tr-forest font-heading font-bold text-white" aria-hidden="true">1</span>
                <div>
                  <h3 className="font-heading font-semibold text-tr-forest">Sube una foto</h3>
                  <p className="mt-2 text-body leading-relaxed text-tr-muted">Haz una fotografía clara de la hoja, fruto o tallo afectado.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tr-forest font-heading font-bold text-white" aria-hidden="true">2</span>
                <div>
                  <h3 className="font-heading font-semibold text-tr-forest">Recibe una orientación</h3>
                  <p className="mt-2 text-body leading-relaxed text-tr-muted">La herramienta analiza los síntomas y te ofrece posibles causas.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tr-forest font-heading font-bold text-white" aria-hidden="true">3</span>
                <div>
                  <h3 className="font-heading font-semibold text-tr-forest">Si quieres, abre el informe completo</h3>
                  <p className="mt-2 text-body leading-relaxed text-tr-muted">
                    Deja tu correo. {PROPOSITO_CORREO} Incluye, si la foto
                    lo permite, pauta orientativa con dosis y plazo de seguridad. Con tu correo pasas a
                    {` ${LIMITE_AMPLIADO}`}. La revisión humana es aparte y opcional.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          <section className="bg-white" aria-labelledby="cultivos-title">
            <div className="mx-auto grid max-w-6xl gap-5 px-4 py-12 sm:px-6 sm:py-14 md:grid-cols-[0.8fr_1.2fr] md:items-center">
              <div>
                <p className="text-small font-bold tracking-[0.12em] text-tr-green-strong">CULTIVOS</p>
                <h2 id="cultivos-title" className="home-section-title mt-2 font-heading font-bold text-tr-forest">Cultivos que reconoce</h2>
                <p className="mt-3 text-body leading-relaxed text-tr-muted">Aguacate, mango, chirimoyo, cítricos, olivo, almendro, vid y hortalizas. Si el tuyo no está en la lista, puedes escribirlo.</p>
              </div>
              <ul className="flex flex-wrap gap-2" aria-label="Cultivos disponibles" role="list">
                {CULTIVOS_FRECUENTES.map((cultivo) => (
                  <li key={cultivo} className="rounded-full border border-tr-line bg-tr-lime/40 px-3 py-2 text-small font-medium text-tr-ink">{cultivo}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mx-auto grid max-w-6xl gap-5 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-[0.7fr_1.3fr]" aria-labelledby="equipo-title">
            <div>
              <p className="text-small font-bold tracking-[0.12em] text-tr-green-strong">QUIÉN ESTÁ DETRÁS</p>
              <h2 id="equipo-title" className="home-section-title mt-2 font-heading font-bold text-tr-forest">Hablas con personas, no solo con una máquina</h2>
            </div>
            <div className="max-w-2xl">
              <p className="text-body leading-relaxed text-tr-ink">
                TecRural es un proyecto de {IDENTIDAD.responsable}, de {IDENTIDAD.ubicacion}. Las
                revisiones de los casos las hace {IDENTIDAD.responsable} y responde en un máximo de 48
                horas por el canal que elijas. La revisión no tiene coste ni compromiso de contratación.
              </p>
              <p className="mt-3 text-body leading-relaxed text-tr-muted">{LIMITES_HONESTOS}</p>
              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-small font-semibold text-tr-forest">
                {whatsappDisponible && (
                  <a
                    href={urlWhatsApp()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-2 underline-offset-2 hover:underline"
                  >
                    <svg className="h-5 w-5 text-tr-green-strong" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.06c-.25.69-1.45 1.32-2 1.37-.55.05-1.05.24-3.53-.74-2.99-1.18-4.86-4.28-5.01-4.48-.15-.2-1.19-1.59-1.19-3.03 0-1.44.75-2.15 1.02-2.44.27-.3.59-.37.79-.37.2 0 .39 0 .57.01.18.01.43-.07.67.51.25.6.84 2.06.91 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.76 1.26 1.64 2.04 1.13 1 2.07 1.31 2.37 1.46.3.15.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.71.81 2 .95.3.15.5.22.57.35.07.12.07.72-.18 1.41z" />
                    </svg>
                    Escríbenos por WhatsApp
                  </a>
                )}
                <a href={`mailto:${IDENTIDAD.correo}`} className="inline-flex min-h-[44px] items-center underline-offset-2 hover:underline">
                  {IDENTIDAD.correo}
                </a>
                <span className="font-normal text-tr-muted">{IDENTIDAD.ubicacion}</span>
              </p>
            </div>
          </section>

          <section className="bg-tr-forest px-4 py-12 text-center sm:py-14" aria-labelledby="cta-final-title">
            <div className="mx-auto max-w-2xl">
              <h2 id="cta-final-title" className="home-section-title font-heading font-bold text-white">Empieza con una foto de tu cultivo</h2>
              <p className="mt-3 text-body leading-relaxed text-white/90">{LIMITE_GRATIS}, sin registro. Si quieres el informe completo, deja tu correo y se abre en pantalla.</p>
              <button onClick={() => setVista("captura")} type="button" className={`${btnBase} mt-6 bg-tr-lime px-6 text-tr-forest hover:bg-[#c7dc83]`}>
                Analizar mi planta gratis
              </button>
            </div>
          </section>
        </div>

        <footer className="border-t border-tr-line bg-tr-surface px-4 py-6 text-small text-tr-muted">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p>© TecRural · Plagas y enfermedades de tu cultivo</p>
            <nav aria-label="Enlaces legales y contacto" className="flex flex-wrap gap-x-5 gap-y-2">
              <Link className="min-h-[44px] inline-flex items-center underline-offset-2 hover:underline" href="/contacto">Contacto</Link>
              <Link className="min-h-[44px] inline-flex items-center underline-offset-2 hover:underline" href="/privacidad">Privacidad</Link>
              <Link className="min-h-[44px] inline-flex items-center underline-offset-2 hover:underline" href="/aviso-legal">Aviso legal</Link>
              <Link className="min-h-[44px] inline-flex items-center underline-offset-2 hover:underline" href="/cookies">Cookies</Link>
            </nav>
          </div>
        </footer>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // VISTA: CAPTURA (contexto + fotos + analizar)
  // ---------------------------------------------------------------------------

  return (
    <main className="min-h-screen bg-tr-paper py-8 px-4">
      <div className="max-w-md mx-auto">
        <header className="mb-6 text-center">
          <h1 className="font-heading font-bold text-tr-forest">Analizar una planta</h1>
          <p className="text-tr-muted mt-1 text-body">
            Elige el cultivo y añade una foto del síntoma
          </p>
        </header>

        <p className={`mb-5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-surface p-3 text-small text-tr-muted leading-relaxed`}>
          <span className="font-semibold text-tr-ink">{LIMITE_GRATIS}, {SIN_REGISTRO}.</span> {TIEMPO_ANALISIS}.
          Al terminar verás una orientación inicial. Si quieres el informe completo con la pauta orientativa
          (materia activa, dosis y plazo de seguridad), deja tu correo. {PROPOSITO_CORREO} Con tu correo
          pasas a {LIMITE_AMPLIADO}. La revisión de un técnico es aparte, opcional y sin coste.
        </p>

        {error && (
          <div className={`mb-6 p-4 border-l-4 border-tr-warning bg-tr-warning/5 text-tr-warning-text text-body ${cardStyles}`} role="alert">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                {error}
                <button
                  onClick={() => setError(null)}
                  className="ml-2 underline hover:no-underline text-small font-medium"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}

        {requiereAmpliacion && (
          <section className="mb-5 rounded-[var(--tr-radius-card)] border border-tr-line bg-tr-surface p-4" aria-labelledby="cuota-contacto-titulo">
            <h2 id="cuota-contacto-titulo" className="font-heading font-semibold text-tr-forest">Has usado tu análisis gratis de este periodo</h2>
            <p className="mt-1 text-small text-tr-muted">
              Deja tu correo para pasar a {LIMITE_AMPLIADO}. No lo usamos para contactarte ni para publicidad.
            </p>
            <label htmlFor="cuota-correo" className="mt-3 block text-small font-semibold text-tr-forest">Correo electrónico</label>
            <input
              id="cuota-correo"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={correoCuota}
              onChange={(e) => setCorreoCuota(e.target.value)}
              className="mt-1 w-full rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper px-3 py-2.5 text-tr-ink"
              placeholder="Ej.: nombre@correo.com"
            />
            <label className="mt-3 flex items-start gap-2 text-caption leading-relaxed text-tr-muted">
              <input
                type="checkbox"
                checked={confirmarCuotaContacto}
                onChange={(e) => setConfirmarCuotaContacto(e.target.checked)}
                className="mt-0.5"
              />
              <span>Entiendo que guardáis una versión cifrada de mi correo para aplicar el límite de {LIMITE_AMPLIADO}. No me escribiréis ni me enviaréis publicidad. <Link href="/privacidad#limite-analisis" className="underline">Más información</Link>.</span>
            </label>
            {errorCuota && <p className="mt-2 text-small text-tr-warning-text" role="alert">{errorCuota}</p>}
            <button
              type="button"
              onClick={activarCuotaContacto}
              disabled={guardandoCuota || !correoCuota.trim() || !confirmarCuotaContacto}
              className={`${btnPrimary} mt-3 w-full`}
            >
              {guardandoCuota ? "Activando…" : `Ampliar a ${LIMITE_AMPLIADO}`}
            </button>
          </section>
        )}

        <CultivoSelector valor={contexto} onChange={setContexto} disabled={isLoading} />

        {editandoFoto && (
          <button
            type="button"
            onClick={cancelarMejoraFoto}
            className="mt-3 inline-flex min-h-[44px] items-center text-small font-semibold text-tr-green-strong underline"
          >
            Volver al resultado anterior
          </button>
        )}

        <div className="mt-5">
          <CameraCapture
            onFotosChange={handleFotosChange}
            initialFotos={fotos}
            disabled={isLoading}
            modoMulti={modoMulti}
            onToggleModoMulti={() => setModoMulti((v) => !v)}
          />
        </div>

        <div className="mt-5">
          <ContextoOpcional valor={contexto} onChange={setContexto} disabled={isLoading} />
        </div>

        {fotos.principal && !isLoading && (
          <div className="mt-6">
            <button
              onClick={handleAnalizar}
              disabled={isLoading || !cultivoSeleccionado(contexto)}
              type="button"
              className={`${btnPrimary} w-full py-3`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Analizar foto
            </button>
            {!cultivoSeleccionado(contexto) ? (
              <p className="mt-2 text-small text-tr-warning-text text-center" role="status">
                Elige el cultivo arriba: la herramienta interpreta mejor la foto sabiendo qué planta es.
              </p>
            ) : (
              <p className="mt-2 text-caption text-tr-muted text-center">
                El análisis tarda unos 10-20 segundos. Necesitas conexión; la foto no se guarda salvo que pidas revisión.
              </p>
            )}
          </div>
        )}

        {isLoading && (
          <div className="mt-6 text-center" role="status" aria-live="polite">
            <div className="inline-flex items-center gap-2 text-tr-green-strong font-body font-medium">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-tr-brand-green border-t-transparent" />
              {faseAnalisis === "observacion" && "Observando la foto..."}
              {faseAnalisis === "hipotesis" && "Contrastando posibles causas..."}
              {faseAnalisis === "verificacion" && "Verificando la orientación..."}
              {faseAnalisis === "reintento" && "Revisando una alternativa..."}
              {faseAnalisis === "proveedor_alternativo" && "Conectando con un servicio alternativo..."}
              {!faseAnalisis && "Enviando las fotos..."}
            </div>
            <p className="text-small text-tr-muted mt-1">
              Suele tardar entre 10 y 20 segundos. Mantén esta pantalla abierta.
            </p>
          </div>
        )}

        <p className="mt-8 text-center">
          <button
            onClick={() => setVista("portada")}
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--tr-radius-control)] px-3 text-small text-tr-muted hover:text-tr-ink hover:underline"
            disabled={isLoading}
          >
            ← Volver al inicio
          </button>
        </p>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <PWAProviders>
      <HomeContent />
    </PWAProviders>
  );
}
