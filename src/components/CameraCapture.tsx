"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import imageCompression from "browser-image-compression";
import { TIPOS_ACEPTADOS_FRONTEND, MAX_BYTES_IMAGEN } from "@/lib/imagen";

type Proveedor = "gemini" | "deepseek";

export type SlotFoto = "principal" | "enves" | "planta_completa";

export interface FotoCapturada {
  base64: string;
  mimeType: string;
  file: File;
}

export interface FotosEstado {
  principal: FotoCapturada | null;
  enves: FotoCapturada | null;
  planta_completa: FotoCapturada | null;
}

interface CameraCaptureProps {
  onFotosChange: (fotos: FotosEstado) => void;
  disabled?: boolean;
  proveedor?: Proveedor;
  modoMulti?: boolean;
  onToggleModoMulti?: () => void;
}

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 ";

const btnPrimary = `${btnBase} bg-tr-green-strong text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnMini = `${btnBase} px-3 py-2 min-h-[44px] text-small`;

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

const SLOTS: { id: SlotFoto; label: string; descripcion: string; icon: string; opcional: boolean }[] = [
  {
    id: "principal",
    label: "Foto principal",
    descripcion: "Primer plano nítido del síntoma",
    icon: "🔍",
    opcional: false,
  },
  {
    id: "enves",
    label: "Envés de la hoja",
    descripcion: "Cara inferior: plagas, ácaros, moho",
    icon: "🌿",
    opcional: true,
  },
  {
    id: "planta_completa",
    label: "Planta completa",
    descripcion: "Contexto general y extensión del daño",
    icon: "🌳",
    opcional: true,
  },
];

// Compresión única: WebP re-codificado (elimina metadatos EXIF) y tamaño y
// resolución suficientes para distinguir manchas y síntomas pequeños. WebP
// pesa bastante menos que JPEG a igual calidad, lo que importa en móvil con
// cobertura limitada. Si el navegador no soporta WebP se recurre a JPEG.
const COMPRESSION_OPTS = {
  maxSizeMB: 0.6,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
  quality: 0.75,
  fileType: "image/webp" as const,
  initialQuality: 0.8,
};

const COMPRESSION_OPTS_FALLBACK = {
  ...COMPRESSION_OPTS,
  fileType: "image/jpeg" as const,
};

/** Algunos navegadores no pueden codificar a WebP; se detecta por el tipo devuelto. */
function webpSoportado(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

export function CameraCapture({
  onFotosChange,
  disabled = false,
  modoMulti = false,
  onToggleModoMulti,
}: CameraCaptureProps) {
  const [fotos, setFotos] = useState<FotosEstado>({ principal: null, enves: null, planta_completa: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slotActivoRef = useRef<SlotFoto>("principal");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onFotosChange(fotos);
  }, [fotos, onFotosChange]);

  const fijarFoto = useCallback((slot: SlotFoto, foto: FotoCapturada | null) => {
    setFotos((prev) => ({ ...prev, [slot]: foto }));
  }, []);

  const procesarArchivo = useCallback(
    async (file: File) => {
      const slot = slotActivoRef.current;
      setError(null);

      if (!file.type.startsWith("image/")) {
        setError("Ese archivo no es una imagen. Usa una foto JPG, PNG o WebP.");
        return;
      }
      if (file.size > MAX_BYTES_IMAGEN) {
        setError("La foto es demasiado grande (máximo 12 MB). Hazla con la cámara de la app.");
        return;
      }

      setIsProcessing(true);
      try {
        // La re-codificación elimina los metadatos EXIF (ubicación, hora, dispositivo)
        const opts = webpSoportado() ? COMPRESSION_OPTS : COMPRESSION_OPTS_FALLBACK;
        let compressed = await imageCompression(file, opts);
        if (opts.fileType === "image/webp" && compressed.type !== "image/webp") {
          compressed = await imageCompression(file, COMPRESSION_OPTS_FALLBACK);
        }
        const mimeType = compressed.type === "image/webp" ? "image/webp" : "image/jpeg";
        const base64 = await imageCompression.getDataUrlFromFile(compressed);
        fijarFoto(slot, {
          base64: base64.split(",")[1],
          mimeType,
          file: compressed,
        });
      } catch (err) {
        console.error("Error procesando imagen:", err);
        setError("No hemos podido procesar esa imagen. Puede estar dañada: prueba a repetir la foto.");
      } finally {
        setIsProcessing(false);
        if (cameraInputRef.current) cameraInputRef.current.value = "";
        if (galleryInputRef.current) galleryInputRef.current.value = "";
      }
    },
    [fijarFoto]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void procesarArchivo(file);
    },
    [procesarArchivo]
  );

  const abrirCamara = (slot: SlotFoto) => {
    slotActivoRef.current = slot;
    cameraInputRef.current?.click();
  };

  const abrirGaleria = (slot: SlotFoto) => {
    slotActivoRef.current = slot;
    galleryInputRef.current?.click();
  };

  const slotsVisibles = modoMulti ? SLOTS : SLOTS.filter((s) => s.id === "principal");
  const adicionales = (fotos.enves ? 1 : 0) + (fotos.planta_completa ? 1 : 0);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-heading font-semibold text-tr-forest">Fotos de tu cultivo</h3>
        {onToggleModoMulti && (
          <button
            onClick={onToggleModoMulti}
            type="button"
            className="text-caption font-semibold text-tr-green-strong hover:underline text-right"
          >
            {modoMulti ? "Modo simple (1 foto)" : "Añadir más fotos (avanzado)"}
          </button>
        )}
      </div>

      <p className="mb-3 text-caption text-tr-muted">
        {modoMulti
          ? "La foto principal es obligatoria. Las fotos del envés y de la planta completa son opcionales y ayudan a afinar el análisis."
          : "Con una foto nítida del síntoma es suficiente para empezar. Puedes añadir más fotos desde «avanzado» si quieres más precisión."}
      </p>

      <div className="space-y-3">
        {slotsVisibles.map((slot) => {
          const foto = fotos[slot.id];
          return (
            <div key={slot.id} className={`${cardStyles} p-3`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-body font-semibold text-tr-forest text-small">
                  <span className="mr-1" aria-hidden="true">{slot.icon}</span>
                  {slot.label}
                  {slot.opcional && (
                    <span className="ml-2 text-caption font-normal text-tr-muted">(opcional)</span>
                  )}
                </p>
                {foto && (
                  <div className="flex gap-2">
                    <button onClick={() => abrirCamara(slot.id)} disabled={disabled || isProcessing} type="button" className={`${btnMini} ${btnSecondary}`}>
                      Repetir
                    </button>
                    <button onClick={() => fijarFoto(slot.id, null)} disabled={disabled || isProcessing} type="button" className={`${btnMini} ${btnSecondary}`}>
                      Eliminar
                    </button>
                  </div>
                )}
              </div>

              {foto ? (
                <div className="relative aspect-[4/3] rounded-[var(--tr-radius-control)] overflow-hidden border border-tr-line">
                  <img
                    src={`data:${foto.mimeType};base64,${foto.base64}`}
                    alt={slot.label}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-tr-forest/85 text-white text-caption font-semibold">
                    {slot.label}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => abrirCamara(slot.id)}
                    disabled={disabled || isProcessing}
                    type="button"
                    className="aspect-[4/3] flex flex-col items-center justify-center gap-2 rounded-[var(--tr-radius-control)] border-2 border-dashed border-tr-line bg-tr-paper hover:border-tr-brand-green hover:bg-tr-surface transition-colors text-tr-muted hover:text-tr-ink disabled:opacity-50"
                  >
                    <svg className="w-8 h-8 text-tr-green-strong" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-caption font-semibold">Hacer foto</span>
                  </button>
                  <button
                    onClick={() => abrirGaleria(slot.id)}
                    disabled={disabled || isProcessing}
                    type="button"
                    className="aspect-[4/3] flex flex-col items-center justify-center gap-2 rounded-[var(--tr-radius-control)] border-2 border-dashed border-tr-line bg-tr-paper hover:border-tr-brand-green hover:bg-tr-surface transition-colors text-tr-muted hover:text-tr-ink disabled:opacity-50"
                  >
                    <svg className="w-8 h-8 text-tr-green-strong" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-caption font-semibold">Galería</span>
                  </button>
                </div>
              )}
              {!foto && (
                <p className="mt-2 text-caption text-tr-muted text-center">{slot.descripcion}</p>
              )}
            </div>
          );
        })}
      </div>

      {!modoMulti && adicionales > 0 && (
        <p className="mt-3 text-caption text-tr-green-strong text-center" role="status">
          + {adicionales} foto{adicionales > 1 ? "s" : ""} adicional{adicionales > 1 ? "es" : ""} lista{adicionales > 1 ? "s" : ""} (se incluirá en el análisis)
        </p>
      )}

      {isProcessing && (
        <div className="mt-3 flex items-center justify-center gap-2 text-tr-green-strong font-body font-medium text-small" role="status">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-tr-brand-green border-t-transparent" />
          Preparando la imagen...
        </div>
      )}

      {error && (
        <p className="mt-3 text-small text-tr-warning-text text-center" role="alert">{error}</p>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept={TIPOS_ACEPTADOS_FRONTEND}
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isProcessing}
        aria-label="Hacer foto con la cámara"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={TIPOS_ACEPTADOS_FRONTEND}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isProcessing}
        aria-label="Elegir foto de la galería"
      />

      <p className="mt-3 text-caption text-tr-muted text-center">
        Fotos optimizadas para envío móvil (unos 1024 px, comprimidas). Se envían al servicio de
        análisis y no se guardan, salvo que solicites una revisión de TecRural.
      </p>
    </div>
  );
}
