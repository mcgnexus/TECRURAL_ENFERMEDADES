"use client";

import { useEffect, useState } from "react";

/**
 * Fotos de un lead.
 *
 * No se puede poner directamente `<img src="/api/leads/fotos?...">` porque la
 * ruta exige la cabecera x-admin-token, que un `<img>` no puede enviar. Se
 * piden con fetch y se convierten en un object URL.
 *
 * El object URL se revoca al desmontar: sin eso, cada foto abierta deja su
 * blob en memoria hasta que se recarga la página, y son varios megas por
 * fotografía de parcela.
 */
export function FotosLead({
  leadId,
  total,
  token,
}: {
  leadId: string;
  total: number;
  token: string;
}) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);

  useEffect(() => {
    if (!token || total === 0) return;
    let vivo = true;
    const creadas: string[] = [];

    (async () => {
      const nuevo: Record<number, string> = {};
      for (let i = 0; i < total; i++) {
        try {
          const r = await fetch(
            `/api/leads/fotos?lead=${encodeURIComponent(leadId)}&indice=${i}`,
            { headers: { "x-admin-token": token } }
          );
          if (!r.ok) continue;
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          creadas.push(url);
          nuevo[i] = url;
        } catch {
          /* una foto que falla no debe tumbar el resto */
        }
      }
      if (vivo) {
        setUrls(nuevo);
        setCargando(false);
        if (Object.keys(nuevo).length === 0) setError(true);
      }
    })();

    return () => {
      vivo = false;
      for (const url of creadas) URL.revokeObjectURL(url);
    };
  }, [leadId, total, token]);

  if (total === 0) return <span className="text-caption text-tr-muted">—</span>;

  return (
    <>
      {cargando ? (
        <span className="text-caption text-tr-muted">Cargando…</span>
      ) : error ? (
        <span className="text-caption text-tr-warning-text">No disponibles</span>
      ) : (
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(urls).map(([i, url]) => (
            <button
              key={i}
              type="button"
              onClick={() => setAbierta(Number(i))}
              className="w-14 h-14 rounded-[var(--tr-radius-control)] overflow-hidden border border-tr-line focus:ring"
              aria-label={`Abrir foto ${Number(i) + 1} del lead`}
            >
              <img src={url} alt={`Foto ${Number(i) + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {abierta !== null && urls[abierta] && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setAbierta(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${abierta + 1} del lead`}
        >
          <img
            src={urls[abierta]}
            alt={`Foto ${abierta + 1} a tamaño completo`}
            className="max-h-full max-w-full object-contain"
          />
          <button
            type="button"
            onClick={() => setAbierta(null)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white text-2xl leading-none hover:bg-white/25"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
