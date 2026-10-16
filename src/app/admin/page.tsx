"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { EstadoLead, OrigenLead, PrioridadLead } from "@/types/lead";
import { usePanelAdmin } from "./_components/usePanelAdmin";
import { ResumenTab } from "./_components/ResumenTab";
import { LeadsTab } from "./_components/LeadsTab";
import { DiagnosticosTab } from "./_components/DiagnosticosTab";
import { AccesosTab } from "./_components/AccesosTab";
import { FILTROS_VACIOS, ORDEN_POR_DEFECTO } from "./_components/filtros";
import type { Filtros, Orden } from "./_components/filtros";
import { btnPrimary, btnSecondary, cardStyles, inputCls } from "./_components/ui";

type Pestana = "resumen" | "leads" | "diagnosticos" | "accesos";

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: "resumen", nombre: "Resumen" },
  { id: "leads", nombre: "Leads" },
  { id: "diagnosticos", nombre: "Diagnósticos" },
  { id: "accesos", nombre: "Accesos" },
];

export default function AdminPage() {
  const panel = usePanelAdmin();
  const [pestana, setPestana] = useState<Pestana>("resumen");
  const [filtros, setFiltros] = useState<Filtros>({ ...FILTROS_VACIOS });
  const [orden, setOrden] = useState<Orden>(ORDEN_POR_DEFECTO);

  // La pestaña vive también en el hash para que un enlace directo (#leads)
  // abra la sección pedida.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as Pestana;
    if (PESTANAS.some((p) => p.id === hash)) setPestana(hash);
  }, []);

  const cambiarPestana = (id: Pestana) => {
    setPestana(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  /** Drill-down: aplica un filtro y salta a la pestaña de leads. */
  const irALeads = useCallback((parcial: Partial<Filtros>) => {
    setFiltros((prev) => ({ ...prev, ...parcial }));
    setPestana("leads");
    if (typeof window !== "undefined") window.history.replaceState(null, "", "#leads");
  }, []);

  const hayDatos = panel.leads.length > 0 || panel.metricas !== null;

  return (
    <main className="min-h-screen bg-tr-paper py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-tr-forest">Gestión comercial</h1>
            <p className="text-tr-muted text-small mt-1">
              Panel interno protegido con ADMIN_TOKEN. El token se guarda solo en esta pestaña.
            </p>
          </div>
          <Link href="/" className={btnSecondary}>
            Volver
          </Link>
        </header>

        <div className={`p-4 ${cardStyles} mb-5`}>
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label
                className="block font-body font-semibold text-tr-forest text-small mb-1.5"
                htmlFor="admin-token"
              >
                Token de acceso
              </label>
              <input
                id="admin-token"
                type="password"
                value={panel.token}
                onChange={(e) => panel.guardarToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && panel.token) panel.cargar();
                }}
                className={inputCls}
                placeholder="ADMIN_TOKEN"
                autoComplete="off"
              />
            </div>
            <button
              onClick={() => panel.cargar()}
              disabled={!panel.token || panel.cargando}
              className={`${btnPrimary} h-[42px]`}
            >
              {panel.cargando ? "Cargando…" : hayDatos ? "Actualizar" : "Cargar datos"}
            </button>
          </div>
          {panel.error && (
            <p className="mt-3 text-small text-tr-warning-text" role="alert">
              {panel.error}
            </p>
          )}
        </div>

        {hayDatos ? (
          <>
            <nav
              className="flex gap-1 border-b border-tr-line mb-5 overflow-x-auto"
              aria-label="Secciones del panel"
            >
              {PESTANAS.map((p) => {
                const activa = pestana === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => cambiarPestana(p.id)}
                    aria-current={activa ? "page" : undefined}
                    className={`px-4 py-2.5 text-small font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                      activa
                        ? "border-tr-green-strong text-tr-forest"
                        : "border-transparent text-tr-muted hover:text-tr-ink"
                    }`}
                  >
                    {p.nombre}
                    {p.id === "leads" && panel.leads.length > 0 && (
                      <span className="ml-2 text-caption rounded-full bg-tr-lime text-tr-forest px-1.5 py-0.5">
                        {panel.leads.length}
                      </span>
                    )}
                    {p.id === "diagnosticos" &&
                      (panel.diagnosticos?.totales.diagnosticos ?? 0) > 0 && (
                        <span className="ml-2 text-caption rounded-full bg-tr-lime text-tr-forest px-1.5 py-0.5">
                          {panel.diagnosticos?.totales.diagnosticos}
                        </span>
                      )}
                  </button>
                );
              })}
            </nav>

            {pestana === "resumen" && (
              <>
                {panel.metricas && panel.embudo ? (
                  <ResumenTab
                    metricas={panel.metricas}
                    cuotas={panel.cuotas}
                    embudo={panel.embudo}
                    drill={{
                      estado: (estado: EstadoLead) => irALeads({ estado }),
                      prioridad: (prioridad: PrioridadLead) => irALeads({ prioridad }),
                      origen: (origen: OrigenLead) => irALeads({ origen }),
                      municipio: (municipio: string) => irALeads({ municipio }),
                      cultivo: (cultivo: string) => irALeads({ cultivo }),
                      campana: (campana: string) => irALeads({ campana }),
                    }}
                  />
                ) : (
                  <div className={`${cardStyles} p-6 text-center text-tr-muted`}>
                    Cargando métricas…
                  </div>
                )}
              </>
            )}

            {pestana === "leads" && (
              <LeadsTab
                leads={panel.leads}
                token={panel.token}
                filtros={filtros}
                setFiltros={setFiltros}
                orden={orden}
                setOrden={setOrden}
                actualizando={panel.actualizando}
                onCambiarEstado={panel.cambiarEstado}
                onGuardarNotas={panel.guardarNotas}
                onBorrar={panel.borrar}
              />
            )}

            {pestana === "diagnosticos" && (
              <>
                {panel.diagnosticos ? (
                  <DiagnosticosTab datos={panel.diagnosticos} />
                ) : (
                  <div className={`${cardStyles} p-6 text-center text-tr-muted`}>
                    Cargando diagnósticos…
                  </div>
                )}
              </>
            )}

            {pestana === "accesos" && (
              <>
                {panel.accesos ? (
                  <AccesosTab accesos={panel.accesos} />
                ) : (
                  <div className={`${cardStyles} p-6 text-center text-tr-muted`}>
                    Cargando accesos…
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className={`${cardStyles} p-8 text-center text-tr-muted`}>
            Introduce el token y pulsa «Cargar datos» para ver el panel.
          </div>
        )}
      </div>
    </main>
  );
}
