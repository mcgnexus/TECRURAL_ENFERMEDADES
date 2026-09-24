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
      <div className="relative aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden border-2 border-dashed border-gray-300">
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
                className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg text-sm font-medium text-gray-800 hover:bg-white transition-colors"
              >
                Cambiar foto
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={openCamera}
            disabled={disabled || isProcessing}
            className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            <svg
              className="w-12 h-12"
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
              <p className="font-medium">Toma una foto</p>
              <p className="text-sm text-gray-500">Usa la cámara trasera para mejor resultado</p>
            </span>
          </button>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
              <span className="font-medium">Comprimiendo imagen...</span>
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
        <p className="mt-3 text-sm text-red-600 text-center" role="alert">
          {error}
        </p>
      )}

      <p className="mt-2 text-xs text-gray-500 text-center">
        Máx. {maxDimension}px lado mayor · Calidad {Math.round(quality * 100)}% · ~{maxSizeMB}MB
      </p>
    </div>
  );
}