import type { Metadata } from "next";
import Link from "next/link";
import { openGraphDeRuta } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Información sobre cookies y analítica en TecRural.",
  alternates: { canonical: "/cookies" },
  openGraph: openGraphDeRuta("/cookies"),
};
const p = "text-tr-muted leading-relaxed";

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-tr-paper px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-[var(--tr-radius-card)] border border-tr-line bg-tr-surface p-6 shadow-[var(--tr-shadow-card)] sm:p-10">
        <h1 className="font-heading text-3xl font-bold text-tr-forest">Política de cookies y analítica</h1>
        <p className="mt-2 text-tr-muted">Última actualización: 29 de septiembre de 2026</p>
        <h2 className="mb-3 mt-8 font-heading text-xl font-semibold text-tr-forest">Cookies técnicas</h2>
        <p className={p}>El sitio puede utilizar almacenamiento técnico necesario para prestar funciones solicitadas (por ejemplo, funcionamiento de la aplicación web progresiva). Esta política debe actualizarse con el inventario real de cookies/almacenamiento y sus duraciones.</p>
        <h2 className="mb-3 mt-8 font-heading text-xl font-semibold text-tr-forest">Analítica</h2>
        <p className={p}>No se carga Google Analytics ni se envían eventos a servicios de analítica de terceros. La aplicación registra eventos limitados del embudo en su propia base de datos para mostrar métricas agregadas en el panel; no se envían a Google. También mantiene un buffer local de depuración en el dispositivo. El sitio puede usar almacenamiento técnico necesario para prestar las funciones solicitadas.</p>
        <p className={`${p} mt-4`}>Para consultas: <a className="underline" href="mailto:mcgnexus@gmail.com">mcgnexus@gmail.com</a>.</p>
        <p className="mt-10 border-t border-tr-line pt-5 text-small text-tr-muted"><Link className="underline" href="/privacidad">Privacidad</Link> · <Link className="underline" href="/aviso-legal">Aviso legal</Link> · <Link className="underline" href="/contacto">Contacto</Link></p>
      </article>
    </main>
  );
}
