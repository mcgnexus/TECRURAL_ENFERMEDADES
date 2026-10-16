import { cardStyles } from "./ui";

export function KpiCard({
  etiqueta,
  valor,
  detalle,
  acento,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  /** Color de la barra superior; por defecto, verde de marca. */
  acento?: string;
}) {
  return (
    <div className={`flex-1 min-w-[150px] ${cardStyles} p-4 overflow-hidden`}>
      <div
        className="h-1 -mx-4 -mt-4 mb-3"
        style={{ backgroundColor: acento ?? "var(--tr-brand-green)" }}
        aria-hidden="true"
      />
      <p className="text-caption uppercase tracking-wide text-tr-muted">{etiqueta}</p>
      <p className="font-heading font-bold text-2xl text-tr-forest mt-1">{valor}</p>
      {detalle && <p className="text-caption text-tr-muted mt-0.5">{detalle}</p>}
    </div>
  );
}
