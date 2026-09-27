"use client";

import { useState } from "react";
import Link from "next/link";

const btnPrimary = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 bg-tr-green-strong text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";
const inputCls = "w-full px-3 py-2.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink font-body text-body placeholder:text-tr-muted focus:border-tr-brand-green focus:bg-tr-surface disabled:opacity-50";

export default function BajaPage() {
  const [telefono, setTelefono] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (estado === "enviando") return;
    setEstado("enviando");
    setError(null);
    try {
      const response = await fetch("/api/baja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: telefono.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo procesar la baja");
      setEstado("ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setEstado("error");
    }
  };

  return (
    <main className="min-h-screen bg-tr-paper flex items-center justify-center py-8 px-4">
      <div className="max-w-md w-full">
        <div className={`p-6 ${cardStyles}`}>
          <h1 className="font-heading font-bold text-tr-forest text-2xl mb-3">Baja de comunicaciones</h1>

          {estado === "ok" ? (
            <div>
              <p className="text-body text-tr-ink">
                Hemos registrado tu solicitud. No recibirás más comunicaciones comerciales de
                TecRural en este número.
              </p>
              <Link href="/" className={`${btnPrimary} mt-5 w-full`}>
                Volver al inicio
              </Link>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <p className="text-body text-tr-muted mb-4">
                Indica el teléfono donde recibías las comunicaciones y dejaremos de enviarte
                consejos y novedades comerciales.
              </p>

              {estado === "error" && error && (
                <div className="mb-4 p-3 border-l-4 border-tr-warning bg-tr-warning/5 text-tr-warning-text text-small rounded-[var(--tr-radius-control)]" role="alert">
                  {error}
                </div>
              )}

              <label htmlFor="baja-telefono" className="block font-body font-semibold text-tr-forest text-small mb-1.5">
                Teléfono
              </label>
              <input
                id="baja-telefono"
                type="tel"
                required
                inputMode="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                disabled={estado === "enviando"}
                autoComplete="tel"
                className={inputCls}
                placeholder="Ej: 600 123 456"
              />

              <button type="submit" disabled={estado === "enviando"} className={`${btnPrimary} mt-4 w-full`}>
                {estado === "enviando" ? "Procesando..." : "Darme de baja"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-caption text-tr-muted">
          <Link href="/" className="text-tr-green-strong font-semibold hover:underline">
            Volver al diagnóstico
          </Link>
        </p>
      </div>
    </main>
  );
}
