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
        <p className="mt-2 text-tr-muted">Última actualización: 15 de octubre de 2026</p>
        <h2 className="mb-3 mt-8 font-heading text-xl font-semibold text-tr-forest">Cookies técnicas</h2>
        <p className={p}>El sitio puede utilizar almacenamiento técnico necesario para prestar funciones solicitadas (por ejemplo, funcionamiento de la aplicación web progresiva). Esta política debe actualizarse con el inventario real de cookies/almacenamiento y sus duraciones.</p>
        <h2 className="mb-3 mt-8 font-heading text-xl font-semibold text-tr-forest">Analítica y medición</h2>
        <p className={p}>No se carga Google Analytics. La aplicación registra eventos limitados del embudo en su propia base de datos para mostrar métricas agregadas en el panel; esos eventos no se envían a servicios de analítica de terceros. También mantiene un buffer local de depuración en el dispositivo.</p>
        <p className={`${p} mt-4`}><strong>Meta Pixel.</strong> Para medir la eficacia de sus campañas y mejorar la segmentación de los anuncios en Facebook e Instagram, el sitio carga el píxel de medición de Meta Platforms Ireland Limited (identificador 2175598836026526), únicamente en la versión de producción. El píxel registra las páginas visitadas y puede establecer cookies propias de Meta (por ejemplo, _fbp) y transmitir a Meta datos técnicos de la visita, como la URL de la página, el navegador o el tipo de dispositivo. Meta puede tratar estos datos fuera del Espacio Económico Europeo con las garantías previstas por la normativa (cláusulas contractuales tipo, cuando corresponda). Puedes obtener más información sobre estas cookies en la <a className="underline" href="https://www.facebook.com/policies/cookies/" target="_blank" rel="noopener noreferrer">política de cookies de Meta</a> y gestionar tus preferencias de anuncios desde la configuración de tu cuenta de Facebook o Instagram.</p>
        <p className={`${p} mt-4`}>Para consultas: <a className="underline" href="mailto:mcgnexus@gmail.com">mcgnexus@gmail.com</a>.</p>
        <p className="mt-10 border-t border-tr-line pt-5 text-small text-tr-muted"><Link className="underline" href="/privacidad">Privacidad</Link> · <Link className="underline" href="/aviso-legal">Aviso legal</Link> · <Link className="underline" href="/contacto">Contacto</Link></p>
      </article>
    </main>
  );
}
