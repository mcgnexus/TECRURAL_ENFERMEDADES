import type { Metadata } from "next";

/** Pantalla de reserva de la PWA: sin valor de indexación. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
