import type { Metadata } from "next";
import Link from "next/link";
import { resolverEnlaceInforme } from "@/lib/database";
import { Results } from "@/components/Results";
import { IDENTIDAD } from "@/lib/textos-publicos";
import type { DiagnosticoWithMeta } from "@/types/diagnostico";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Informe de TecRural",
  description: "Informe guardado de un análisis de cultivo.",
  robots: { index: false, follow: false },
};

const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;

const card = "rounded-[var(--tr-radius-card)] border border-tr-line bg-tr-surface shadow-[var(--tr-shadow-card)]";

/**
 * El informe es el único dato que debe llegar al componente cliente. En
 * particular no se envía `usuario_id`: la cookie de visitante es la credencial
 * de propiedad del historial y no puede acabar serializada en el HTML.
 */
function informePublico(diagnostico: DiagnosticoWithMeta): DiagnosticoWithMeta {
  const copia = { ...diagnostico };
  delete copia.usuario_id;
  delete copia.feedback_usuario;
  delete copia.imagen_url;
  return copia;
}

function EnlaceNoValido() {
  return (
    <main className="min-h-screen bg-tr-paper px-4 py-12">
      <div className={`mx-auto max-w-xl p-6 text-center sm:p-8 ${card}`}>
        <h1 className="font-heading text-2xl font-bold text-tr-forest">
          Enlace no válido o caducado
        </h1>
        <p className="mt-3 text-body leading-relaxed text-tr-muted">
          Puedes hacer un análisis nuevo o contactar con TecRural si necesitas ayuda.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--tr-radius-control)] bg-tr-green-strong px-4 py-3 font-semibold text-white hover:bg-tr-forest"
          >
            Hacer un análisis
          </Link>
          <a
            href={`mailto:${IDENTIDAD.correo}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--tr-radius-control)] border border-tr-line px-4 py-3 font-semibold text-tr-ink hover:bg-tr-paper"
          >
            Contactar
          </a>
        </div>
      </div>
    </main>
  );
}

export default async function InformeRecuperadoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return <EnlaceNoValido />;

  let diagnostico = null;
  try {
    diagnostico = await resolverEnlaceInforme(token);
  } catch {
    // Un fallo de infraestructura no es un enlace caducado: se deja subir al
    // error boundary para responder 5xx y no convencer al usuario de que su
    // enlace ya no sirve cuando solo hay una caída temporal.
    throw new Error("No se pudo consultar el enlace del informe");
  }

  if (!diagnostico) return <EnlaceNoValido />;

  const informe = informePublico(diagnostico);

  return (
    <main className="min-h-screen bg-tr-paper px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5">
          <p className="text-caption font-semibold uppercase tracking-wide text-tr-green-strong">
            Informe guardado
          </p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-tr-forest">
            Tu informe de TecRural
          </h1>
          <p className="mt-2 text-small leading-relaxed text-tr-muted">
            Este enlace es personal y caduca a los 90 días. Puedes guardar el informe en PDF
            desde esta misma página.
          </p>
        </header>

        <div className={`mb-5 p-4 ${card}`}>
          <p className="text-small leading-relaxed text-tr-muted">
            <span className="font-semibold text-tr-ink">La foto que subiste no se conserva.</span>{" "}
            Este es el informe guardado del análisis; la imagen original no forma parte de él.
          </p>
        </div>

        <Results
          diagnostico={informe}
          imagenPreview=""
          contextoUsuario={informe.contexto_usuario}
          recuperacion
        />
      </div>
    </main>
  );
}
