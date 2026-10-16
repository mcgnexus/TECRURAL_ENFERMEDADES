"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COLOR } from "../ui";

/** Punto de la serie temporal diaria, con las claves ya en español para el eje. */
export interface PuntoTendencia {
  dia: string;
  Visitantes: number;
  "Análisis": number;
  Leads: number;
}

/**
 * Tendencia temporal de visitas, análisis y leads.
 *
 * Las claves del objeto van en español porque Recharts las usa tal cual como
 * nombre de serie en la leyenda y en el tooltip; así no hace falta traducir.
 */
export default function TendenciaArea({ datos }: { datos: PuntoTendencia[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Tendencia diaria de visitas, análisis y leads">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gVisit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR.cyan} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLOR.cyan} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gAnalisis" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR.leaf} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLOR.leaf} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR.greenStrong} stopOpacity={0.45} />
              <stop offset="100%" stopColor={COLOR.greenStrong} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR.line} vertical={false} />
          <XAxis
            dataKey="dia"
            tick={{ fontSize: 11, fill: COLOR.muted }}
            tickLine={false}
            axisLine={{ stroke: COLOR.line }}
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 11, fill: COLOR.muted }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${COLOR.line}`,
              fontSize: 13,
              fontFamily: "var(--tr-font-body)",
            }}
            labelStyle={{ color: COLOR.forest, fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="Visitantes"
            stroke={COLOR.cyan}
            strokeWidth={2}
            fill="url(#gVisit)"
          />
          <Area
            type="monotone"
            dataKey="Análisis"
            stroke={COLOR.leaf}
            strokeWidth={2}
            fill="url(#gAnalisis)"
          />
          <Area
            type="monotone"
            dataKey="Leads"
            stroke={COLOR.greenStrong}
            strokeWidth={2}
            fill="url(#gLeads)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
