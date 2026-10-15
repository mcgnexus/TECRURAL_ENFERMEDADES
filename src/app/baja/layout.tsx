import type { Metadata } from "next";

/** Página de baja de comunicaciones: enlazada desde correos, no debe indexarse. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function BajaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
