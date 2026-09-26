"use client";

import { useState, useCallback } from "react";
import { CameraCapture } from "@/components/CameraCapture";
import { Results } from "@/components/Results";
import { PWAProviders } from "@/components/PWA/Providers";
import type { DiagnosticoWithMeta } from "@/types/diagnostico";

type Proveedor = "gemini" | "deepseek";

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-[var(--tr-focus)]";

const btnPrimary = `${btnBase} bg-tr-brand-green text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnPurple = `${btnBase} bg-purple-600 text-white hover:bg-purple-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

function HomeContent() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoWithMeta | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proveedor, setProveedor] = useState<Proveedor>("gemini");
  const [nombrePlanta, setNombrePlanta] = useState("");

  const handleCapture = useCallback((base64: string, mimeType: string, file: File) => {
    setImagenPreview(`data:${mimeType};base64,${base64}`);
    setCapturedFile(file);
    setError(null);
    setDiagnostico(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!capturedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("imagen", capturedFile);
      formData.append("usuario_id", "usuario_demo");
      formData.append("proveedor", proveedor);
      formData.append("nombre_planta", nombrePlanta.trim());

      const response = await fetch("/api/diagnostico", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error en el diagnóstico");
      }

      setDiagnostico(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      setDiagnostico(null);
    } finally {
      setIsLoading(false);
    }
  }, [capturedFile, proveedor, nombrePlanta]);

  const handleFeedback = useCallback(async (feedback: string) => {
    if (!diagnostico || !("id" in diagnostico)) return;

    try {
      await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: diagnostico.id, feedback }),
      });
      alert("Gracias por tu feedback. Nos ayuda a mejorar.");
    } catch {
      alert("Error guardando feedback");
    }
  }, [diagnostico]);

  const handleRetry = useCallback(() => {
    setDiagnostico(null);
    setImagenPreview(null);
    setCapturedFile(null);
    setError(null);
  }, []);

  if (diagnostico && imagenPreview) {
    return (
      <main className="min-h-screen bg-tr-paper py-8 px-4">
        <div className="max-w-md mx-auto">
          <header className="mb-8 text-center">
            <h1 className="font-heading font-bold text-tr-forest text-2xl sm:text-3xl">Resultado del diagnóstico</h1>
            <p className="text-tr-muted mt-1 text-body">
              Análisis completado {diagnostico.proveedor_usado && `· ${diagnostico.proveedor_usado.toUpperCase()}`}
              {diagnostico.angulo_usado && ` · Ángulo: ${diagnostico.angulo_usado}`}
            </p>
          </header>

          <Results
            diagnostico={diagnostico}
            imagenPreview={imagenPreview}
            onFeedback={handleFeedback}
            onRetry={handleRetry}
            isLoading={isLoading}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-tr-paper py-8 px-4">
      <div className="max-w-md mx-auto">
        <header className="mb-8 text-center">
          <h1 className="font-heading font-bold text-tr-forest text-2xl sm:text-3xl">TECRURAL Diagnóstico</h1>
          <p className="text-tr-muted mt-1 text-body">Análisis fitosanitario por IA para cultivos de Andalucía oriental</p>
        </header>

        {error && (
          <div className={`mb-6 p-4 border-l-4 border-tr-warning bg-tr-warning/5 text-tr-warning text-body ${cardStyles}`} role="alert">
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

        <div className={`mb-6 p-5 ${cardStyles}`}>
          <label className="block font-body font-semibold text-tr-forest text-small mb-3">Modelo IA</label>
          <div className="flex gap-2" role="group" aria-label="Seleccionar modelo de IA">
            <button
              onClick={() => setProveedor("gemini")}
              type="button"
              className={`flex-1 ${proveedor === "gemini" ? btnPrimary : btnSecondary}`}
              disabled={isLoading}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.734-.988-2.386l-.548-.547z" />
              </svg>
              <span>Gemini 2.5 Flash</span>
            </button>
            <button
              onClick={() => setProveedor("deepseek")}
              type="button"
              className={`flex-1 ${proveedor === "deepseek" ? btnPurple : btnSecondary}`}
              disabled={isLoading}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>DeepSeek Chat</span>
            </button>
          </div>
        </div>

        <div className={`mb-6 p-5 ${cardStyles}`}>
          <label htmlFor="nombre-planta" className="block font-body font-semibold text-tr-forest text-small mb-3">
            Nombre de la planta{" "}
            <span className="font-normal text-tr-muted">(opcional)</span>
          </label>
          <input
            id="nombre-planta"
            type="text"
            value={nombrePlanta}
            onChange={(e) => setNombrePlanta(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: olivo, tomate, vid, almendro..."
            autoComplete="off"
            className="w-full px-3 py-2.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink font-body text-body placeholder:text-tr-muted focus:border-tr-brand-green focus:bg-tr-surface focus-visible:outline-none focus-visible:ring-[var(--tr-focus)] disabled:opacity-50"
          />
          <p className="mt-2 text-caption text-tr-muted">
            Ayuda a la IA a identificar mejor la especie y ajustar el diagnóstico.
          </p>
        </div>

        <CameraCapture 
          onCapture={handleCapture} 
          disabled={isLoading} 
          proveedor={proveedor}
          multiAngulo={true}
        />

        {imagenPreview && capturedFile && !diagnostico && (
          <div className="mt-6">
            <div className="relative aspect-[4/3] rounded-[var(--tr-radius-card)] overflow-hidden border border-tr-line mb-4">
              <img
                src={imagenPreview}
                alt="Vista previa"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              type="button"
              className={`${btnPrimary} w-full py-3 text-lg`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Analizando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.734-.988-2.386l-.548-.547z" />
                  </svg>
                  Analizar con {proveedor === "gemini" ? "Gemini 2.5 Flash" : "DeepSeek Chat"}
                </>
              )}
            </button>
            <p className="mt-2 text-caption text-tr-muted text-center">
              Modelo seleccionado: {proveedor === "gemini" ? "Gemini 2.5 Flash" : "DeepSeek Chat"}
            </p>
          </div>
        )}

        {isLoading && !imagenPreview && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 text-tr-brand-green font-body font-medium">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-tr-brand-green border-t-transparent" />
              Analizando con IA...
            </div>
            <p className="text-small text-tr-muted mt-1">Esto puede tardar unos segundos</p>
          </div>
        )}

        <div className={`mt-8 p-5 ${cardStyles}`}>
          <h3 className="font-heading font-semibold text-tr-forest mb-3">Consejos para mejor resultado</h3>
          <ul className="text-body text-tr-muted space-y-2" role="list">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
              Usa la cámara trasera y enfoca bien el síntoma
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
              Evita sombras duras; luz difusa (nublado) es ideal
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
              Foto del envés de la hoja si ves plagas/ácaros
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
              Incluye hoja sana de referencia al lado si es posible
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-tr-brand-green mt-2 flex-shrink-0" />
              Captura los 3 ángulos: haz, envés y planta completa
            </li>
          </ul>
        </div>

        <footer className="mt-8 text-center text-caption text-tr-muted">
          <p>Desarrollado para TECRURAL · Gemini 2.5 Flash / DeepSeek Chat</p>
          <p className="mt-1">No sustituye asesoramiento técnico profesional</p>
        </footer>
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
