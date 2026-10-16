import { ETIQUETAS_EMBUDO, formatNumero } from "../ui";
import type { MetricasEmbudo } from "@/lib/database";

/**
 * Embudo de captación, paso a paso.
 *
 * Se dibuja con barras propias y no con Recharts porque lo que hay que leer de
 * un vistazo es el abandono entre pasos (−X %), que en un gráfico de barras
 * genérico se perdería. Cada paso se mide por visitantes únicos.
 */
export default function EmbudoChart({ embudo }: { embudo: MetricasEmbudo }) {
  if (embudo.visitas === 0) {
    return (
      <p className="text-caption text-tr-muted py-6 text-center">
        Todavía no hay visitas registradas. El contador empieza a llenarse en cuanto
        entre alguien por la portada.
      </p>
    );
  }

  const max = Math.max(...embudo.pasos.map((p) => p.visitantes), 1);

  return (
    <ol className="space-y-2.5">
      {embudo.pasos.map((p, i) => {
        const previo = i > 0 ? embudo.pasos[i - 1].visitantes : 0;
        const abandono = i > 0 && previo > 0 ? Math.round((1 - p.visitantes / previo) * 100) : null;
        return (
          <li key={p.evento}>
            <div className="flex items-baseline justify-between gap-2 text-small">
              <span className="text-tr-muted">{ETIQUETAS_EMBUDO[p.evento] ?? p.evento}</span>
              <span className="font-semibold text-tr-ink">
                {formatNumero(p.visitantes)}
                {abandono !== null && abandono > 0 && (
                  <span className="ml-2 text-caption font-normal text-tr-warning-text">
                    −{abandono} % aquí
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2.5 bg-tr-paper rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  i === 0 ? "bg-tr-cyan" : p.visitantes === 0 ? "bg-tr-line" : "bg-tr-brand-green"
                }`}
                style={{ width: `${(p.visitantes / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
