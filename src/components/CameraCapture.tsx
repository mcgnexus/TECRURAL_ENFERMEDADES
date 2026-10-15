"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import imageCompression from "browser-image-compression";
import { TIPOS_ACEPTADOS_FRONTEND, MAX_BYTES_IMAGEN } from "@/lib/imagen";
import { trackEvento } from "@/lib/analitica";
import { evaluarCalidadFoto, type AvisoCalidadFoto } from "@/lib/calidad-foto";

type Proveedor = "gemini" | "openai";

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
  initialFotos?: FotosEstado;
  disabled?: boolean;
  proveedor?: Proveedor;
  modoMulti?: boolean;
  onToggleModoMulti?: () => void;
}

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold transition-all duration-200 ";

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

// Compresión única: WebP re-codificado (elimina metadatos EXIF). 1536 px y
// 1 MB conservan el detalle que la fitopatología necesita: punteado de
// araña roja, fructificaciones tempranas o esporas se perdían a 1024 px.
// WebP pesa bastante menos que JPEG a igual calidad, lo que importa en móvil
// con cobertura limitada. Si el navegador no soporta WebP se recurre a JPEG.
const COMPRESSION_OPTS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1536,
  useWebWorker: true,
  quality: 0.8,
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
  initialFotos,
  disabled = false,
  modoMulti = false,
  onToggleModoMulti,
}: CameraCaptureProps) {
  const [fotos, setFotos] = useState<FotosEstado>(initialFotos ?? { principal: null, enves: null, planta_completa: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoCalidad, setAvisoCalidad] = useState<AvisoCalidadFoto | null>(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [camaraNativaFallback, setCamaraNativaFallback] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const slotActivoRef = useRef<SlotFoto>("principal");
  const origenRef = useRef<"camara" | "galeria">("galeria");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    onFotosChange(fotos);
  }, [fotos, onFotosChange]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  const cerrarCamara = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setCamaraAbierta(false);
  }, [stream]);

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
        setAvisoCalidad(await evaluarCalidadFoto(compressed));
        // Paso 2 del embudo: el agricultor ya tiene foto, que es el punto en
        // el que la mayoría abandona. Se registraba en el tipo y en el README
        // desde hacía tiempo, pero ninguna llamada lo emitía.
        trackEvento("captura_realizada", {
          origen: origenRef.current,
          kb: Math.round(compressed.size / 1024),
          formato: mimeType === "image/webp" ? "webp" : "jpeg",
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
    origenRef.current = "camara";
    const dispositivoTactil = navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
    // La cámara del sistema ofrece zoom, enfoque y flash mejor integrados en móviles.
    if (dispositivoTactil || camaraNativaFallback) {
      cameraInputRef.current?.click();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((cameraStream) => {
        setError(null);
        setCamaraNativaFallback(false);
        setStream(cameraStream);
        setCamaraAbierta(true);
      })
      .catch(() => {
        setCamaraNativaFallback(true);
        setError("No se pudo abrir la cámara integrada. Puedes usar la cámara del dispositivo.");
      });
  };

  const abrirGaleria = (slot: SlotFoto) => {
    slotActivoRef.current = slot;
    origenRef.current = "galeria";
    galleryInputRef.current?.click();
  };

  const capturarFotograma = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("No hemos podido capturar la imagen. Prueba de nuevo o usa la cámara del dispositivo.");
        return;
      }
      cerrarCamara();
      void procesarArchivo(new File([blob], `tecrural-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
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
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--tr-radius-control)] px-2 text-small font-semibold text-tr-green-strong underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tr-green-strong text-right"
          >
            {modoMulti ? "Usar una foto" : "Añadir más fotos"}
          </button>
        )}
      </div>

      <p className="mb-3 text-caption text-tr-muted">
        {modoMulti
          ? "La foto principal es obligatoria. Las fotos del envés y de la planta completa son opcionales y ayudan a afinar el análisis."
          : "Con una foto nítida del síntoma es suficiente para empezar. Si quieres, puedes añadir también el envés de la hoja y una foto de la planta completa."}
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
                <>
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
                  <p className="sr-only" role="status" aria-live="polite">{slot.label} añadida.</p>
                </>
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

      {camaraAbierta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Captura guiada">
          <div className="my-auto w-full max-w-lg rounded-2xl bg-tr-surface p-4">
            <p className="mb-3 text-small text-tr-ink">Acerca el síntoma, busca luz natural y mantén la hoja enfocada dentro del marco.</p>
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" />
              <div className="pointer-events-none absolute inset-[12%] rounded-3xl border-2 border-white/90" />
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={capturarFotograma} className={`${btnPrimary} flex-1`}>Capturar</button>
              <button type="button" onClick={cerrarCamara} className={`${btnSecondary} flex-1`}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {!modoMulti && adicionales > 0 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-caption text-tr-green-strong" role="status">
          <span>+ {adicionales} foto{adicionales > 1 ? "s" : ""} adicional{adicionales > 1 ? "es" : ""} lista{adicionales > 1 ? "s" : ""} (se incluirá en el análisis)</span>
          <button type="button" className="min-h-[44px] underline" onClick={() => {
            fijarFoto("enves", null);
            fijarFoto("planta_completa", null);
          }} disabled={disabled || isProcessing}>
            Quitar adicionales
          </button>
        </div>
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

      {avisoCalidad && (avisoCalidad.nitidezBaja || avisoCalidad.exposicionDeficiente) && (
        <div className="mt-3 rounded-xl border border-tr-warning bg-tr-warning/10 p-3 text-small text-tr-warning-text" role="status">
          <p>La foto podría salir borrosa o con poca luz. Es una comprobación orientativa; puedes continuar o repetirla.</p>
          <button type="button" className="mt-2 min-h-[44px] underline" onClick={() => setAvisoCalidad(null)}>Continuar con esta foto</button>
        </div>
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
        Fotos optimizadas para envío móvil (hasta 1536 px, comprimidas). Se envían al servicio de
        análisis y no se guardan, salvo que solicites una revisión de TecRural.
      </p>
    </div>
  );
}
