import Link from "next/link";

const btnBase = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--tr-radius-control)] px-4 py-3 font-body font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tr-green-strong";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-tr-paper px-4 py-10">
      <section className="w-full max-w-md rounded-[var(--tr-radius-card)] border border-tr-line bg-tr-surface p-8 text-center shadow-[var(--tr-shadow-card)]">
        <p className="font-heading text-5xl font-bold text-tr-green-strong">404</p>
        <h1 className="mt-3 font-heading font-bold text-tr-forest">No encontramos esta página</h1>
        <p className="mt-3 text-body leading-relaxed text-tr-muted">
          Puede que el enlace esté incompleto o que la página ya no exista. Puedes volver al inicio,
          analizar una planta o contactar con TecRural.
        </p>
        <div className="mt-6 grid gap-3">
          <Link href="/" className={`${btnBase} bg-tr-green-strong text-white hover:bg-tr-forest`}>
            Volver al inicio
          </Link>
          <Link href="/" className={`${btnBase} border border-tr-line bg-tr-paper text-tr-forest hover:bg-tr-surface`}>
            Analizar una planta
          </Link>
        </div>
        <p className="mt-5 text-small text-tr-muted">
          ¿Necesitas ayuda?{" "}
          <Link href="/contacto" className="font-semibold text-tr-green-strong underline underline-offset-2 hover:no-underline">
            Contacta con TecRural
          </Link>
        </p>
      </section>
    </main>
  );
}
