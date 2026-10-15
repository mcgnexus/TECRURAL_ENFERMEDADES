import type { Metadata } from "next";

/** Panel interno: no debe indexarse (además está excluido en robots.txt). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
