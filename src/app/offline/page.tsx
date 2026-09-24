"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-[var(--tr-focus)]";
const btnPrimary = `${btnBase} bg-tr-brand-green text-white hover:bg-tr-forest active:scale-[0.98]`;
const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <main className="min-h-screen bg-tr-paper flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className={`${cardStyles} p-8`}>
          <div className="w-20 h-20 mx-auto mb-6 bg-tr-warning/10 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-tr-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>

          <h1 className="font-heading font-bold text-tr-forest text-2xl mb-3">Sin conexión</h1>
          <p className="text-tr-muted text-body mb-6">
            No hay conexión a internet. La app funciona en modo offline para ver tu historial,
            pero necesitas conexión para realizar nuevos diagnósticos.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              type="button"
              className={`${btnPrimary} w-full`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reintentar conexión
            </button>

            <Link href="/" className={`${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper w-full block`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Ir al inicio (cached)
            </Link>

            <Link href="/historial" className={`${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper w-full block`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Ver historial (offline)
            </Link>
          </div>

          <p className="mt-6 text-caption text-tr-muted">
            Los diagnósticos guardados están disponibles offline.
            Las fotos se sincronizarán al recuperar conexión.
          </p>
        </div>
      </div>
    </main>
  );
}