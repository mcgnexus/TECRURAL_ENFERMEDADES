"use client";

import { formatNumero } from "../ui";

/** Tabla de campañas/UTM, con filas pulsables para filtrar la tabla de leads. */
export default function CampanasTabla({
  campanas,
  onSeleccion,
}: {
  campanas: { campana: string; total: number }[];
  onSeleccion?: (campana: string) => void;
}) {
  if (campanas.length === 0) {
    return (
      <p className="text-caption text-tr-muted py-6 text-center">
        Ningún lead trae UTM. Añade <span className="font-mono">utm_source</span> y{" "}
        <span className="font-mono">utm_campaign</span> al enlace para atribuirlas.
      </p>
    );
  }

  const max = Math.max(1, ...campanas.map((c) => c.total));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-small">
        <thead>
          <tr className="border-b border-tr-line text-left text-caption text-tr-muted">
            <th className="px-2 py-1.5">Campaña</th>
            <th className="px-2 py-1.5">Leads</th>
          </tr>
        </thead>
        <tbody>
          {campanas.map((c) => (
            <tr
              key={c.campana}
              onClick={() => onSeleccion?.(c.campana)}
              className={`border-b border-tr-line last:border-0 ${
                onSeleccion ? "cursor-pointer hover:bg-tr-paper" : ""
              }`}
            >
              <td className="px-2 py-2 text-tr-ink truncate max-w-[220px]" title={c.campana}>
                {c.campana}
              </td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-tr-ink w-8 text-right">
                    {formatNumero(c.total)}
                  </span>
                  <span className="h-2 rounded-full bg-tr-paper flex-1 max-w-[160px]">
                    <span
                      className="block h-2 rounded-full bg-tr-brand-green"
                      style={{ width: `${(c.total / max) * 100}%` }}
                    />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
