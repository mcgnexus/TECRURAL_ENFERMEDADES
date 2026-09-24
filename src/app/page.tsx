"use client";

import { useState, useCallback } from "react";
import { CameraCapture } from "@/components/CameraCapture";
import { Results } from "@/components/Results";
import type { DiagnosticoWithMeta } from "@/types/diagnostico";

type Proveedor = "gemini" | "deepseek";

export default function HomePage() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoWithMeta | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proveedor, setProveedor] = useState<Proveedor>("gemini");

  const handleCapture = useCallback(async (base64: string, mimeType: string, file: File) => {
    setImagenPreview(`data:${mimeType};base64,${base64}`);
    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("imagen", file);
      formData.append("usuario_id", "usuario_demo");
      formData.append("proveedor", proveedor);

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
  }, [proveedor]);

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
    setError(null);
  }, []);

  if (diagnostico && imagenPreview) {
    return (
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-md mx-auto">
          <header className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Resultado del diagnóstico</h1>
            <p className="text-gray-500 mt-1">Análisis completado {diagnostico.proveedor_usado && `· ${diagnostico.proveedor_usado.toUpperCase()}`}</p>
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
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">TECRURAL Diagnóstico</h1>
          <p className="text-gray-500 mt-1">Análisis fitosanitario por IA para cultivos de Andalucía oriental</p>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm" role="alert">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline hover:no-underline"
            >
              Descartar
            </button>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Modelo IA</label>
          <div className="flex gap-2">
            <button
              onClick={() => setProveedor("gemini")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                proveedor === "gemini"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              type="button"
            >
              Gemini 2.5 Flash
            </button>
            <button
              onClick={() => setProveedor("deepseek")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                proveedor === "deepseek"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              type="button"
            >
              DeepSeek Chat
            </button>
          </div>
        </div>

        <CameraCapture onCapture={handleCapture} disabled={isLoading} />

        {isLoading && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 text-primary-600 font-medium">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent" />
              Analizando con IA...
            </div>
            <p className="text-sm text-gray-500 mt-1">Esto puede tardar unos segundos</p>
          </div>
        )}

        <div className="mt-8 p-4 bg-white rounded-xl border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Consejos para mejor resultado</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary-600">•</span>
              Usa la cámara trasera y enfoca bien el síntoma
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600">•</span>
              Evita sombras duras; luz difusa (nublado) es ideal
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600">•</span>
              Foto del envés de la hoja si ves plagas/ácaros
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600">•</span>
              Incluye hoja sana de referencia al lado si es posible
            </li>
          </ul>
        </div>

        <footer className="mt-8 text-center text-xs text-gray-400">
          <p>Desarrollado para TECRURAL · Gemini 2.5 Flash / DeepSeek Chat</p>
          <p className="mt-1">No sustituye asesoramiento técnico profesional</p>
        </footer>
      </div>
    </main>
  );
}