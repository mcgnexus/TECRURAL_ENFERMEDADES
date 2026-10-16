"use client";

import { useCallback, useEffect, useState } from "react";
import type { EstadoLead, LeadFila, MetricasCaptacion } from "@/types/lead";
import type { CuotaGlobal } from "@/lib/cuota";
import type { MetricasEmbudo, AccesosResumen } from "@/lib/database";

const CLAVE_TOKEN = "tr-admin-token";

/**
 * Estado y acceso a datos del panel.
 *
 * Concentra el token, la carga de leads/métricas/accesos y las mutaciones
 * (estado, notas y borrado) para que los componentes de pestaña solo se ocupen
 * de pintar. El token se guarda solo en `sessionStorage` de la pestaña, nunca en
 * el código ni en el bundle.
 */
export function usePanelAdmin() {
  const [token, setToken] = useState("");
  const [leads, setLeads] = useState<LeadFila[]>([]);
  const [metricas, setMetricas] = useState<MetricasCaptacion | null>(null);
  const [cuotas, setCuotas] = useState<CuotaGlobal | null>(null);
  const [embudo, setEmbudo] = useState<MetricasEmbudo | null>(null);
  const [accesos, setAccesos] = useState<AccesosResumen | null>(null);
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

  const guardarToken = useCallback((t: string) => {
    setToken(t);
    try {
      if (t) sessionStorage.setItem(CLAVE_TOKEN, t);
      else sessionStorage.removeItem(CLAVE_TOKEN);
    } catch {
      /* noop */
    }
  }, []);

  /** Recarga métricas, cuota, embudo y accesos (agregados del Resumen). */
  const cargarResumen = useCallback(async (t: string) => {
    const [resMetricas, resAccesos] = await Promise.all([
      fetch("/api/leads?metricas=1", { headers: { "x-admin-token": t } }),
      fetch("/api/leads?accesos=1", { headers: { "x-admin-token": t } }),
    ]);
    if (resMetricas.ok) {
      const d = await resMetricas.json();
      setMetricas(d.metricas ?? null);
      setCuotas(d.cuota ?? null);
      setEmbudo(d.embudo ?? null);
    }
    if (resAccesos.ok) {
      const d = await resAccesos.json();
      setAccesos(d.accesos ?? null);
    }
  }, []);

  const cargar = useCallback(
    async (tokenUsado?: string) => {
      const t = tokenUsado ?? token;
      if (!t) return;
      setCargando(true);
      setError(null);
      try {
        // Se piden hasta 500 leads y el filtrado/orden se hace en cliente: así
        // los gráficos y la tabla comparten datos y el drill-down es instantáneo.
        const response = await fetch("/api/leads?limit=500", {
          headers: { "x-admin-token": t },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo cargar");
        setLeads(data.leads ?? []);
        await cargarResumen(t);
        guardarToken(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setCargando(false);
      }
    },
    [token, cargarResumen, guardarToken]
  );

  const cambiarEstado = useCallback(
    async (id: string, estado: string) => {
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
        setLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, estado: estado as EstadoLead } : l))
        );
        void cargarResumen(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setActualizando(null);
      }
    },
    [token, cargarResumen]
  );

  const guardarNotas = useCallback(
    async (id: string, notas: string) => {
      if (!token) return;
      setActualizando(id);
      setError(null);
      try {
        const response = await fetch("/api/leads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-token": token },
          body: JSON.stringify({ id, notas }),
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
    },
    [token]
  );

  /**
   * Borra leads de forma definitiva. Devuelve `true` si la operación fue bien.
   * El llamador decide qué hacer con la selección y el diálogo.
   */
  const borrar = useCallback(
    async (ids: string[]): Promise<boolean> => {
      if (!token || ids.length === 0) return false;
      setActualizando(ids.join(","));
      setError(null);
      try {
        const response = await fetch("/api/leads", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "x-admin-token": token },
          body: JSON.stringify({ ids }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "No se pudo borrar");
        setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
        void cargarResumen(token);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
        return false;
      } finally {
        setActualizando(null);
      }
    },
    [token, cargarResumen]
  );

  return {
    token,
    guardarToken,
    leads,
    metricas,
    cuotas,
    embudo,
    accesos,
    cargando,
    error,
    actualizando,
    cargar,
    cambiarEstado,
    guardarNotas,
    borrar,
  };
}
