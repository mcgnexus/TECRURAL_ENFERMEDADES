import { COLOR } from "../ui";

const FILAS = [
  { dow: 1, nombre: "Lun" },
  { dow: 2, nombre: "Mar" },
  { dow: 3, nombre: "Mié" },
  { dow: 4, nombre: "Jue" },
  { dow: 5, nombre: "Vie" },
  { dow: 6, nombre: "Sáb" },
  { dow: 0, nombre: "Dom" },
];

/**
 * Mapa de calor de llegada de leads: día de la semana × hora local (Europe/Madrid).
 *
 * Sirve para decidir horarios de atención. Se pinta con divs y no con Recharts
 * porque una cuadrícula 7×24 no es el terreno natural de un gráfico de barras.
 */
export default function HoraDiaHeatmap({
  datos,
}: {
  datos: { dow: number; hora: number; total: number }[];
}) {
  const matriz = new Map<string, number>();
  let max = 0;
  for (const d of datos) {
    matriz.set(`${d.dow}-${d.hora}`, d.total);
    if (d.total > max) max = d.total;
  }

  if (max === 0) {
    return (
      <p className="text-caption text-tr-muted py-6 text-center">
        Sin leads en el periodo para dibujar el mapa de actividad.
      </p>
    );
  }

  const color = (valor: number) => {
    if (valor === 0) return COLOR.line;
    // Escala simple sobre el verde de marca: más leads, más opaco.
    const intensidad = 0.15 + 0.85 * (valor / max);
    return `rgba(23, 122, 68, ${intensidad.toFixed(2)})`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="flex">
          <div className="w-10 shrink-0" />
          <div className="flex-1 grid grid-cols-24 gap-[2px]">
            {Array.from({ length: 24 }, (_, h) => (
              <span
                key={h}
                className="text-center text-[10px] leading-4 text-tr-muted"
                aria-hidden="true"
              >
                {h % 3 === 0 ? h : ""}
              </span>
            ))}
          </div>
        </div>

        {FILAS.map((fila) => (
          <div key={fila.dow} className="flex items-center">
            <span className="w-10 shrink-0 text-caption text-tr-muted">{fila.nombre}</span>
            <div className="flex-1 grid grid-cols-24 gap-[2px] py-[1px]">
              {Array.from({ length: 24 }, (_, h) => {
                const valor = matriz.get(`${fila.dow}-${h}`) ?? 0;
                return (
                  <div
                    key={h}
                    className="h-5 rounded-[3px]"
                    style={{ backgroundColor: color(valor) }}
                    title={`${fila.nombre} ${String(h).padStart(2, "0")}:00 — ${valor} lead${
                      valor === 1 ? "" : "s"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 mt-3 pl-10">
          <span className="text-caption text-tr-muted">Menos</span>
          {[0.15, 0.4, 0.65, 1].map((i) => (
            <span
              key={i}
              className="w-4 h-3 rounded-[3px]"
              style={{ backgroundColor: `rgba(23, 122, 68, ${i})` }}
            />
          ))}
          <span className="text-caption text-tr-muted">Más</span>
        </div>
      </div>
    </div>
  );
}
