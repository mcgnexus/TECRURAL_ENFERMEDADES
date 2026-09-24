"use client";

import { useState, useEffect, useCallback } from "react";

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
}

export function PWAInstallPrompt({ onInstall, onDismiss }: PWAInstallPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true);

    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!localStorage.getItem("pwa-install-dismissed")) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
      localStorage.setItem("pwa-installed", "true");
      onInstall?.();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isStandalone, onInstall]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
      setDeferredPrompt(null);
      onInstall?.();
    }
  }, [deferredPrompt, onInstall]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", "true");
    onDismiss?.();
  }, [onDismiss]);

  if (!showPrompt || isStandalone) return null;

  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:max-w-md sm:mx-auto z-50 animate-slide-up">
        <div className="bg-tr-surface rounded-[var(--tr-radius-section)] border border-tr-line shadow-[var(--tr-shadow-card)] p-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-tr-brand-green/10 rounded-[var(--tr-radius-card)] flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-tr-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-semibold text-tr-forest">Instalar TECRURAL</h3>
              <p className="mt-1 text-small text-tr-muted">
                Para instalar en iOS: toca <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-tr-muted hover:text-tr-ink p-1"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:max-w-md sm:mx-auto z-50 animate-slide-up">
      <div className="bg-tr-surface rounded-[var(--tr-radius-section)] border border-tr-line shadow-[var(--tr-shadow-card)] p-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-tr-brand-green/10 rounded-[var(--tr-radius-card)] flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-tr-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-semibold text-tr-forest">Instalar TECRURAL</h3>
            <p className="mt-1 text-small text-tr-muted">
              Accede rápido desde tu pantalla de inicio. Funciona offline para ver tu historial.
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleDismiss}
            type="button"
            className="flex-1 bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper px-4 py-2.5 rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)]"
          >
            Ahora no
          </button>
          <button
            onClick={handleInstall}
            type="button"
            className="flex-1 bg-tr-brand-green text-white hover:bg-tr-forest px-4 py-2.5 rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)]"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}