"use client";

import { useState, useCallback, useRef } from "react";
import imageCompression from "browser-image-compression";

interface CameraCaptureProps {
  onCapture: (base64: string, mimeType: string, file: File) => void;
  disabled?: boolean;
  maxSizeMB?: number;
  maxDimension?: number;
  quality?: number;
}

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-[var(--tr-focus)]";

const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

const inputCapture = "w-full aspect-[4/3] bg-tr-paper rounded-[var(--tr-radius-card)] border-2 border-dashed border-tr-line transition-colors duration-200";

export function CameraCapture({
  onCapture,
  disabled = false,
  maxSizeMB = 1,
  maxDimension = 1024,
  quality = 0.7,
}: CameraCaptureProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback(
    async (file: File): Promise<{ base64: string; mimeType: string; compressedFile: File }> => {
      const options = {
        maxSizeMB,
        maxWidthOrHeight: maxDimension,
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
    [maxSizeMB, maxDimension, quality]
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
        setPreview(`data:${mimeType};base64,${base64}`);
        onCapture(base64, mimeType, compressedFile);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al procesar la imagen";
        setError(message);
        console.error("Error en compresión/captura:", err);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [compressImage, onCapture]
  );

  const openCamera = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className={`relative ${inputCapture} hover:border-tr-brand-green hover:bg-tr-surface focus-within:border-tr-brand-green focus-within:bg-tr-surface overflow-hidden`}>
        {preview ? (
          <>
            <img
              src={preview}
              alt="Vista previa"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <button
                onClick={clearPreview}
                type="button"
                className={`${btnSecondary} bg-white/90 backdrop-blur`}
              >
                Cambiar foto
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={openCamera}
            disabled={disabled || isProcessing}
            className="w-full h-full flex flex-col items-center justify-center gap-3 text-tr-muted hover:text-tr-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            <svg
              className="w-12 h-12 text-tr-brand-green"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isProcessing}
        aria-label="Capturar foto con cámara"
      />

      {error && (
        <p className="mt-3 text-small text-tr-warning text-center" role="alert">
          {error}
        </p>
      )}

      <p className="mt-2 text-caption text-tr-muted text-center">
        Máx. {maxDimension}px lado mayor · Calidad {Math.round(quality * 100)}% · ~{maxSizeMB}MB
      </p>
    </div>
  );
}