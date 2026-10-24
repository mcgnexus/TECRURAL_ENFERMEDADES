"use client";

import Link from "next/link";
import { IDENTIDAD } from "@/lib/textos-publicos";

/**
 * Fallo temporal al resolver el token. Es distinto de un enlace inválido o
 * caducado: aquí el enlace puede seguir siendo válido y conviene reintentar.
 */
export default function ErrorInforme({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-tr-paper px-4 py-12">
      <div className="mx-auto max-w-xl rounded-[var(--tr-radius-card)] border border-tr-line bg-tr-surface p-6 text-center shadow-[var(--tr-shadow-card)] sm:p-8">
        <h1 className="font-heading text-2xl font-bold text-tr-forest">
          No hemos podido abrir el informe ahora mismo
        </h1>
        <p className="mt-3 text-body leading-relaxed text-tr-muted">
          El enlace puede seguir siendo válido. Inténtalo de nuevo en unos minutos o escribe a
          TecRural si el problema continúa.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--tr-radius-control)] bg-tr-green-strong px-4 py-3 font-semibold text-white hover:bg-tr-forest"
          >
            Reintentar
          </button>
          <a
            href={`mailto:${IDENTIDAD.correo}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--tr-radius-control)] border border-tr-line px-4 py-3 font-semibold text-tr-ink hover:bg-tr-paper"
          >
            Contactar
          </a>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--tr-radius-control)] border border-tr-line px-4 py-3 font-semibold text-tr-ink hover:bg-tr-paper"
          >
            Inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
