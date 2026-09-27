"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ESTADOS_LEAD } from "@/types/lead";
import type { EstadoLead, LeadFila } from "@/types/lead";

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

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [leads, setLeads] = useState<LeadFila[]>([]);
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
