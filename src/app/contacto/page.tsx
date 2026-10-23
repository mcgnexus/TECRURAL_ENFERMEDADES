import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";
import { openGraphDeRuta } from "@/lib/seo";
import { urlWhatsApp, whatsappDisponible } from "@/lib/contacto";
import { IDENTIDAD, REVISION_TECNICA } from "@/lib/textos-publicos";

export const metadata: Metadata = {
  alternates: { canonical: "/contacto" },
  openGraph: openGraphDeRuta("/contacto"),
  title: "Contacto",
  description:
    "Cuenta qué le pasa a tu cultivo en el Altiplano de Granada o la Costa Tropical. Si pides revisión, te respondemos en un máximo de 48 horas por el canal que elijas.",
};

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold transition-all duration-200 ";
const btnSecondary = `${btnBase} bg-tr-lime text-tr-forest hover:bg-[#c7dc83] active:scale-[0.98]`;
const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

export default function ContactoPage() {
  return (
    <main className="min-h-screen bg-tr-paper py-8 px-4">
      <div className="max-w-md mx-auto">
        <header className="mb-8 text-center">
          <h1 className="font-heading font-bold text-tr-forest">Habla con TecRural</h1>
          <p className="text-tr-muted mt-2 text-body">
            Cuéntanos qué le pasa a tu cultivo. {REVISION_TECNICA}
          </p>
        </header>

        <div className="space-y-5">
          <div className={`${cardStyles} p-4 bg-tr-paper`}>
            <p className="text-small font-semibold text-tr-forest">¿Prefieres escribir directamente?</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-small font-semibold text-tr-forest">
              {whatsappDisponible && (
                <a href={urlWhatsApp()} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center underline-offset-2 hover:underline">
                  WhatsApp
                </a>
              )}
              <a href={`mailto:${IDENTIDAD.correo}`} className="inline-flex min-h-[44px] items-center underline-offset-2 hover:underline">
                {IDENTIDAD.correo}
              </a>
              <span className="font-normal text-tr-muted">{IDENTIDAD.ubicacion}</span>
            </p>
          </div>

          <LeadForm origen="contacto_directo" />

          <div className={`${cardStyles} p-5`}>
            <h2 className="font-heading font-semibold text-tr-forest text-small mb-2">
              ¿Quieres una orientación rápida antes?
            </h2>
            <p className="text-caption text-tr-muted leading-relaxed mb-3">
              Haz un análisis gratuito con una foto de tu cultivo y, si el caso lo requiere,
              podremos ayudarte con más contexto.
            </p>
            <Link href="/" className={`${btnSecondary} w-full`}>
              Hacer un análisis con foto
            </Link>
          </div>

          <div className={`${cardStyles} p-4 bg-tr-paper`}>
            <p className="text-caption text-tr-muted leading-relaxed">
              Antes de enviar tu solicitud, consulta nuestra{" "}
              <Link href="/privacidad" className="font-semibold text-tr-green-strong underline hover:no-underline">política de privacidad</Link>. También puedes consultar el{" "}
              <Link href="/aviso-legal" className="font-semibold text-tr-green-strong underline hover:no-underline">aviso legal</Link> y la información sobre{" "}
              <Link href="/cookies" className="font-semibold text-tr-green-strong underline hover:no-underline">cookies y analítica</Link>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
