import { obtenerHistorial } from "@/lib/database";
import { ORGANO_LABELS, TIPO_LABELS, GRAVEDAD_LABELS, nombreCorto, nivelSenal } from "@/lib/formato";
import { uidDeVisitante } from "@/lib/identidad";
import type { DiagnosticoWithMeta } from "@/types/diagnostico";
import Link from "next/link";
import { HistorialWrapper } from "@/components/PWA/HistorialWrapper";

export const metadata = {
  title: "Historial de análisis",
  description:
    "Consulta tus análisis fitosanitarios anteriores y el estado de las revisiones que has solicitado a TecRural.",
};

/** El historial es por visitante: la cookie httpOnly la emite el proxy en la
 * primera petición, así que aquí solo se lee. Sin ella no hay historial en vez
 * de mostrar el de los demás. */
async function getHistorial(): Promise<{ registros: DiagnosticoWithMeta[]; identificado: boolean }> {
  const uid = await uidDeVisitante();
  if (!uid) return { registros: [], identificado: false };
  try {
    return { registros: await obtenerHistorial(uid, 50), identificado: true };
  } catch {
    return { registros: [], identificado: true };
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

const badgeBase = "inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-semibold font-[var(--tr-font-body)]";
const badgeBlue = `${badgeBase} bg-tr-cyan/15 text-tr-cyan-text`;
const badgePurple = `${badgeBase} bg-purple-100 text-purple-800`;
const badgeGreen = `${badgeBase} bg-tr-lime text-tr-forest`;
const badgeYellow = `${badgeBase} bg-tr-warning/15 text-tr-warning-text`;
const badgeRed = `${badgeBase} bg-red-100 text-red-800`;
const badgeSecondary = `${badgeBase} bg-tr-paper text-tr-ink border border-tr-line`;
const badgeConfianza = `${badgeBase} bg-tr-cyan/15 text-tr-cyan-text`;

const SEVERITY_CLASSES = {
  leve: badgeGreen,
  moderada: badgeYellow,
  severa: badgeRed,
};

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold transition-all duration-200 ";
const btnPrimary = `${btnBase} bg-tr-green-strong text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

async function HistorialContent() {
  const { registros: historial, identificado } = await getHistorial();

  return (
    <main className="min-h-screen bg-tr-paper py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-tr-forest">Historial de análisis</h1>
            <p className="text-tr-muted mt-1 text-body">{historial.length} registros</p>
          </div>
          <Link href="/" className={`${btnPrimary} whitespace-nowrap`}>
            Nuevo análisis
          </Link>
        </header>

        {historial.length === 0 ? (
          <div className={`text-center py-12 ${cardStyles}`}>
            <svg className="mx-auto h-16 w-16 text-tr-line" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="mt-4 font-heading font-semibold text-tr-forest text-xl">No hay diagnósticos aún</h2>
            <p className="mt-2 text-tr-muted text-body">
              {identificado
                ? "Realiza tu primer análisis para ver el historial aquí"
                : "No hemos podido identificar este dispositivo, así que no podemos mostrarte un historial. Haz un análisis y vuelve a entrar."}
            </p>
            <Link href="/" className={`mt-6 ${btnPrimary} inline-flex`}>
              Hacer un análisis
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
                    <p className="font-heading font-bold text-lg text-tr-forest underline decoration-tr-lime decoration-4 underline-offset-4">
                      {item.diagnostico.tipo === "sano"
                        ? "Sin síntomas claros"
                        : nombreCorto(item.diagnostico.nombre)}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap my-2">
                      <span className={badgeBlue}>
                        {ORGANO_LABELS[item.organo_detectado] || item.organo_detectado}
                      </span>
                      <span className={badgePurple}>
                        {item.especie_identificada}
                      </span>
                      {item.nombre_planta && (
                        <span className={badgeSecondary}>
                          Indicada: {item.nombre_planta}
                        </span>
                      )}
                      <span className={badgeSecondary}>
                        {TIPO_LABELS[item.diagnostico.tipo] || item.diagnostico.tipo}
                      </span>
                      <span className={badgeConfianza}>
                        {nivelSenal(item.diagnostico.confianza).label}
                      </span>
                      <span className={SEVERITY_CLASSES[item.diagnostico.gravedad as keyof typeof SEVERITY_CLASSES] || badgeSecondary}>
                        Impacto: {GRAVEDAD_LABELS[item.diagnostico.gravedad] || item.diagnostico.gravedad}
                      </span>
                    </div>
                    <p className="text-body text-tr-ink line-clamp-2">{item.recomendacion}</p>
                    <p className="mt-2 text-caption text-tr-muted">
                      {item.created_at ? formatDate(item.created_at) : "Fecha desconocida"}
                    </p>
                  </div>
                  {item.imagen_url ? (
                    <img
                      src={item.imagen_url}
                      alt={`Diagnóstico ${item.especie_identificada}`}
                      className="w-20 h-20 object-cover rounded-[var(--tr-radius-control)] flex-shrink-0 border border-tr-line"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-[var(--tr-radius-control)] flex-shrink-0 border border-tr-line bg-tr-paper flex flex-col items-center justify-center text-tr-line" title="Foto no almacenada: solo se guarda si solicitas una revisión">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-caption text-tr-muted mt-1 px-1 text-center leading-tight">Sin foto guardada</span>
                    </div>
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