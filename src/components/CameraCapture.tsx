"use client";

import { useState, useCallback, useRef } from "react";
import imageCompression from "browser-image-compression";

type Proveedor = "gemini" | "deepseek";

type Angulo = "haz" | "enves" | "planta_completa";

interface CameraCaptureProps {
  onCapture: (base64: string, mimeType: string, file: File, angulo?: Angulo) => void;
  disabled?: boolean;
  maxSizeMB?: number;
  maxDimension?: number;
  quality?: number;
  proveedor?: Proveedor;
  multiAngulo?: boolean;
}

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-[var(--tr-focus)]";

const btnPrimary = `${btnBase} bg-tr-brand-green text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnOutline = `${btnBase} bg-transparent text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

const inputCapture = "w-full aspect-[4/3] bg-tr-paper rounded-[var(--tr-radius-card)] border-2 border-dashed border-tr-line transition-colors duration-200";

const ANGULOS: { id: Angulo; label: string; descripcion: string; icon: string }[] = [
  { id: "haz", label: "Haz de la hoja", descripcion: "Cara superior, síntomas principales", icon: "☀️" },
  { id: "enves", label: "Envés de la hoja", descripcion: "Cara inferior, plagas/ácaros/moho", icon: "🌿" },
  { id: "planta_completa", label: "Planta completa", descripcion: "Contexto general, distribución", icon: "🌳" },
];

const getMaxDimension = (proveedor?: Proveedor, maxDimension = 1024) => {
  if (proveedor === "deepseek") return 512;
  return maxDimension;
};

export function CameraCapture({
  onCapture,
  disabled = false,
  maxSizeMB = 1,
  maxDimension = 1024,
  quality = 0.7,
  proveedor = "gemini",
  multiAngulo = true,
}: CameraCaptureProps) {
  const effectiveMaxDimension = getMaxDimension(proveedor, maxDimension);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentAngulo, setCurrentAngulo] = useState<Angulo>("haz");
  const [capturedAngulos, setCapturedAngulos] = useState<Record<Angulo, { base64: string; mimeType: string; file: File } | null>>({
    haz: null,
    enves: null,
    planta_completa: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [showMultiAngulo, setShowMultiAngulo] = useState(multiAngulo);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback(
    async (file: File): Promise<{ base64: string; mimeType: string; compressedFile: File }> => {
      const options = {
        maxSizeMB,
        maxWidthOrHeight: effectiveMaxDimension,
        useWebWorker: true,
        quality,
        fileType: file.type || "image/jpeg",
      };

      const compressedFile = await imageCompression(file, options);
      const base64 = await imageCompression.getDataUrlFromFile(compressedFile);

      return {
        base64: base64.split(",")[1],
        mimeType: compressedFile.type,
        compressedFile,
      };
    },
    [maxSizeMB, effectiveMaxDimension, quality]
  );

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setIsProcessing(true);

      try {
        if (!file.type.startsWith("image/")) {
          throw new Error("El archivo debe ser una imagen");
        }

        const { base64, mimeType, compressedFile } = await compressImage(file);
        const previewUrl = `data:${mimeType};base64,${base64}`;
        setPreview(previewUrl);
        setCapturedAngulos((prev) => ({
          ...prev,
          [currentAngulo]: { base64, mimeType, file: compressedFile },
        }));
        onCapture(base64, mimeType, compressedFile, currentAngulo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al procesar la imagen";
        setError(message);
        console.error("Error en compresión/captura:", err);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (galleryInputRef.current) galleryInputRef.current.value = "";
      }
    },
    [compressImage, onCapture, currentAngulo]
  );

  const openCamera = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const openGallery = useCallback(() => {
    galleryInputRef.current?.click();
  }, []);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  const nextAngulo = useCallback(() => {
    const currentIndex = ANGULOS.findIndex((a) => a.id === currentAngulo);
    if (currentIndex < ANGULOS.length - 1) {
      setCurrentAngulo(ANGULOS[currentIndex + 1].id);
      setPreview(null);
    }
  }, [currentAngulo]);

  const prevAngulo = useCallback(() => {
    const currentIndex = ANGULOS.findIndex((a) => a.id === currentAngulo);
    if (currentIndex > 0) {
      setCurrentAngulo(ANGULOS[currentIndex - 1].id);
      setPreview(capturedAngulos[ANGULOS[currentIndex - 1].id] ? `data:${capturedAngulos[ANGULOS[currentIndex - 1].id]!.mimeType};base64,${capturedAngulos[ANGULOS[currentIndex - 1].id]!.base64}` : null);
    }
  }, [currentAngulo, capturedAngulos]);

  const resetAll = useCallback(() => {
    setCapturedAngulos({ haz: null, enves: null, planta_completa: null });
    setCurrentAngulo("haz");
    setPreview(null);
    setError(null);
  }, []);

  const allCaptured = ANGULOS.every((a) => capturedAngulos[a.id] !== null);

  if (!multiAngulo || !showMultiAngulo) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className={`relative ${inputCapture} hover:border-tr-brand-green hover:bg-tr-surface focus-within:border-tr-brand-green focus-within:bg-tr-surface overflow-hidden`}>
          {preview ? (
            <>
              <img src={preview} alt="Vista previa" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <button onClick={clearPreview} type="button" className={`${btnSecondary} bg-white/90 backdrop-blur`}>
                  Cambiar foto
                </button>
              </div>
            </>
          ) : (
            <button onClick={openCamera} disabled={disabled || isProcessing} className="w-full h-full flex flex-col items-center justify-center gap-3 text-tr-muted hover:text-tr-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed" type="button">
              <svg className="w-12 h-12 text-tr-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-center px-4">
                <p className="font-heading font-semibold text-tr-ink">Toma una foto</p>
                <p className="text-small text-tr-muted">Usa la cámara trasera para mejor resultado</p>
              </span>
            </button>
          )}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-tr-surface rounded-[var(--tr-radius-card)] p-6 flex items-center gap-3 shadow-[var(--tr-shadow-card)]">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-tr-brand-green border-t-transparent" />
                <span className="font-body font-medium text-tr-ink">Comprimiendo imagen...</span>
              </div>
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" disabled={disabled || isProcessing} aria-label="Capturar foto con cámara" />
        <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" disabled={disabled || isProcessing} aria-label="Adjuntar foto desde la galería" />

        <button onClick={openGallery} disabled={disabled || isProcessing} type="button" className={`${btnSecondary} mt-3 w-full`}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Adjuntar desde la galería
        </button>

        {error && <p className="mt-3 text-small text-tr-warning text-center" role="alert">{error}</p>}

        <p className="mt-2 text-caption text-tr-muted text-center">Máx. {effectiveMaxDimension}px lado mayor · Calidad {Math.round(quality * 100)}% · ~{maxSizeMB}MB {proveedor === "deepseek" && "(optimizado para DeepSeek)"}</p>
      </div>
    );
  }

  const currentAnguloInfo = ANGULOS.find((a) => a.id === currentAngulo)!;
  const completedCount = Object.values(capturedAngulos).filter(Boolean).length;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading font-semibold text-tr-forest">Captura multi-ángulo</h3>
          <button onClick={() => setShowMultiAngulo(false)} type="button" className="text-caption text-tr-muted hover:underline">Modo simple</button>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-2" role="tablist" aria-label="Ángulos de captura">
          {ANGULOS.map((angulo) => (
            <button
              key={angulo.id}
              type="button"
              role="tab"
              aria-selected={angulo.id === currentAngulo}
              aria-label={angulo.label}
              className={`flex-shrink-0 px-3 py-1.5 rounded-[var(--tr-radius-control)] font-body text-small transition-colors ${
                capturedAngulos[angulo.id]
                  ? "bg-tr-brand-green text-white"
                  : angulo.id === currentAngulo
                  ? "bg-tr-surface border border-tr-brand-green text-tr-forest"
                  : "bg-tr-paper text-tr-muted hover:bg-tr-surface"
              }`}
              onClick={() => {
                setCurrentAngulo(angulo.id);
                setPreview(capturedAngulos[angulo.id] ? `data:${capturedAngulos[angulo.id]!.mimeType};base64,${capturedAngulos[angulo.id]!.base64}` : null);
              }}
            >
              <span className="flex items-center gap-1">{angulo.icon} {angulo.label}</span>
              {capturedAngulos[angulo.id] && <span className="w-1.5 h-1.5 rounded-full bg-white/50 ml-1" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <p className="text-caption text-tr-muted text-center">{completedCount} de {ANGULOS.length} ángulos capturados</p>
      </div>

      <div className={`relative ${inputCapture} hover:border-tr-brand-green hover:bg-tr-surface focus-within:border-tr-brand-green focus-within:bg-tr-surface overflow-hidden`}>
        {preview ? (
          <>
            <img src={preview} alt={`Vista previa - ${currentAnguloInfo.label}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-2">
              <button onClick={clearPreview} type="button" className={`${btnSecondary} bg-white/90 backdrop-blur`}>Repetir</button>
              <button onClick={nextAngulo} type="button" className={`${btnPrimary} bg-white/90 backdrop-blur`} disabled={currentAngulo === "planta_completa"}>
                Siguiente
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-tr-muted p-4">
            <span className="text-4xl" aria-hidden="true">{currentAnguloInfo.icon}</span>
            <div className="text-center">
              <p className="font-heading font-semibold text-tr-ink">{currentAnguloInfo.label}</p>
              <p className="text-small text-tr-muted">{currentAnguloInfo.descripcion}</p>
            </div>
            <button onClick={openCamera} disabled={disabled || isProcessing} type="button" className={`${btnPrimary} mt-2`}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Capturar
            </button>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-tr-surface rounded-[var(--tr-radius-card)] p-6 flex items-center gap-3 shadow-[var(--tr-shadow-card)]">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-tr-brand-green border-t-transparent" />
              <span className="font-body font-medium text-tr-ink">Comprimiendo imagen...</span>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" disabled={disabled || isProcessing} aria-label={`Capturar ${currentAnguloInfo.label} con cámara`} />
      <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" disabled={disabled || isProcessing} aria-label={`Adjuntar ${currentAnguloInfo.label} desde la galería`} />

      <div className="flex gap-2 mt-3">
        <button onClick={prevAngulo} type="button" disabled={currentAngulo === "haz" || isProcessing} className={`${btnOutline} flex-1`}>Anterior</button>
        <button onClick={nextAngulo} type="button" disabled={currentAngulo === "planta_completa" || isProcessing} className={`${btnPrimary} flex-1`}>Siguiente</button>
      </div>

      <button onClick={openGallery} disabled={disabled || isProcessing} type="button" className={`${btnSecondary} mt-3 w-full`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        Adjuntar desde la galería
      </button>

      {allCaptured && (
        <div className={`mt-4 p-4 ${cardStyles} text-center`}>
          <svg className="w-6 h-6 text-tr-brand-green mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          <p className="font-body font-semibold text-tr-forest">¡Captura completa!</p>
          <p className="text-small text-tr-muted mt-1">Tienes los 3 ángulos. Pulsa "Analizar" para continuar.</p>
        </div>
      )}

      {error && <p className="mt-3 text-small text-tr-warning text-center" role="alert">{error}</p>}

      <p className="mt-2 text-caption text-tr-muted text-center">Máx. {effectiveMaxDimension}px · Calidad {Math.round(quality * 100)}% · ~{maxSizeMB}MB {proveedor === "deepseek" && "(optimizado DeepSeek)"}</p>

      {multiAngulo && (
        <button onClick={resetAll} type="button" className="mt-3 w-full text-caption text-tr-muted hover:text-tr-ink transition-colors">Reiniciar captura</button>
      )}
    </div>
  );
}
