import { obtenerHistorial } from "@/lib/database";
import type { DiagnosticoWithMeta } from "@/types/diagnostico";
import Link from "next/link";
import { HistorialWrapper } from "@/components/PWA/HistorialWrapper";

export const metadata = {
  title: "Historial | TECRURAL Diagnóstico",
  description: "Historial de diagnósticos fitosanitarios",
};

async function getHistorial(): Promise<DiagnosticoWithMeta[]> {
  try {
    return await obtenerHistorial("usuario_demo", 50);
  } catch {
    return [];
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TIPO_LABELS: Record<string, string> = {
  enfermedad: "Enfermedad",
  deficiencia_nutricional: "Deficiencia",
  plaga: "Plaga",
  sano: "Sano",
};

const ORGANO_LABELS: Record<string, string> = {
  hoja: "Hoja",
  flor: "Flor",
  fruto: "Fruto",
  tallo: "Tallo",
  planta_completa: "Planta completa",
};

const badgeBase = "inline-flex items-center px-2.5 py-0.5 rounded-full text-[var(--tr-text-caption)] font-semibold font-[var(--tr-font-body)]";
const badgeBlue = `${badgeBase} bg-tr-cyan/15 text-tr-cyan`;
const badgePurple = `${badgeBase} bg-purple-100 text-purple-800`;
const badgeGreen = `${badgeBase} bg-tr-lime text-tr-forest`;
const badgeYellow = `${badgeBase} bg-tr-warning/15 text-tr-warning`;
const badgeRed = `${badgeBase} bg-red-100 text-red-800`;
const badgeSecondary = `${badgeBase} bg-tr-paper text-tr-ink border border-tr-line`;
const badgeModel = `${badgeBase} bg-tr-cyan/15 text-tr-cyan`;

const SEVERITY_CLASSES = {
  leve: badgeGreen,
  moderada: badgeYellow,
  severa: badgeRed,
};

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-[var(--tr-focus)]";
const btnPrimary = `${btnBase} bg-tr-brand-green text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

async function HistorialContent() {
  const historial = await getHistorial();

  return (
    <main className="min-h-screen bg-tr-paper py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-tr-forest text-2xl">Historial de diagnósticos</h1>
            <p className="text-tr-muted mt-1 text-body">{historial.length} registros</p>
          </div>
          <Link href="/" className={`${btnPrimary} whitespace-nowrap`}>
            Nuevo diagnóstico
          </Link>
        </header>

        {historial.length === 0 ? (
          <div className={`text-center py-12 ${cardStyles}`}>
            <svg className="mx-auto h-16 w-16 text-tr-line" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="mt-4 font-heading font-semibold text-tr-forest text-xl">No hay diagnósticos aún</h2>
            <p className="mt-2 text-tr-muted text-body">Realiza tu primer análisis para ver el historial aquí</p>
            <Link href="/" className={`mt-6 ${btnPrimary} inline-flex`}>
              Hacer diagnóstico
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {historial.map((item) => (
              <article
                key={item.id}
                className={`${cardStyles} p-4 hover:shadow-[var(--tr-shadow-card)] transition-shadow border-tr-line`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={badgeBlue}>
                        {ORGANO_LABELS[item.organo_detectado] || item.organo_detectado}
                      </span>
                      <span className={badgePurple}>
                        {item.especie_identificada}
                      </span>
                      <span className={SEVERITY_CLASSES[item.diagnostico.gravedad as keyof typeof SEVERITY_CLASSES] || badgeSecondary}>
                        {TIPO_LABELS[item.diagnostico.tipo] || item.diagnostico.tipo}: {item.diagnostico.nombre}
                      </span>
                      {item.proveedor_usado && (
                        <span className={badgeModel}>
                          {item.proveedor_usado === "gemini" ? "Gemini 2.5 Flash" : "DeepSeek Chat"}
                        </span>
                      )}
                    </div>
                    <p className="text-body text-tr-ink line-clamp-2">{item.recomendacion}</p>
                    <p className="mt-2 text-caption text-tr-muted">
                      {item.created_at ? formatDate(item.created_at) : "Fecha desconocida"}
                    </p>
                  </div>
                  {item.imagen_url && (
                    <img
                      src={item.imagen_url}
                      alt={`Diagnóstico ${item.especie_identificada}`}
                      className="w-20 h-20 object-cover rounded-[var(--tr-radius-control)] flex-shrink-0 border border-tr-line"
                    />
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function HistorialPage() {
  return (
    <HistorialWrapper>
      <HistorialContent />
    </HistorialWrapper>
  );
}