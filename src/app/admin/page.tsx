"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ESTADOS_LEAD } from "@/types/lead";
import type { EstadoLead, LeadFila, MetricasCaptacion } from "@/types/lead";
import type { CuotaGlobal } from "@/lib/cuota";
import type { MetricasEmbudo, AccesosResumen } from "@/lib/database";

const CLAVE_TOKEN = "tr-admin-token";

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold transition-all duration-200 ";
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

/**
 * Fotos de un lead.
 *
 * No se puede poner directamente `<img src="/api/leads/fotos?...">` porque la
 * ruta exige la cabecera x-admin-token, que un `<img>` no puede enviar. Se
 * piden con fetch y se convierten en un object URL.
 *
 * El object URL se revoca al desmontar: sin eso, cada foto abierta deja su
 * blob en memoria hasta que se recarga la página, y son varios megas por
 * fotografía de parcela.
 */
function FotosLead({ leadId, total, token }: { leadId: string; total: number; token: string }) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);

  useEffect(() => {
    if (!token || total === 0) return;
    let vivo = true;
    const creadas: string[] = [];

    (async () => {
      const nuevo: Record<number, string> = {};
      for (let i = 0; i < total; i++) {
        try {
          const r = await fetch(
            `/api/leads/fotos?lead=${encodeURIComponent(leadId)}&indice=${i}`,
            { headers: { "x-admin-token": token } }
          );
          if (!r.ok) continue;
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          creadas.push(url);
          nuevo[i] = url;
        } catch {
          /* una foto que falla no debe tumbar el resto */
        }
      }
      if (vivo) {
        setUrls(nuevo);
        setCargando(false);
        if (Object.keys(nuevo).length === 0) setError(true);
      }
    })();

    return () => {
      vivo = false;
      for (const url of creadas) URL.revokeObjectURL(url);
    };
  }, [leadId, total, token]);

  if (total === 0) return <span className="text-caption text-tr-muted">—</span>;

  return (
    <>
      {cargando ? (
        <span className="text-caption text-tr-muted">Cargando…</span>
      ) : error ? (
        <span className="text-caption text-tr-warning-text">No disponibles</span>
      ) : (
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(urls).map(([i, url]) => (
            <button
              key={i}
              type="button"
              onClick={() => setAbierta(Number(i))}
              className="w-14 h-14 rounded-[var(--tr-radius-control)] overflow-hidden border border-tr-line focus:ring"
              aria-label={`Abrir foto ${Number(i) + 1} del lead`}
            >
              <img src={url} alt={`Foto ${Number(i) + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {abierta !== null && urls[abierta] && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setAbierta(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${abierta + 1} del lead`}
        >
          <img
            src={urls[abierta]}
            alt={`Foto ${abierta + 1} a tamaño completo`}
            className="max-h-full max-w-full object-contain"
          />
          <button
            type="button"
            onClick={() => setAbierta(null)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white text-2xl leading-none hover:bg-white/25"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

/** Embudo paso a paso, con el abandono entre pasos. */
function EmbudoPanel({ embudo }: { embudo: MetricasEmbudo }) {
  const etiquetas: Record<string, string> = {
    portada_vista: "Llegan a la portada",
    captura_realizada: "Cargan una foto",
    analisis_iniciado: "Pulsan analizar",
    analisis_completado: "Reciben el análisis",
    resultado_visto: "Ven el resultado",
    cta_revision_abierto: "Abren el formulario",
    lead_enviado: "Envían el contacto",
  };

  if (embudo.visitas === 0) {
    return (
      <div className={`${cardStyles} p-5`}>
        <h2 className="font-heading font-semibold text-tr-forest text-small mb-2">
          Embudo de captación
        </h2>
        <p className="text-caption text-tr-muted">
          Todavía no hay visitas registradas. El contador empieza a llenarse en cuanto
          entre alguien por la portada.
        </p>
      </div>
    );
  }

  const max = Math.max(...embudo.pasos.map((p) => p.visitantes), 1);

  return (
    <div className={`${cardStyles} p-4`}>
      <h2 className="font-heading font-semibold text-tr-forest text-small mb-1">
        Embudo de captación
      </h2>
      <p className="text-caption text-tr-muted mb-3">
        Visitantes únicos por paso, últimos {embudo.dias} días.
      </p>

      <ol className="space-y-2">
        {embudo.pasos.map((p, i) => {
          const previo = i > 0 ? embudo.pasos[i - 1].visitantes : 0;
          const abandono =
            i > 0 && previo > 0
              ? Math.round((1 - p.visitantes / previo) * 100)
              : null;
          return (
            <li key={p.evento}>
              <div className="flex items-baseline justify-between gap-2 text-small">
                <span className="text-tr-muted">
                  {etiquetas[p.evento] ?? p.evento}
                </span>
                <span className="font-semibold text-tr-ink">
                  {p.visitantes}
                  {abandono !== null && abandono > 0 && (
                    <span className="ml-2 text-caption font-normal text-tr-warning-text">
                      −{abandono} % aquí
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-2.5 bg-tr-paper rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    i === 0
                      ? "bg-tr-cyan"
                      : p.visitantes === 0
                      ? "bg-tr-line"
                      : "bg-tr-brand-green"
                  }`}
                  style={{ width: `${(p.visitantes / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function formatCorto(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Vista de accesos.
 *
 * Se muestran dos listas independientes y así se explica: `eventos` guarda solo
 * el UUID anónimo del visitante, y las IPs solo existen en `cuotas` como clave
 * de rate-limit. No se pueden cruzar, y el panel no debe insinuar que sí.
 */
function AccesosPanel({ accesos }: { accesos: AccesosResumen }) {
  const etiquetas: Record<string, string> = {
    portada_vista: "Portada",
    captura_realizada: "Foto",
    analisis_iniciado: "Analizar",
    analisis_completado: "Análisis",
    analisis_error: "Error",
    resultado_visto: "Resultado",
    cta_revision_abierto: "Formulario",
    lead_enviado: "Contacto",
    lead_error: "Error contacto",
    whatsapp_click: "WhatsApp",
  };
  const maxDia = Math.max(1, ...accesos.porDia.map((d) => d.visitantes));

  return (
    <div className={`${cardStyles} p-4 space-y-5`}>
      <div>
        <h2 className="font-heading font-semibold text-tr-forest text-small mb-1">
          Accesos
        </h2>
        <p className="text-caption text-tr-muted">
          Últimos {accesos.dias} días. {accesos.totales.visitantes} visitantes anónimos,{" "}
          {accesos.totales.diagnosticos} análisis y {accesos.totales.leads} contactos. Las IPs
          van enmascaradas y proceden solo de la tabla de cuotas (rate-limit); no hay enlace
          entre visitante e IP.
        </p>
      </div>

      <div>
        <h3 className="font-heading font-semibold text-tr-forest text-small mb-2">
          Por día
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-tr-line text-left text-caption text-tr-muted">
                <th className="px-2 py-1.5">Día</th>
                <th className="px-2 py-1.5">Visitas</th>
                <th className="px-2 py-1.5">Análisis</th>
                <th className="px-2 py-1.5">Contactos</th>
              </tr>
            </thead>
            <tbody>
              {accesos.porDia.slice().reverse().map((d) => (
                <tr key={d.dia} className="border-b border-tr-line last:border-0">
                  <td className="px-2 py-1.5 text-tr-muted whitespace-nowrap">{d.dia}</td>
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-tr-ink w-6 text-right">{d.visitantes}</span>
                      <span className="h-2 rounded-full bg-tr-lime flex-1 max-w-[120px]">
                        <span
                          className="block h-2 rounded-full bg-tr-green-strong"
                          style={{ width: `${(d.visitantes / maxDia) * 100}%` }}
                        />
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-tr-muted">{d.diagnosticos}</td>
                  <td className="px-2 py-1.5 text-tr-muted">{d.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="font-heading font-semibold text-tr-forest text-small mb-2">
          Actividad por IP
        </h3>
        {accesos.ips.length === 0 ? (
          <p className="text-caption text-tr-muted">Sin registros de IP todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-tr-line text-left text-caption text-tr-muted">
                  <th className="px-2 py-1.5">IP</th>
                  <th className="px-2 py-1.5">Peticiones</th>
                  <th className="px-2 py-1.5">Días</th>
                  <th className="px-2 py-1.5">Primera</th>
                  <th className="px-2 py-1.5">Última</th>
                </tr>
              </thead>
              <tbody>
                {accesos.ips.map((ip) => (
                  <tr key={ip.ip} className="border-b border-tr-line last:border-0">
                    <td className="px-2 py-1.5 font-mono text-tr-ink whitespace-nowrap">
                      {ip.ip}
                      {ip.topada && (
                        <span className="ml-2 text-caption font-normal text-tr-warning-text">
                          tope
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-tr-muted">{ip.peticiones}</td>
                    <td className="px-2 py-1.5 text-tr-muted">{ip.dias}</td>
                    <td className="px-2 py-1.5 text-tr-muted whitespace-nowrap">{formatCorto(ip.primera)}</td>
                    <td className="px-2 py-1.5 text-tr-muted whitespace-nowrap">{formatCorto(ip.ultima)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-heading font-semibold text-tr-forest text-small mb-2">
          Visitantes anónimos
        </h3>
        {accesos.visitantes.length === 0 ? (
          <p className="text-caption text-tr-muted">Sin visitantes registrados todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-tr-line text-left text-caption text-tr-muted">
                  <th className="px-2 py-1.5">Visitante</th>
                  <th className="px-2 py-1.5">Primera</th>
                  <th className="px-2 py-1.5">Última</th>
                  <th className="px-2 py-1.5">Pasos</th>
                </tr>
              </thead>
              <tbody>
                {accesos.visitantes.map((v) => (
                  <tr key={v.id} className="border-b border-tr-line last:border-0">
                    <td className="px-2 py-1.5 font-mono text-tr-muted whitespace-nowrap">
                      {v.id.slice(0, 8)}
                    </td>
                    <td className="px-2 py-1.5 text-tr-muted whitespace-nowrap">{formatCorto(v.primera)}</td>
                    <td className="px-2 py-1.5 text-tr-muted whitespace-nowrap">{formatCorto(v.ultima)}</td>
                    <td className="px-2 py-1.5 text-tr-muted">
                      {v.pasos}
                      <span className="block text-caption">
                        {v.eventos.map((e) => etiquetas[e] ?? e).join(" · ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
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

/** Barras apiladas de los últimos 30 días: visitantes y leads. */
function SerieDiaria({ serie }: { serie: MetricasCaptacion["porDia"] }) {
  if (serie.length === 0) return null;
  const max = Math.max(1, ...serie.map((d) => Math.max(d.visitantes, d.leads)));

  return (
    <div>
      <div className="flex items-end gap-[2px] h-24" role="img" aria-label="Visitantes y leads por día">
        {serie.map((d) => (
          <div key={d.dia} className="flex-1 flex flex-col justify-end gap-[1px]">
            <div
              className="bg-tr-lime rounded-t-[2px]"
              style={{ height: `${(d.visitantes / max) * 100}%` }}
              title={`${d.dia}: ${d.visitantes} visitantes, ${d.diagnosticos} análisis`}
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
          <span className="w-2.5 h-2.5 rounded-sm bg-tr-lime" /> Visitantes
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
  const [cuotas, setCuotas] = useState<CuotaGlobal | null>(null);
  const [embudo, setEmbudo] = useState<MetricasEmbudo | null>(null);
  const [accesos, setAccesos] = useState<AccesosResumen | null>(null);
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
        setCuotas(dMetricas.cuota ?? null);
        setEmbudo(dMetricas.embudo ?? null);
      }

      const resAccesos = await fetch("/api/leads?accesos=1", {
        headers: { "x-admin-token": t },
      });
      if (resAccesos.ok) {
        const dAccesos = await resAccesos.json();
        setAccesos(dAccesos.accesos ?? null);
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
            <h1 className="font-heading font-bold text-tr-forest">Gestión comercial</h1>
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

        {metricas && embudo && (
          <div className="mb-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Tarjeta
                etiqueta="Visitas a la portada"
                valor={String(embudo.visitas)}
                detalle={`últimos ${embudo.dias} días`}
              />
              <Tarjeta
                etiqueta="Diagnósticos"
                valor={String(metricas.diagnosticos)}
                detalle={`${metricas.visitantes} visitantes distintos con análisis`}
              />
              <Tarjeta
                etiqueta="Visita → lead"
                valor={pct(embudo.tasaConversion)}
                detalle={`de ${embudo.visitas} visitas a la portada`}
              />
              <Tarjeta
                etiqueta="Leads"
                valor={String(metricas.leads)}
                detalle={`${
                  metricas.leadsPorDiagnostico === null
                    ? "sin análisis registrados"
                    : `${(metricas.leadsPorDiagnostico * 100).toFixed(0)} por cada 100 análisis`
                }`}
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
              {cuotas && (
                <Tarjeta
                  etiqueta="Consumo de IA hoy"
                  valor={`${cuotas.consumidos} / ${cuotas.limite}`}
                  detalle={`reinicia a las ${new Date(cuotas.resetsEn).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`}
                />
              )}
              <Tarjeta
                etiqueta="Consentimiento comercial"
                valor={pct(metricas.conversionComercial)}
                detalle="aceptan novedades por WhatsApp"
              />
            </div>

            <p className={`${cardStyles} p-3 text-caption text-tr-muted leading-relaxed`}>
              La conversión se mide sobre <strong>visitas a la portada</strong>, no sobre
              análisis. Antes el denominador eran los diagnósticos, así que las visitas que
              llegaban y se marchaban sin analizar no contaban en ninguna parte y la tasa
              podía exagerarse. Cada paso se cuenta por personas: un agricultor que sube
              seis fotos en un rato sigue siendo un visitante, no seis oportunidades. Los
              visitantes se identifican con una cookie propia de 180 días, sin registro ni
              cuenta: es anónimo, pero en un dispositivo compartido acumula lo de quien lo
              use antes. Se cuentan igualmente aunque el agricultor no acepte cookies de
              terceros, porque van en first party.
            </p>

            <EmbudoPanel embudo={embudo} />

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

        {accesos && (
          <div className="mb-5">
            <AccesosPanel accesos={accesos} />
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
                  <th className="px-3 py-2">Fotos</th>
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
                      <FotosLead leadId={lead.id} total={lead.num_imagenes} token={token} />
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
