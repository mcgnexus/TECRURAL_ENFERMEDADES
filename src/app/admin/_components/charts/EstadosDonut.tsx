"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { EstadoLead } from "@/types/lead";
import { COLOR, COLOR_ESTADO } from "../ui";

export interface DatoDonut {
  estado: EstadoLead;
  nombre: string;
  total: number;
}

/**
 * Reparto de leads por estado comercial.
 *
 * Al pulsar un sector se avisa al contenedor para que filtre la tabla de leads
 * (drill-down), de ahí el cursor de puntero y el `onSeleccion` opcional.
 */
export default function EstadosDonut({
  datos,
  onSeleccion,
}: {
  datos: DatoDonut[];
  onSeleccion?: (estado: EstadoLead) => void;
}) {
  const conDatos = datos.filter((d) => d.total > 0);
  if (conDatos.length === 0) {
    return <p className="text-caption text-tr-muted py-8 text-center">Sin leads todavía.</p>;
  }

  return (
    <div className="h-72 w-full" role="img" aria-label="Leads por estado comercial">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${COLOR.line}`,
              fontSize: 13,
              fontFamily: "var(--tr-font-body)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Pie
            data={conDatos}
            dataKey="total"
            nameKey="nombre"
            innerRadius={55}
            outerRadius={92}
            paddingAngle={2}
            onClick={(entrada) => {
              const dato = entrada as unknown as DatoDonut;
              if (dato?.estado) onSeleccion?.(dato.estado);
            }}
          >
            {conDatos.map((d) => (
              <Cell
                key={d.estado}
                fill={COLOR_ESTADO[d.estado]}
                cursor={onSeleccion ? "pointer" : "default"}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
