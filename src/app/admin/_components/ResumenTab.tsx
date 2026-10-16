"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { EstadoLead, MetricasCaptacion, OrigenLead, PrioridadLead } from "@/types/lead";
import type { CuotaGlobal } from "@/lib/cuota";
import type { MetricasEmbudo } from "@/lib/database";
import { KpiCard } from "./KpiCard";
import EmbudoChart from "./charts/EmbudoChart";
import CampanasTabla from "./charts/CampanasTabla";
import HoraDiaHeatmap from "./charts/HoraDiaHeatmap";
import {
  COLOR,
  ESTADO_LABELS,
  cardStyles,
  formatDia,
  formatNumero,
  horasLegibles,
  pct,
} from "./ui";
import type { PuntoTendencia } from "./charts/TendenciaArea";

// Los gráficos dependen de Recharts (usa el DOM y `ResizeObserver`): se cargan
// solo en el cliente para no romper el render en servidor ni la hidratación.
const TendenciaArea = dynamic(() => import("./charts/TendenciaArea"), {
  ssr: false,
  loading: () => <div className="h-72 rounded-[var(--tr-radius-card)] bg-tr-paper animate-pulse" />,
});
const EstadosDonut = dynamic(() => import("./charts/EstadosDonut"), {
  ssr: false,
  loading: () => <div className="h-72 rounded-[var(--tr-radius-card)] bg-tr-paper animate-pulse" />,
});
const PrioridadOrigenBarras = dynamic(() => import("./charts/PrioridadOrigenBarras"), {
  ssr: false,
});
const ZonaCultivoRanking = dynamic(() => import("./charts/ZonaCultivoRanking"), {
  ssr: false,
});

export interface DrillDown {
  estado: (estado: EstadoLead) => void;
  prioridad: (prioridad: PrioridadLead) => void;
  origen: (origen: OrigenLead) => void;
  municipio: (municipio: string) => void;
  cultivo: (cultivo: string) => void;
  campana: (campana: string) => void;
}

const RANGOS = [7, 30, 90] as const;

export function ResumenTab({
  metricas,
  cuotas,
  embudo,
  drill,
}: {
  metricas: MetricasCaptacion;
  cuotas: CuotaGlobal | null;
  embudo: MetricasEmbudo;
  drill: DrillDown;
}) {
  const [rango, setRango] = useState<(typeof RANGOS)[number]>(30);

  const tendencia: PuntoTendencia[] = useMemo(
    () =>
      metricas.porDia.slice(-rango).map((d) => ({
        dia: formatDia(d.dia),
        Visitantes: d.visitantes,
        "Análisis": d.diagnosticos,
        Leads: d.leads,
      })),
    [metricas.porDia, rango]
  );

  const donut = metricas.porEstado.map((e) => ({
    estado: e.estado,
    nombre: ESTADO_LABELS[e.estado] ?? e.estado,
    total: e.total,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <KpiCard
          etiqueta="Visitas a la portada"
          valor={formatNumero(embudo.visitas)}
          detalle={`últimos ${embudo.dias} días`}
          acento={COLOR.cyan}
        />
        <KpiCard
          etiqueta="Diagnósticos"
          valor={formatNumero(metricas.diagnosticos)}
          detalle={`${formatNumero(metricas.visitantes)} visitantes distintos`}
          acento={COLOR.leaf}
        />
        <KpiCard
          etiqueta="Visita → lead"
          valor={pct(embudo.tasaConversion)}
          detalle={`de ${formatNumero(embudo.visitas)} visitas`}
          acento={COLOR.greenStrong}
        />
        <KpiCard
          etiqueta="Leads"
          valor={formatNumero(metricas.leads)}
          detalle={
            metricas.leadsPorDiagnostico === null
              ? "sin análisis registrados"
              : `${(metricas.leadsPorDiagnostico * 100).toFixed(0)} por cada 100 análisis`
          }
          acento={COLOR.forest}
        />
        <KpiCard
          etiqueta="Tiempo medio de respuesta"
          valor={horasLegibles(metricas.tiempoMedioRespuestaHoras)}
          detalle="desde la entrada del lead"
          acento={COLOR.warning}
        />
        <KpiCard
          etiqueta="Sin responder"
          valor={formatNumero(metricas.leadsSinResponder)}
          detalle="en estado «nuevo»"
          acento={COLOR.perdido}
        />
        {cuotas && (
          <KpiCard
            etiqueta="Consumo de IA hoy"
            valor={`${cuotas.consumidos} / ${cuotas.limite}`}
            detalle={`próximo uso: ${new Date(cuotas.resetsEn).toLocaleString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}`}
            acento={COLOR.cyanText}
          />
        )}
        <KpiCard
          etiqueta="Consentimiento comercial"
          valor={pct(metricas.conversionComercial)}
          detalle="aceptan novedades por WhatsApp"
          acento={COLOR.leaf}
        />
      </div>

      <details className={`${cardStyles} p-3 text-caption text-tr-muted leading-relaxed`}>
        <summary className="cursor-pointer font-semibold text-tr-forest text-small">
          Cómo se miden estas cifras
        </summary>
        <p className="mt-2">
          La conversión se mide sobre <strong>visitas a la portada</strong>, no sobre análisis.
          Antes el denominador eran los diagnósticos, así que las visitas que llegaban y se
          marchaban sin analizar no contaban en ninguna parte y la tasa podía exagerarse. Cada
          paso se cuenta por personas: un agricultor que sube seis fotos en un rato sigue siendo
          un visitante, no seis oportunidades. Los visitantes se identifican con una cookie
          propia de 180 días, sin registro ni cuenta: es anónimo, pero en un dispositivo
          compartido acumula lo de quien lo use antes. Se cuentan igualmente aunque el agricultor
          no acepte cookies de terceros, porque van en first party.
        </p>
      </details>

      <div className={`${cardStyles} p-4`}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-heading font-semibold text-tr-forest text-small">
            Tendencia: visitas, análisis y leads
          </h2>
          <div className="inline-flex rounded-[var(--tr-radius-control)] border border-tr-line overflow-hidden">
            {RANGOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRango(r)}
                aria-pressed={rango === r}
                className={`px-3 py-1.5 text-caption font-semibold ${
                  rango === r
                    ? "bg-tr-green-strong text-white"
                    : "bg-tr-surface text-tr-muted hover:bg-tr-paper"
                }`}
              >
                {r} días
              </button>
            ))}
          </div>
        </div>
        <TendenciaArea datos={tendencia} />
      </div>

      <div className={`${cardStyles} p-4`}>
        <h2 className="font-heading font-semibold text-tr-forest text-small mb-1">
          Embudo de captación
        </h2>
        <p className="text-caption text-tr-muted mb-3">
          Visitantes únicos por paso, últimos {embudo.dias} días.
        </p>
        <EmbudoChart embudo={embudo} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${cardStyles} p-4`}>
          <h2 className="font-heading font-semibold text-tr-forest text-small mb-1">
            Leads por estado
          </h2>
          <p className="text-caption text-tr-muted mb-2">
            Pulsa un sector para filtrar la tabla de leads.
          </p>
          <EstadosDonut datos={donut} onSeleccion={drill.estado} />
        </div>
        <div className={`${cardStyles} p-4`}>
          <h2 className="font-heading font-semibold text-tr-forest text-small mb-3">
            Prioridad y origen
          </h2>
          <PrioridadOrigenBarras
            prioridad={metricas.porPrioridad}
            origen={metricas.porOrigen}
            onPrioridad={drill.prioridad}
            onOrigen={drill.origen}
          />
        </div>
      </div>

      <div className={`${cardStyles} p-4`}>
        <h2 className="font-heading font-semibold text-tr-forest text-small mb-1">
          Dónde están los leads
        </h2>
        <p className="text-caption text-tr-muted mb-3">
          Últimos {metricas.porDia.length} días. Pulsa una barra para filtrar por esa zona o
          cultivo.
        </p>
        <ZonaCultivoRanking
          municipios={metricas.porMunicipio}
          cultivos={metricas.porCultivo}
          onMunicipio={drill.municipio}
          onCultivo={drill.cultivo}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${cardStyles} p-4`}>
          <h2 className="font-heading font-semibold text-tr-forest text-small mb-3">
            Campañas / UTM
          </h2>
          <CampanasTabla campanas={metricas.porCampana} onSeleccion={drill.campana} />
        </div>
        <div className={`${cardStyles} p-4`}>
          <h2 className="font-heading font-semibold text-tr-forest text-small mb-1">
            Cuándo entran los leads
          </h2>
          <p className="text-caption text-tr-muted mb-3">
            Hora local (Europe/Madrid) en los últimos {metricas.porDia.length} días.
          </p>
          <HoraDiaHeatmap datos={metricas.porHoraDia} />
        </div>
      </div>

      {metricas.porCanal.length > 0 && (
        <div className={`${cardStyles} p-4`}>
          <h2 className="font-heading font-semibold text-tr-forest text-small mb-2">
            Canal de contacto solicitado
          </h2>
          <div className="flex flex-wrap gap-4">
            {metricas.porCanal.map((c) => (
              <div key={c.canal} className="flex items-baseline gap-2">
                <span className="font-heading font-bold text-xl text-tr-forest">
                  {formatNumero(c.total)}
                </span>
                <span className="text-small text-tr-muted capitalize">{c.canal}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
