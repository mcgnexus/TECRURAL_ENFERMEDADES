"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { CameraCapture, type FotosEstado, type FotoCapturada } from "@/components/CameraCapture";
import { ContextoCultivo, CONTEXTO_INICIAL, resumenContexto, type ContextoForm } from "@/components/ContextoCultivo";
import { Results } from "@/components/Results";
import { PWAProviders } from "@/components/PWA/Providers";
import { trackEvento } from "@/lib/analitica";
import type { DiagnosticoWithMeta } from "@/types/diagnostico";

type Vista = "portada" | "captura" | "resultado";

/** Data URL completo (con su mimeType real, WebP o JPEG) de una foto capturada. */
function dataUrlFoto(foto: FotoCapturada): string {
  return `data:${foto.mimeType};base64,${foto.base64}`;
}

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 ";

const btnPrimary = `${btnBase} bg-tr-green-strong text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

/** Traduce errores técnicos a mensajes claros para el agricultor. */
function mensajeAmigable(err: unknown, status?: number): string {
  if (err instanceof TypeError) {
    return "Sin conexión suficiente. Comprueba tu red y reintenta: no has perdido las fotos ni los datos.";
  }
  if (status === 429) {
    return "Se ha alcanzado el límite de uso temporal. Espera un rato y vuelve a intentarlo.";
  }
  if (status === 400 || status === 413) {
    if (err instanceof Error && err.message) return err.message;
    return "Revisa la foto e inténtalo de nuevo.";
  }
  if (status === 502) {
    if (err instanceof Error && err.message) return err.message;
    return "No hemos podido interpretar bien esta foto. Repítela con más luz y el síntoma enfocado.";
  }
  if (status === 503) {
    return "El servicio de análisis no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.";
  }
  return "No hemos podido completar el análisis. Comprueba tu conexión e inténtalo de nuevo.";
}

function HomeContent() {
  const [vista, setVista] = useState<Vista>("portada");
  const [contexto, setContexto] = useState<ContextoForm>(CONTEXTO_INICIAL);
  const [fotos, setFotos] = useState<FotosEstado>({ principal: null, enves: null, planta_completa: null });
  const [modoMulti, setModoMulti] = useState(false);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoWithMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFotosChange = useCallback((nuevas: FotosEstado) => {
    setFotos(nuevas);
  }, []);

  const handleAnalizar = useCallback(async () => {
    if (!fotos.principal || isLoading) return;

    setIsLoading(true);
    setError(null);
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error en el análisis");
      }

      setDiagnostico(data);
      setVista("resultado");
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
      trackEvento("analisis_error", { message: mensaje });
      // Las fotos y el contexto se conservan para reintentar
    } finally {
      setIsLoading(false);
    }
  }, [fotos, contexto, isLoading]);

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
            <h1 className="font-heading font-bold text-tr-forest text-2xl sm:text-3xl">Orientación inicial</h1>
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
        <div className="flex-1 flex items-center justify-center py-10 px-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-8">
              <h1 className="font-heading font-bold text-tr-forest text-3xl sm:text-4xl leading-tight">
                ¿Has observado algo extraño en tus plantas?
              </h1>
              <p className="text-tr-muted mt-4 text-body leading-relaxed">
                Sube una foto para recibir una orientación inicial sobre los síntomas de tu
                cultivo. Disponible para agricultores del Altiplano y la Costa Tropical de
                Granada.
              </p>
            </div>

            <button
              onClick={() => setVista("captura")}
              type="button"
              className={`${btnPrimary} w-full py-4 text-lg`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Analizar una planta
            </button>

            <div className={`mt-8 p-5 ${cardStyles}`}>
              <ul className="text-small text-tr-muted space-y-3" role="list">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
                  La herramienta ofrece una <span className="text-tr-ink font-semibold">orientación inicial</span>, no un diagnóstico definitivo.
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
                  Una <span className="text-tr-ink font-semibold">fotografía clara</span> mejora el análisis.
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
                  Después de ver el resultado, podrás solicitar una <span className="text-tr-ink font-semibold">revisión de TecRural</span> si lo necesitas.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <footer className="pb-6 text-center text-caption text-tr-muted px-4">
          <p>
            <Link href="/historial" className="hover:underline">Historial</Link>
            {" · "}
            <Link href="/contacto" className="text-tr-green-strong font-semibold hover:underline">Contacta con TecRural</Link>
          </p>
          <p className="mt-1">No sustituye asesoramiento técnico profesional</p>
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
          <h1 className="font-heading font-bold text-tr-forest text-2xl sm:text-3xl">Analizar una planta</h1>
          <p className="text-tr-muted mt-1 text-body">
            Cuéntanos qué ves y sube una foto del síntoma
          </p>
        </header>

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
                  className="ml-2 underline hover:no-underline text-sm font-medium"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
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
              className={`${btnPrimary} w-full py-3 text-lg`}
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
            className="text-caption text-tr-muted hover:text-tr-ink hover:underline"
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
