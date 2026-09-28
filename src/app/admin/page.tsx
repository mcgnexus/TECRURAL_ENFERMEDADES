"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ESTADOS_LEAD } from "@/types/lead";
import type { EstadoLead, LeadFila, MetricasCaptacion } from "@/types/lead";

const CLAVE_TOKEN = "tr-admin-token";

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 ";
const btnPrimary = `${btnBase} bg-tr-green-strong text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";
const inputCls = "w-full px-3 py-2.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink font-body text-body focus:border-tr-brand-green ";

const ESTADO_LABELS: Record<EstadoLead, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  cualificado: "Cualificado",
  presupuesto: "Presupuesto",
  ganado: "Ganado",
  perdido: "Perdido",
};

const ESTADO_COLORES: Record<EstadoLead, string> = {
  nuevo: "text-tr-cyan-text",
  contactado: "text-tr-warning-text",
  cualificado: "text-tr-green-strong",
  presupuesto: "text-tr-forest",
  ganado: "text-green-700",
  perdido: "text-red-600",
};

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pct(valor: number | null): string {
  return valor === null ? "—" : `${(valor * 100).toFixed(1)} %`;
}

function horasLegibles(horas: number | null): string {
  if (horas === null) return "—";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} días`;
}

function Tarjeta({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className={`flex-1 min-w-[150px] ${cardStyles} p-4`}>
      <p className="text-caption uppercase tracking-wide text-tr-muted">{etiqueta}</p>
      <p className="font-heading font-bold text-2xl text-tr-forest mt-1">{valor}</p>
      {detalle && <p className="text-caption text-tr-muted mt-0.5">{detalle}</p>}
    </div>
  );
}

/** Barras apiladas de los últimos 30 días: diagnósticos frente a leads. */
function SerieDiaria({ serie }: { serie: MetricasCaptacion["porDia"] }) {
  if (serie.length === 0) return null;
  const max = Math.max(1, ...serie.map((d) => Math.max(d.diagnosticos, d.leads)));

  return (
    <div>
      <div className="flex items-end gap-[2px] h-24" role="img" aria-label="Diagnósticos y leads por día">
        {serie.map((d) => (
          <div key={d.dia} className="flex-1 flex flex-col justify-end gap-[1px] group relative">
            <div
              className="bg-tr-lime rounded-t-[2px]"
              style={{ height: `${(d.diagnosticos / max) * 100}%` }}
              title={`${d.dia}: ${d.diagnosticos} diagnósticos`}
            />
            <div
              className="bg-tr-green-strong rounded-b-[2px]"
              style={{ height: `${(d.leads / max) * 100}%` }}
              title={`${d.dia}: ${d.leads} leads`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-caption text-tr-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-tr-lime" /> Diagnósticos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-tr-green-strong" /> Leads
        </span>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [leads, setLeads] = useState<LeadFila[]>([]);
  const [metricas, setMetricas] = useState<MetricasCaptacion | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [filtroEstado, setFiltroEstado] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState<string | null>(null);

  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(CLAVE_TOKEN);
      if (guardado) setToken(guardado);
    } catch {
      /* sin sessionStorage */
    }
  }, []);

  const cargar = async (tokenUsado?: string) => {
    const t = tokenUsado ?? token;
    if (!t) return;
    setCargando(true);
    setError(null);
    try {
      const query = filtroEstado ? `?estado=${encodeURIComponent(filtroEstado)}` : "";
      const response = await fetch(`/api/leads${query}`, {
        headers: { "x-admin-token": t },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo cargar");
      }
      setLeads(data.leads ?? []);
      setNotas(
        Object.fromEntries((data.leads ?? []).map((l: LeadFila) => [l.id, l.notas ?? ""]))
      );

      // Las métricas van en su propia petición: no dependen del filtro por
      // estado, que es para trabajar la cola, no para medir el embudo.
      const resMetricas = await fetch("/api/leads?metricas=1", {
        headers: { "x-admin-token": t },
      });
      if (resMetricas.ok) {
        const dMetricas = await resMetricas.json();
        setMetricas(dMetricas.metricas ?? null);
      }

      try {
        sessionStorage.setItem(CLAVE_TOKEN, t);
      } catch {
        /* noop */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCargando(false);
    }
  };

  const cambiarEstado = async (id: string, estado: string) => {
    if (!token) return;
    setActualizando(id);
    setError(null);
    try {
      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ id, estado }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar");
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, estado: estado as EstadoLead } : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setActualizando(null);
    }
  };

  const guardarNotas = async (id: string) => {
    if (!token) return;
    setActualizando(id);
    setError(null);
    try {
      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ id, notas: notas[id] ?? "" }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "No se pudo guardar la nota");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setActualizando(null);
    }
  };

  return (
    <main className="min-h-screen bg-tr-paper py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-tr-forest text-2xl">Gestión comercial</h1>
            <p className="text-tr-muted text-small mt-1">
              Herramienta interna protegida con ADMIN_TOKEN. El token se guarda solo en esta pestaña.
            </p>
          </div>
          <Link href="/" className={`${btnSecondary}`}>Volver</Link>
        </header>

        <div className={`p-4 ${cardStyles} mb-5`}>
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block font-body font-semibold text-tr-forest text-small mb-1.5" htmlFor="admin-token">
                Token de acceso
              </label>
              <input
                id="admin-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className={inputCls}
                placeholder="ADMIN_TOKEN"
                autoComplete="off"
              />
            </div>
            <div className="min-w-[140px]">
              <label className="block font-body font-semibold text-tr-forest text-small mb-1.5" htmlFor="admin-filtro">
                Filtro estado
              </label>
              <select
                id="admin-filtro"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className={inputCls}
              >
                <option value="">Todos</option>
                {ESTADOS_LEAD.map((e) => (
                  <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => cargar()}
              disabled={!token || cargando}
              className={`${btnPrimary} h-[42px]`}
            >
              {cargando ? "Cargando..." : "Cargar leads"}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-small text-tr-warning-text" role="alert">{error}</p>
          )}
        </div>

        {metricas && (
          <div className="mb-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Tarjeta
                etiqueta="Tasa de conversión"
                valor={pct(metricas.tasaConversion)}
                detalle={`${metricas.leads} leads / ${metricas.diagnosticos} diagnósticos`}
              />
              <Tarjeta
                etiqueta="Tiempo medio de respuesta"
                valor={horasLegibles(metricas.tiempoMedioRespuestaHoras)}
                detalle="desde la entrada del lead"
              />
              <Tarjeta
                etiqueta="Sin responder"
                valor={String(metricas.leadsSinResponder)}
                detalle="en estado «nuevo»"
              />
              <Tarjeta
                etiqueta="Consentimiento comercial"
                valor={pct(metricas.conversionComercial)}
                detalle="aceptan novedades por WhatsApp"
              />
            </div>

            <div className={`${cardStyles} p-4`}>
              <h2 className="font-heading font-semibold text-tr-forest text-small mb-3">
                Últimos 30 días
              </h2>
              <SerieDiaria serie={metricas.porDia} />
            </div>

            <div className="flex flex-wrap gap-5">
              <div className={`${cardStyles} p-4 flex-1 min-w-[220px]`}>
                <h3 className="font-heading font-semibold text-tr-forest text-small mb-2">
                  Reparto por estado
                </h3>
                {metricas.porEstado.length === 0 && (
                  <p className="text-caption text-tr-muted">Sin leads todavía.</p>
                )}
                {metricas.porEstado.map((e) => (
                  <p key={e.estado} className="text-small flex justify-between">
                    <span className={ESTADO_COLORES[e.estado]}>
                      {ESTADO_LABELS[e.estado] ?? e.estado}
                    </span>
                    <span className="text-tr-muted font-semibold">{e.total}</span>
                  </p>
                ))}
              </div>

              <div className={`${cardStyles} p-4 flex-1 min-w-[220px]`}>
                <h3 className="font-heading font-semibold text-tr-forest text-small mb-2">
                  Origen del lead
                </h3>
                {metricas.porOrigen.length === 0 && (
                  <p className="text-caption text-tr-muted">Sin datos.</p>
                )}
                {metricas.porOrigen.map((o) => (
                  <p key={o.origen} className="text-small flex justify-between">
                    <span className="text-tr-muted">
                      {o.origen === "post_diagnostico" ? "Tras diagnóstico" : "Contacto directo"}
                    </span>
                    <span className="text-tr-muted font-semibold">{o.total}</span>
                  </p>
                ))}
                {metricas.porPrioridad.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-tr-line">
                    <p className="text-caption text-tr-muted mb-1">Prioridad</p>
                    {metricas.porPrioridad.map((p) => (
                      <p key={p.prioridad} className="text-small flex justify-between">
                        <span className="text-tr-muted capitalize">{p.prioridad}</span>
                        <span className="text-tr-muted font-semibold">{p.total}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className={`${cardStyles} p-4 flex-1 min-w-[220px]`}>
                <h3 className="font-heading font-semibold text-tr-forest text-small mb-2">
                  Campañas
                </h3>
                {metricas.porCampana.length === 0 && (
                  <p className="text-caption text-tr-muted">
                    Ninguna lead trae UTM. Añade utm_source y utm_campaign al enlace para
                    atribuirlas.
                  </p>
                )}
                {metricas.porCampana.map((c) => (
                  <p key={c.campana} className="text-small flex justify-between">
                    <span className="text-tr-muted truncate">{c.campana}</span>
                    <span className="text-tr-muted font-semibold">{c.total}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {leads.length > 0 && (
          <div className={`${cardStyles} overflow-x-auto`}>
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-tr-line text-left text-caption text-tr-muted">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Prioridad</th>
                  <th className="px-3 py-2">Contacto</th>
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Origen</th>
                  <th className="px-3 py-2">Zona</th>
                  <th className="px-3 py-2">Cultivo</th>
                  <th className="px-3 py-2">Síntoma</th>
                  <th className="px-3 py-2">Comercial</th>
                  <th className="px-3 py-2">Campaña</th>
                  <th className="px-3 py-2">Respuesta</th>
                  <th className="px-3 py-2">Notas</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-tr-line last:border-0 align-top">
                    <td className="px-3 py-3 whitespace-nowrap text-tr-muted">{formatFecha(lead.created_at)}</td>
                    <td className="px-3 py-3">
                      <select
                        value={lead.estado}
                        onChange={(e) => cambiarEstado(lead.id, e.target.value)}
                        disabled={actualizando === lead.id}
                        className={`border border-tr-line rounded-[var(--tr-radius-control)] px-2 py-1 bg-tr-paper text-small font-semibold ${ESTADO_COLORES[lead.estado]}`}
                      >
                        {ESTADOS_LEAD.map((e) => (
                          <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`font-semibold ${
                        lead.prioridad === "alta" ? "text-red-600" : lead.prioridad === "media" ? "text-tr-warning-text" : "text-tr-muted"
                      }`}>
                        {lead.prioridad}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-tr-ink font-medium">{lead.nombre}</span>
                      <a href={`tel:${lead.telefono}`} className="block text-tr-green-strong hover:underline">{lead.telefono}</a>
                    </td>
                    <td className="px-3 py-3 text-tr-muted">
                      {lead.canal_contacto === "whatsapp" ? "WhatsApp" : lead.canal_contacto === "llamada" ? "Llamada" : "—"}
                    </td>
                    <td className="px-3 py-3 text-tr-muted">
                      {lead.origen === "post_diagnostico" ? "Diagnóstico" : "Contacto directo"}
                      {lead.diagnostico_id && (
                        <span className="block text-caption text-tr-muted">#{lead.diagnostico_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-tr-muted">{lead.municipio ?? "—"}</td>
                    <td className="px-3 py-3 text-tr-muted">{lead.cultivo ?? "—"}</td>
                    <td className="px-3 py-3 text-tr-muted">{lead.sintoma ?? "—"}</td>
                    <td className="px-3 py-3">
                      {lead.consentimiento_comercial ? (
                        <span className="text-tr-green-strong font-semibold">Sí</span>
                      ) : (
                        <span className="text-tr-muted">No</span>
                      )}
                      {lead.consentimiento_comercial && lead.consentimiento_texto_version && (
                        <span className="block text-caption text-tr-muted">{lead.consentimiento_texto_version}</span>
                      )}
                      {lead.baja_comercial && (
                        <span className="block text-caption text-red-600">BAJA</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-tr-muted">
                      {lead.utm_campaign ?? lead.origen_campana ?? "—"}
                      {lead.utm_source && <span className="block text-caption">src: {lead.utm_source}</span>}
                    </td>
                    <td className="px-3 py-3">
                      {lead.primera_response_at ? (
                        <span className="text-caption text-tr-muted">
                          {horasLegibles(
                            (new Date(lead.primera_response_at).getTime() - new Date(lead.created_at).getTime()) /
                              3600000
                          )}
                        </span>
                      ) : (
                        <span className="text-caption text-tr-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 min-w-[220px]">
                      <textarea
                        rows={2}
                        value={notas[lead.id] ?? ""}
                        onChange={(e) => setNotas((n) => ({ ...n, [lead.id]: e.target.value }))}
                        onBlur={() => guardarNotas(lead.id)}
                        disabled={actualizando === lead.id}
                        className="w-full px-2 py-1 border border-tr-line rounded-[var(--tr-radius-control)] bg-tr-paper text-tr-ink text-small resize-none"
                        placeholder="Nota interna"
                        aria-label={`Notas internas del lead ${lead.id}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cargando && leads.length === 0 && (
          <div className={`${cardStyles} p-8 text-center text-tr-muted`}>
            Introduce el token y pulsa «Cargar leads» para ver el listado.
          </div>
        )}
      </div>
    </main>
  );
}
