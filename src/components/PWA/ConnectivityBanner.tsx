"use client";

import { useOnlineStatus } from "@/hooks/usePWA";

export function ConnectivityBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-caption font-body transition-all duration-300 ${
        isOnline
          ? "bg-tr-brand-green text-white animate-slide-down"
          : "bg-tr-warning text-white animate-slide-down"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="max-w-md mx-auto flex items-center justify-center gap-2">
        {isOnline ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Conexión restablecida. Sincronizando...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Sin conexión. Modo offline activado.
          </>
        )}
      </div>
    </div>
  );
}