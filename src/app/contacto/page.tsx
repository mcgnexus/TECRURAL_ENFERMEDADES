import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Contacto | TECRURAL Diagnóstico",
  description:
    "Solicita asesoramiento agronómico para tus cultivos en el Altiplano de Granada y la Costa Tropical. Un técnico de TecRural te contactará por el canal que elijas.",
};

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 ";
const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98]`;
const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

export default function ContactoPage() {
  return (
    <main className="min-h-screen bg-tr-paper py-8 px-4">
      <div className="max-w-md mx-auto">
        <header className="mb-8 text-center">
          <h1 className="font-heading font-bold text-tr-forest text-2xl sm:text-3xl">Contacta con TecRural</h1>
          <p className="text-tr-muted mt-2 text-body">
            Asesoramiento agronómico para cultivos del Altiplano de Granada y la Costa Tropical.
            Cuéntanos tu caso y te contactamos por el canal que elijas.
          </p>
        </header>

        <div className="space-y-5">
          <LeadForm origen="contacto_directo" />

          <div className={`${cardStyles} p-5`}>
            <h2 className="font-heading font-semibold text-tr-forest text-small mb-2">
              ¿Quieres una orientación rápida antes?
            </h2>
            <p className="text-caption text-tr-muted leading-relaxed mb-3">
              Haz un diagnóstico gratuito con una foto de tu cultivo y, si el caso lo requiere,
              podremos ayudarte con más contexto.
            </p>
            <Link href="/" className={`${btnSecondary} w-full`}>
              Hacer un diagnóstico con foto
            </Link>
          </div>

          <div className={`${cardStyles} p-4 bg-tr-paper`}>
            <p className="text-caption text-tr-muted leading-relaxed">
              <span className="font-semibold text-tr-ink">Protección de datos:</span> solo
              tratamos los datos que facilitas en este formulario para contactarte y darte
              asesoramiento. No los cedemos a terceros con fines publicitarios y puedes pedir su
              eliminación en cualquier momento.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
