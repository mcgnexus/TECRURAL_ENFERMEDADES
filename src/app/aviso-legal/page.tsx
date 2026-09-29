import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Aviso legal", description: "Información legal del sitio web TecRural." };
const p = "text-tr-muted leading-relaxed";

export default function AvisoLegalPage() {
  return (
    <main className="min-h-screen bg-tr-paper px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-[var(--tr-radius-card)] border border-tr-line bg-tr-surface p-6 shadow-[var(--tr-shadow-card)] sm:p-10">
        <h1 className="font-heading text-3xl font-bold text-tr-forest">Aviso legal</h1>
        <p className="mt-2 text-tr-muted">Última actualización: 29 de septiembre de 2026</p>
        <h2 className="mb-3 mt-8 font-heading text-xl font-semibold text-tr-forest">Titular del sitio</h2>
        <p className={p}>Titular: <strong>Manuel Carrasco García</strong>. NIF: <strong>76143911L</strong>. Domicilio: <strong>Barrio Los Reyes 113, 18830 Huéscar (Granada), España</strong>. Correo electrónico de contacto: <a className="underline" href="mailto:mcgnexus@gmail.com">mcgnexus@gmail.com</a>.</p>
        <h2 className="mb-3 mt-8 font-heading text-xl font-semibold text-tr-forest">Finalidad y uso</h2>
        <p className={p}>Este sitio ofrece herramientas de orientación inicial sobre síntomas observados en cultivos y permite solicitar una revisión agronómica. La información automatizada es orientativa y no constituye por sí sola un diagnóstico fitosanitario definitivo ni sustituye la evaluación de un profesional.</p>
        <h2 className="mb-3 mt-8 font-heading text-xl font-semibold text-tr-forest">Propiedad intelectual y responsabilidad</h2>
        <p className={p}>Los contenidos y elementos del sitio están sujetos a la normativa aplicable de propiedad intelectual e industrial. La persona usuaria debe utilizar el sitio de forma lícita. Para consultas o incidencias, escribe a <a className="underline" href="mailto:mcgnexus@gmail.com">mcgnexus@gmail.com</a>.</p>
        <p className="mt-10 border-t border-tr-line pt-5 text-small text-tr-muted"><Link className="underline" href="/privacidad">Privacidad</Link> · <Link className="underline" href="/cookies">Cookies</Link> · <Link className="underline" href="/contacto">Contacto</Link></p>
      </article>
    </main>
  );
}
