"use client";

import { PWAProviders } from "@/components/PWA/Providers";

export function HistorialWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PWAProviders>
      {children}
    </PWAProviders>
  );
}