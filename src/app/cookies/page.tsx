import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Política de cookies", description: "Información sobre cookies y analítica en TecRural." };
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
        <p className={p}>La aplicación puede cargar Google Analytics cuando está configurada la variable de entorno <code>NEXT_PUBLIC_GA_ID</code> en producción. En ese caso se transmiten datos de uso a Google para medición. La implementación actual no muestra un mecanismo de consentimiento previo para analítica no esencial. Debe configurarse el consentimiento y completarse la información sobre cookies, proveedor, duración y transferencias antes de activar esa analítica para visitantes sujetos a consentimiento.</p>
        <p className={`${p} mt-4`}>No se puede afirmar que el sitio no use cookies o analítica sin comprobar la configuración activa del despliegue. Para consultas: <a className="underline" href="mailto:mcgnexus@gmail.com">mcgnexus@gmail.com</a>.</p>
        <p className="mt-10 border-t border-tr-line pt-5 text-small text-tr-muted"><Link className="underline" href="/privacidad">Privacidad</Link> · <Link className="underline" href="/aviso-legal">Aviso legal</Link> · <Link className="underline" href="/contacto">Contacto</Link></p>
      </article>
    </main>
  );
}
