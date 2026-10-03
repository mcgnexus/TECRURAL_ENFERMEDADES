"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import logoTecRural from "../../TecRural_icono.png";
import fotoOlivo from "../../hoja olivo.jpg";
import { CameraCapture, type FotosEstado, type FotoCapturada } from "@/components/CameraCapture";
import { ContextoCultivo, CONTEXTO_INICIAL, resumenContexto, type ContextoForm } from "@/components/ContextoCultivo";
import { Results } from "@/components/Results";
import { PWAProviders } from "@/components/PWA/Providers";
import { CULTIVOS_FRECUENTES } from "@/lib/datos-zona";
import { trackEvento, volcarEventos } from "@/lib/analitica";
import { mensajeAmigable, errorDeRespuesta, ErrorAnalisis } from "@/lib/error-analisis";
import { debeSugerirEnves } from "@/lib/sugerir-fotos";
import type { DiagnosticoWithMeta } from "@/types/diagnostico";

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiereTelefono, setRequiereTelefono] = useState(false);
  const [telefonoCuota, setTelefonoCuota] = useState("");
  const [confirmarCuotaTelefono, setConfirmarCuotaTelefono] = useState(false);
  const [guardandoTelefono, setGuardandoTelefono] = useState(false);
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null);

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
  }, [vista, modoMulti, fotos.enves, contexto.sintoma]);

  // Llegada a la portada. Es el paso 1 del embudo y el denominador de la tasa
  // de conversión: sin él no se pueden contar las visitas que se van sin
  // analizar, que eran justo las que se escapaban de la métrica anterior.
  // Se dispara una vez por montaje, al volver de "resultado" no vuelve a
  // contar porque el componente no se desmonta.
  useEffect(() => {
    if (vista === "portada") {
      trackEvento("portada_vista", { tiene_historial: fotos.principal !== null });
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
    if (!fotos.principal || isLoading) return;

    setIsLoading(true);
    setError(null);
    setRequiereTelefono(false);
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

      // El cuerpo se lee UNA sola vez: un `Response` no se puede consumir dos
      // veces. Y sin exigir que sea JSON, porque la plataforma responde texto
      // plano en un 413 y un `response.json()` directo lanzaría un SyntaxError
      // que se perdería como error genérico, sin estado ni mensaje útil.
      if (!response.ok) {
        throw await errorDeRespuesta(response);
      }

      const data = (await response.json()) as DiagnosticoWithMeta;

      setDiagnostico(data);
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
      if (err instanceof ErrorAnalisis && err.requiereTelefono) setRequiereTelefono(true);
      trackEvento("analisis_error", { message: mensaje });
      // Las fotos y el contexto se conservan para reintentar
    } finally {
      setIsLoading(false);
    }
  }, [fotos, contexto, isLoading]);

  const activarCuotaTelefono = useCallback(async () => {
    setGuardandoTelefono(true);
    setErrorTelefono(null);
    try {
      const response = await fetch("/api/cuota/telefono", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: telefonoCuota, aviso_uso_datos: confirmarCuotaTelefono }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo activar la ampliación.");
      setRequiereTelefono(false);
      setError(null);
      setErrorTelefono(null);
      setConfirmarCuotaTelefono(false);
    } catch (err) {
      setErrorTelefono(err instanceof Error ? err.message : "No se pudo activar la ampliación.");
    } finally {
      setGuardandoTelefono(false);
    }
  }, [telefonoCuota, confirmarCuotaTelefono]);

  const handleReiniciar = useCallback(() => {
    setDiagnostico(null);
    setFotos({ principal: null, enves: null, planta_completa: null });
    setContexto(CONTEXTO_INICIAL);
    setError(null);
    setVista("portada");
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
                <span className="text-caption leading-tight text-tr-muted">Orientación fitosanitaria para agricultores</span>
              </span>
            </Link>
            <nav aria-label="Navegación principal" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-end">
              <a href="#como-funciona" className="inline-flex min-h-[44px] items-center rounded-[var(--tr-radius-control)] text-small font-semibold text-tr-forest underline-offset-2 hover:underline">Cómo funciona</a>
              <Link href="/contacto" className="inline-flex min-h-[44px] items-center rounded-[var(--tr-radius-control)] text-small font-semibold text-tr-forest underline-offset-2 hover:underline">Contacto</Link>
              <Link href="/contacto" className={`${btnBase} px-3 py-2 text-small bg-tr-lime text-tr-forest hover:bg-[#c7dc83]`}>
                Hablar con un técnico
              </Link>
            </nav>
          </div>
        </header>
        <div className="flex-1">
          <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14" aria-labelledby="home-title">
            <div className="text-center lg:text-left">
              <p className="mb-3 text-small font-bold tracking-[0.14em] text-tr-green-strong">ORIENTACIÓN AGRÍCOLA EN GRANADA</p>
              <h1 id="home-title" className="home-hero-title font-heading font-bold text-tr-forest text-balance">
                Descubre qué puede estar afectando a tu cultivo
              </h1>
              <p className="mt-4 text-body leading-relaxed text-tr-ink text-pretty">
                Sube una fotografía y recibe una primera orientación sobre los síntomas de tu planta.
                <span className="mt-2 block text-tr-muted">Disponible para agricultores del Altiplano y la Costa Tropical de Granada.</span>
              </p>
              <button onClick={() => setVista("captura")} type="button" className={`${btnPrimary} mt-6 w-full sm:w-auto sm:min-w-64`}>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Analizar mi planta
              </button>
              <p className="mt-3 text-small leading-relaxed text-tr-muted">
                Orientación inicial basada en una fotografía. No sustituye el diagnóstico de un técnico.
              </p>
            </div>

            <figure className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl">
              <Image
                src={fotoOlivo}
                alt="Rama de olivo con manchas en una hoja y un olivar desenfocado al fondo."
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="aspect-[3/2] h-auto w-full object-cover"
              />
            </figure>
          </section>

          <section aria-label="Ventajas de TecRural" className="border-y border-tr-line bg-[#E9EFE7]">
            <ul className="mx-auto grid max-w-6xl gap-3 px-4 py-5 text-center text-small font-semibold text-tr-forest sm:grid-cols-3 sm:gap-6 sm:px-6" role="list">
              <li>Orientación inicial</li>
              <li>Contexto local</li>
              <li>Revisión técnica opcional</li>
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
                  <h3 className="font-heading font-semibold text-tr-forest">Solicita revisión técnica</h3>
                  <p className="mt-2 text-body leading-relaxed text-tr-muted">Si lo necesitas, un técnico de TecRural puede revisar tu caso.</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="bg-white" aria-labelledby="cultivos-title">
            <div className="mx-auto grid max-w-6xl gap-5 px-4 py-12 sm:px-6 sm:py-14 md:grid-cols-[0.8fr_1.2fr] md:items-center">
              <div>
                <p className="text-small font-bold tracking-[0.12em] text-tr-green-strong">CONTEXTO DE GRANADA</p>
                <h2 id="cultivos-title" className="home-section-title mt-2 font-heading font-bold text-tr-forest">Cultivos disponibles</h2>
                <p className="mt-3 text-body leading-relaxed text-tr-muted">La orientación contempla cultivos habituales del Altiplano y la Costa Tropical.</p>
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
              <h2 id="equipo-title" className="home-section-title mt-2 font-heading font-bold text-tr-forest">TecRural, cerca de tu cultivo</h2>
            </div>
            <div className="max-w-2xl">
              <p className="text-body leading-relaxed text-tr-ink">
                TecRural está a cargo de Manuel Carrasco García y ofrece orientación a agricultores del Altiplano de Granada y la Costa Tropical.
              </p>
              <p className="mt-3 text-body leading-relaxed text-tr-muted">
                Si solicitas revisión, un técnico valorará la información del caso y te contactará por llamada o WhatsApp, según elijas. La foto se comparte con el técnico solo al enviar la solicitud. El tiempo de respuesta depende de la demanda; la solicitud no tiene coste ni implica contratar un servicio.
              </p>
            </div>
          </section>

          <section className="bg-tr-forest px-4 py-12 text-center sm:py-14" aria-labelledby="cta-final-title">
            <div className="mx-auto max-w-2xl">
              <h2 id="cta-final-title" className="home-section-title font-heading font-bold text-white">Empieza con una foto de tu cultivo</h2>
              <p className="mt-3 text-body leading-relaxed text-white/90">Recibe una orientación inicial y decide después si quieres pedir una revisión técnica.</p>
              <button onClick={() => setVista("captura")} type="button" className={`${btnBase} mt-6 bg-tr-lime px-6 text-tr-forest hover:bg-[#c7dc83]`}>
                Analizar mi planta
              </button>
            </div>
          </section>
        </div>

        <footer className="border-t border-tr-line bg-tr-surface px-4 py-6 text-small text-tr-muted">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p>© TecRural · Orientación fitosanitaria para agricultores</p>
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
            Cuéntanos qué ves y sube una foto del síntoma
          </p>
        </header>

        <p className={`mb-5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-surface p-3 text-small text-tr-muted leading-relaxed`}>
          Al terminar verás una orientación inicial. Si quieres una revisión técnica, podrás
          solicitarla después; la foto solo se comparte con el técnico cuando envías esa solicitud.
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

        {requiereTelefono && (
          <section className="mb-5 rounded-[var(--tr-radius-card)] border border-tr-line bg-tr-surface p-4" aria-labelledby="cuota-telefono-titulo">
            <h2 id="cuota-telefono-titulo" className="font-heading font-semibold text-tr-forest">Amplía el límite semanal</h2>
            <p className="mt-1 text-small text-tr-muted">Puedes hacer hasta 6 análisis en cualquier periodo de 7 días, contando los que ya hayas hecho esta semana.</p>
            <label htmlFor="cuota-telefono" className="mt-3 block text-small font-semibold text-tr-forest">Teléfono</label>
            <input
              id="cuota-telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telefonoCuota}
              onChange={(e) => setTelefonoCuota(e.target.value)}
              className="mt-1 w-full rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper px-3 py-2.5 text-tr-ink"
              placeholder="Ej.: 600 123 456"
            />
            <label className="mt-3 flex items-start gap-2 text-caption leading-relaxed text-tr-muted">
              <input
                type="checkbox"
                checked={confirmarCuotaTelefono}
                onChange={(e) => setConfirmarCuotaTelefono(e.target.checked)}
                className="mt-0.5"
              />
              <span>Confirmo que facilito mi teléfono solo para ampliar el límite de análisis. No se guarda en claro (únicamente una huella seudonimizada), no se usa para contactarme ni para publicidad, y se conserva un máximo de 180 días. Esta ampliación no es una solicitud de revisión. <Link href="/privacidad#limite-analisis" className="underline">Más información</Link>.</span>
            </label>
            {errorTelefono && <p className="mt-2 text-small text-tr-warning-text" role="alert">{errorTelefono}</p>}
            <button
              type="button"
              onClick={activarCuotaTelefono}
              disabled={guardandoTelefono || !telefonoCuota.trim() || !confirmarCuotaTelefono}
              className={`${btnPrimary} mt-3 w-full`}
            >
              {guardandoTelefono ? "Activando…" : "Ampliar a 6 análisis semanales"}
            </button>
          </section>
        )}

        <ContextoCultivo valor={contexto} onChange={setContexto} disabled={isLoading} />

        <div className="mt-5">
          <CameraCapture
            onFotosChange={handleFotosChange}
            disabled={isLoading}
            modoMulti={modoMulti}
            onToggleModoMulti={() => setModoMulti((v) => !v)}
          />
        </div>

        {fotos.principal && !isLoading && (
          <div className="mt-6">
            <button
              onClick={handleAnalizar}
              disabled={isLoading}
              type="button"
              className={`${btnPrimary} w-full py-3`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Analizar foto
            </button>
            <p className="mt-2 text-caption text-tr-muted text-center">
              El análisis tarda unos 10-20 segundos. Necesitas conexión; la foto no se guarda.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="mt-6 text-center" role="status" aria-live="polite">
            <div className="inline-flex items-center gap-2 text-tr-green-strong font-body font-medium">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-tr-brand-green border-t-transparent" />
              Analizando la foto...
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
