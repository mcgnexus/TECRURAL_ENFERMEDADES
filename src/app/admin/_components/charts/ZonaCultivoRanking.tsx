"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COLOR } from "../ui";

const estiloTooltip = {
  borderRadius: 8,
  border: `1px solid ${COLOR.line}`,
  fontSize: 13,
  fontFamily: "var(--tr-font-body)",
} as const;

function RankingBarras({
  datos,
  color,
  onSeleccion,
  aria,
  vacio,
}: {
  datos: { nombre: string; total: number }[];
  color: string;
  onSeleccion?: (nombre: string) => void;
  aria: string;
  vacio: string;
}) {
  if (datos.length === 0) {
    return <p className="text-caption text-tr-muted py-8 text-center">{vacio}</p>;
  }
  // La altura crece con el número de filas para que las etiquetas no se apilen.
  const altura = Math.max(160, datos.length * 30 + 24);

  return (
    <div className="w-full" style={{ height: altura }} role="img" aria-label={aria}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR.line} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: COLOR.muted }}
            tickLine={false}
            axisLine={{ stroke: COLOR.line }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="nombre"
            tick={{ fontSize: 11, fill: COLOR.ink }}
            tickLine={false}
            axisLine={false}
            width={104}
          />
          <Tooltip contentStyle={estiloTooltip} cursor={{ fill: "rgba(215,230,161,0.25)" }} />
          <Bar
            dataKey="total"
            name="Leads"
            radius={[0, 6, 6, 0]}
            onClick={(entrada) => {
              const dato = entrada as unknown as { nombre?: string };
              if (dato?.nombre) onSeleccion?.(dato.nombre);
            }}
          >
            {datos.map((d) => (
              <Cell
                key={d.nombre}
                fill={color}
                cursor={onSeleccion ? "pointer" : "default"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ZonaCultivoRanking({
  municipios,
  cultivos,
  onMunicipio,
  onCultivo,
}: {
  municipios: { municipio: string; total: number }[];
  cultivos: { cultivo: string; total: number }[];
  onMunicipio?: (municipio: string) => void;
  onCultivo?: (cultivo: string) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="font-heading font-semibold text-tr-forest text-small mb-1">
          Zonas con más leads
        </h3>
        <RankingBarras
          datos={municipios.map((m) => ({ nombre: m.municipio, total: m.total }))}
          color={COLOR.brandGreen}
          onSeleccion={onMunicipio}
          aria="Leads por municipio"
          vacio="Sin municipios registrados."
        />
      </div>
      <div>
        <h3 className="font-heading font-semibold text-tr-forest text-small mb-1">
          Cultivos con más leads
        </h3>
        <RankingBarras
          datos={cultivos.map((c) => ({ nombre: c.cultivo, total: c.total }))}
          color={COLOR.cyan}
          onSeleccion={onCultivo}
          aria="Leads por cultivo"
          vacio="Sin cultivos registrados."
        />
      </div>
    </div>
  );
}
