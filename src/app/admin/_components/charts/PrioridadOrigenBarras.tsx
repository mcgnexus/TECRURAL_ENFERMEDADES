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
import type { OrigenLead, PrioridadLead } from "@/types/lead";
import { COLOR, COLOR_PRIORIDAD, ETIQUETAS_ORIGEN } from "../ui";

const PRIORIDAD_NOMBRE: Record<PrioridadLead, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const estiloTooltip = {
  borderRadius: 8,
  border: `1px solid ${COLOR.line}`,
  fontSize: 13,
  fontFamily: "var(--tr-font-body)",
} as const;

function BarraSimple({
  datos,
  colores,
  onSeleccion,
  aria,
}: {
  datos: { nombre: string; total: number; clave: string }[];
  colores: string[];
  onSeleccion?: (clave: string) => void;
  aria: string;
}) {
  return (
    <div className="h-56 w-full" role="img" aria-label={aria}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR.line} vertical={false} />
          <XAxis
            dataKey="nombre"
            tick={{ fontSize: 11, fill: COLOR.muted }}
            tickLine={false}
            axisLine={{ stroke: COLOR.line }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: COLOR.muted }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip contentStyle={estiloTooltip} />
          <Bar
            dataKey="total"
            name="Leads"
            radius={[6, 6, 0, 0]}
            onClick={(entrada) => {
              const dato = entrada as unknown as { clave?: string };
              if (dato?.clave) onSeleccion?.(dato.clave);
            }}
          >
            {datos.map((d, i) => (
              <Cell
                key={d.clave}
                fill={colores[i % colores.length]}
                cursor={onSeleccion ? "pointer" : "default"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PrioridadOrigenBarras({
  prioridad,
  origen,
  onPrioridad,
  onOrigen,
}: {
  prioridad: { prioridad: PrioridadLead; total: number }[];
  origen: { origen: OrigenLead; total: number }[];
  onPrioridad?: (prioridad: PrioridadLead) => void;
  onOrigen?: (origen: OrigenLead) => void;
}) {
  const datosPrioridad = prioridad.map((p) => ({
    nombre: PRIORIDAD_NOMBRE[p.prioridad] ?? p.prioridad,
    total: p.total,
    clave: p.prioridad,
  }));
  const datosOrigen = origen.map((o) => ({
    nombre: ETIQUETAS_ORIGEN[o.origen] ?? o.origen,
    total: o.total,
    clave: o.origen,
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="font-heading font-semibold text-tr-forest text-small mb-1">
          Por prioridad
        </h3>
        <BarraSimple
          datos={datosPrioridad}
          colores={[
            COLOR_PRIORIDAD.alta,
            COLOR_PRIORIDAD.media,
            COLOR_PRIORIDAD.baja,
          ]}
          onSeleccion={(clave) => onPrioridad?.(clave as PrioridadLead)}
          aria="Leads por prioridad"
        />
      </div>
      <div>
        <h3 className="font-heading font-semibold text-tr-forest text-small mb-1">
          Por origen
        </h3>
        <BarraSimple
          datos={datosOrigen}
          colores={[COLOR.brandGreen, COLOR.cyan]}
          onSeleccion={(clave) => onOrigen?.(clave as OrigenLead)}
          aria="Leads por origen"
        />
      </div>
    </div>
  );
}
