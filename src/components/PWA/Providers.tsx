"use client";

import { PWAInstallPrompt } from "@/components/PWA/InstallPrompt";
import { ConnectivityBanner } from "@/components/PWA/ConnectivityBanner";

export function PWAProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ConnectivityBanner />
      <PWAInstallPrompt />
    </>
  );
}