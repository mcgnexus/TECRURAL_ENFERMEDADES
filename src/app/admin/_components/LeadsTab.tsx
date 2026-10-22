"use client";

import { useEffect, useMemo, useState } from "react";
import { ESTADOS_LEAD } from "@/types/lead";
import type { LeadFila } from "@/types/lead";
import { FotosLead } from "./FotosLead";
import { BorrarLeadDialog } from "./BorrarLeadDialog";
import {
  FILTROS_VACIOS,
  aplicarFiltros,
  campanasUnicas,
  hayFiltrosActivos,
  horasRespuesta,
  opcionesUnicas,
  ordenarLeads,
  paginar,
} from "./filtros";
import type { CampoOrden, Filtros, Orden } from "./filtros";
import {
  COLOR_PRIORIDAD,
  ESTADO_COLORES,
  ESTADO_LABELS,
  ETIQUETAS_ORIGEN,
  btnDanger,
  btnMini,
  cardStyles,
  etiquetaCanal,
  formatFecha,
  formatNumero,
  horasLegibles,
  inputMini,
} from "./ui";

const OPCIONES_POR_PAGINA = [25, 50, 100];

function ThOrden({
  campo,
  orden,
  setOrden,
  children,
}: {
  campo: CampoOrden;
  orden: Orden;
  setOrden: (o: Orden) => void;
  children: React.ReactNode;
}) {
  const activo = orden.campo === campo;
  return (
    <th className="px-3 py-2 whitespace-nowrap">
      <button
        type="button"
        onClick={() =>
          setOrden(
            activo
              ? { campo, dir: orden.dir === "asc" ? "desc" : "asc" }
              : { campo, dir: "desc" }
          )
        }
        className={`inline-flex items-center gap-1 font-semibold ${
          activo ? "text-tr-forest" : "text-tr-muted hover:text-tr-ink"
        }`}
        aria-label={`Ordenar por ${String(children)}`}
      >
        {children}
        <span aria-hidden="true">{activo ? (orden.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

export function LeadsTab({
  leads,
  token,
  filtros,
  setFiltros,
  orden,
  setOrden,
  actualizando,
  onCambiarEstado,
  onGuardarNotas,
  onBorrar,
}: {
  leads: LeadFila[];
  token: string;
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  orden: Orden;
  setOrden: (o: Orden) => void;
  actualizando: string | null;
  onCambiarEstado: (id: string, estado: string) => void;
  onGuardarNotas: (id: string, notas: string) => void;
  onBorrar: (ids: string[]) => Promise<boolean>;
}) {
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [aBorrar, setABorrar] = useState<LeadFila[]>([]);
  const [borrando, setBorrando] = useState(false);
  const [notas, setNotas] = useState<Record<string, string>>({});

  // Sembrar notas solo con los ids nuevos y descartar los que ya no existen.
  // No se reescribe todo el mapa en cada cambio de `leads`: si no, cambiar el
  // estado de una fila borraría la nota a medio escribir de otra.
  useEffect(() => {
    setNotas((prev) => {
      const ids = new Set(leads.map((l) => l.id));
      const siguiente: Record<string, string> = {};
      let cambiado = false;
      for (const l of leads) {
        siguiente[l.id] = prev[l.id] ?? l.notas ?? "";
        if (!(l.id in prev)) cambiado = true;
      }
      for (const clave of Object.keys(prev)) {
        if (!ids.has(clave)) cambiado = true;
      }
      return cambiado || Object.keys(prev).length !== Object.keys(siguiente).length
        ? siguiente
        : prev;
    });
  }, [leads]);

  useEffect(() => {
    setPagina(1);
  }, [filtros, orden, porPagina]);

  const opciones = useMemo(
    () => ({
      municipios: opcionesUnicas(leads, "municipio"),
      cultivos: opcionesUnicas(leads, "cultivo"),
      campanas: campanasUnicas(leads),
    }),
    [leads]
  );

  const filtrados = useMemo(() => aplicarFiltros(leads, filtros), [leads, filtros]);
  const ordenados = useMemo(() => ordenarLeads(filtrados, orden), [filtrados, orden]);
  const paginaDatos = useMemo(() => paginar(ordenados, pagina, porPagina), [ordenados, pagina, porPagina]);

  const idsPagina = paginaDatos.items.map((l) => l.id);
  const todosPaginaSeleccionados =
    idsPagina.length > 0 && idsPagina.every((id) => seleccion.includes(id));

  const alternar = (id: string) =>
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const alternarPagina = () =>
    setSeleccion((prev) => {
      if (todosPaginaSeleccionados) return prev.filter((id) => !idsPagina.includes(id));
      return [...new Set([...prev, ...idsPagina])];
    });

  const confirmarBorrado = async () => {
    setBorrando(true);
    const ok = await onBorrar(aBorrar.map((l) => l.id));
    setBorrando(false);
    if (ok) {
      setSeleccion((prev) => prev.filter((id) => !aBorrar.some((l) => l.id === id)));
      setABorrar([]);
    }
  };

  const algunFiltro = hayFiltrosActivos(filtros);
  const hayLeads = leads.length > 0;

  return (
    <div className="space-y-4">
      <div className={`${cardStyles} p-4`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="block text-caption text-tr-muted mb-1" htmlFor="f-texto">
              Buscar
            </label>
            <input
              id="f-texto"
              type="search"
              value={filtros.texto}
              onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
              placeholder="Nombre, teléfono, correo, municipio, cultivo, síntoma…"
              className={inputMini}
            />
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="f-estado">
              Estado
            </label>
            <select
              id="f-estado"
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value as Filtros["estado"] })}
              className={inputMini}
            >
              <option value="">Todos</option>
              {ESTADOS_LEAD.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_LABELS[e]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="f-prioridad">
              Prioridad
            </label>
            <select
              id="f-prioridad"
              value={filtros.prioridad}
              onChange={(e) =>
                setFiltros({ ...filtros, prioridad: e.target.value as Filtros["prioridad"] })
              }
              className={inputMini}
            >
              <option value="">Todas</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="f-origen">
              Origen
            </label>
            <select
              id="f-origen"
              value={filtros.origen}
              onChange={(e) => setFiltros({ ...filtros, origen: e.target.value as Filtros["origen"] })}
              className={inputMini}
            >
              <option value="">Todos</option>
              <option value="post_diagnostico">Tras diagnóstico</option>
              <option value="contacto_directo">Contacto directo</option>
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="f-municipio">
              Zona
            </label>
            <select
              id="f-municipio"
              value={filtros.municipio}
              onChange={(e) => setFiltros({ ...filtros, municipio: e.target.value })}
              className={inputMini}
            >
              <option value="">Todas</option>
              {opciones.municipios.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="f-cultivo">
              Cultivo
            </label>
            <select
              id="f-cultivo"
              value={filtros.cultivo}
              onChange={(e) => setFiltros({ ...filtros, cultivo: e.target.value })}
              className={inputMini}
            >
              <option value="">Todos</option>
              {opciones.cultivos.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="f-canal">
              Canal
            </label>
            <select
              id="f-canal"
              value={filtros.canal}
              onChange={(e) => setFiltros({ ...filtros, canal: e.target.value })}
              className={inputMini}
            >
              <option value="">Todos</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="llamada">Llamada</option>
              <option value="correo">Correo</option>
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="f-campana">
              Campaña
            </label>
            <select
              id="f-campana"
              value={filtros.campana}
              onChange={(e) => setFiltros({ ...filtros, campana: e.target.value })}
              className={inputMini}
            >
              <option value="">Todas</option>
              {opciones.campanas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="f-desde">
              Desde
            </label>
            <input
              id="f-desde"
              type="date"
              value={filtros.desde}
              onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
              className={inputMini}
            />
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="f-hasta">
              Hasta
            </label>
            <input
              id="f-hasta"
              type="date"
              value={filtros.hasta}
              onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
              className={inputMini}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
          <p className="text-caption text-tr-muted">
            {formatNumero(filtrados.length)} de {formatNumero(leads.length)} leads
            {algunFiltro && " (filtrados)"}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-caption text-tr-muted" htmlFor="f-porpagina">
              Por página
            </label>
            <select
              id="f-porpagina"
              value={porPagina}
              onChange={(e) => setPorPagina(Number(e.target.value))}
              className="px-2 py-1.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-small"
            >
              {OPCIONES_POR_PAGINA.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {algunFiltro && (
              <button
                type="button"
                onClick={() => setFiltros({ ...FILTROS_VACIOS })}
                className={btnMini}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {seleccion.length > 0 && (
        <div
          className={`${cardStyles} p-3 flex items-center justify-between gap-3 flex-wrap sticky top-2 z-10`}
        >
          <span className="text-small font-semibold text-tr-forest">
            {seleccion.length} seleccionado{seleccion.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSeleccion([])} className={btnMini}>
              Quitar selección
            </button>
            <button
              type="button"
              onClick={() => setABorrar(leads.filter((l) => seleccion.includes(l.id)))}
              className={btnDanger}
            >
              Borrar seleccionados
            </button>
          </div>
        </div>
      )}

      {hayLeads ? (
        <div className={`${cardStyles} overflow-x-auto`}>
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-tr-line text-left text-caption text-tr-muted">
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={todosPaginaSeleccionados}
                    onChange={alternarPagina}
                    aria-label="Seleccionar todos los de esta página"
                  />
                </th>
                <ThOrden campo="created_at" orden={orden} setOrden={setOrden}>
                  Fecha
                </ThOrden>
                <ThOrden campo="estado" orden={orden} setOrden={setOrden}>
                  Estado
                </ThOrden>
                <ThOrden campo="prioridad" orden={orden} setOrden={setOrden}>
                  Prioridad
                </ThOrden>
                <th className="px-3 py-2">Contacto</th>
                <th className="px-3 py-2">Canal</th>
                <th className="px-3 py-2">Revisión</th>
                <th className="px-3 py-2">Origen</th>
                <ThOrden campo="municipio" orden={orden} setOrden={setOrden}>
                  Zona
                </ThOrden>
                <ThOrden campo="cultivo" orden={orden} setOrden={setOrden}>
                  Cultivo
                </ThOrden>
                <th className="px-3 py-2">Síntoma</th>
                <th className="px-3 py-2">Comercial</th>
                <th className="px-3 py-2">Campaña</th>
                <th className="px-3 py-2">Fotos</th>
                <ThOrden campo="num_imagenes" orden={orden} setOrden={setOrden}>
                  Nº fotos
                </ThOrden>
                <ThOrden campo="respuesta" orden={orden} setOrden={setOrden}>
                  Respuesta
                </ThOrden>
                <th className="px-3 py-2">Notas</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {paginaDatos.items.map((lead) => (
                <tr key={lead.id} className="border-b border-tr-line last:border-0 align-top">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={seleccion.includes(lead.id)}
                      onChange={() => alternar(lead.id)}
                      aria-label={`Seleccionar el lead de ${lead.nombre}`}
                    />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-tr-muted">
                    {formatFecha(lead.created_at)}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={lead.estado}
                      onChange={(e) => onCambiarEstado(lead.id, e.target.value)}
                      disabled={actualizando === lead.id}
                      className={`border border-tr-line rounded-[var(--tr-radius-control)] px-2 py-1 bg-tr-paper text-small font-semibold ${ESTADO_COLORES[lead.estado]}`}
                      aria-label={`Estado del lead de ${lead.nombre}`}
                    >
                      {ESTADOS_LEAD.map((e) => (
                        <option key={e} value={e}>
                          {ESTADO_LABELS[e]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className="font-semibold"
                      style={{ color: COLOR_PRIORIDAD[lead.prioridad] }}
                    >
                      {lead.prioridad}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-tr-ink font-medium">{lead.nombre}</span>
                    {lead.telefono ? (
                      <a
                        href={`tel:${lead.telefono}`}
                        className="block text-tr-green-strong hover:underline"
                      >
                        {lead.telefono}
                      </a>
                    ) : (
                      <span className="block text-caption text-tr-muted">Sin teléfono</span>
                    )}
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="block text-tr-green-strong hover:underline break-all"
                      >
                        {lead.email}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-3 text-tr-muted">{etiquetaCanal(lead.canal_contacto)}</td>
                  <td className="px-3 py-3">
                    {lead.solicitud_revision ? (
                      <span className="font-semibold text-tr-ink">Sí</span>
                    ) : (
                      <span className="text-caption text-tr-muted">Solo informe</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-tr-muted">
                    {ETIQUETAS_ORIGEN[lead.origen] ?? "—"}
                    {lead.diagnostico_id && (
                      <span className="block text-caption text-tr-muted">
                        #{lead.diagnostico_id.slice(0, 8)}
                      </span>
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
                      <span className="block text-caption text-tr-muted">
                        {lead.consentimiento_texto_version}
                      </span>
                    )}
                    {lead.baja_comercial && <span className="block text-caption text-red-600">BAJA</span>}
                  </td>
                  <td className="px-3 py-3 text-tr-muted">
                    {lead.utm_campaign ?? lead.origen_campana ?? "—"}
                    {lead.utm_source && (
                      <span className="block text-caption">src: {lead.utm_source}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <FotosLead leadId={lead.id} total={lead.num_imagenes} token={token} />
                  </td>
                  <td className="px-3 py-3 text-tr-muted text-center">{lead.num_imagenes}</td>
                  <td className="px-3 py-3 text-tr-muted">
                    {horasLegibles(horasRespuesta(lead))}
                  </td>
                  <td className="px-3 py-3 min-w-[220px]">
                    <textarea
                      rows={2}
                      value={notas[lead.id] ?? ""}
                      onChange={(e) => setNotas((n) => ({ ...n, [lead.id]: e.target.value }))}
                      onBlur={() => onGuardarNotas(lead.id, notas[lead.id] ?? "")}
                      disabled={actualizando === lead.id}
                      className="w-full px-2 py-1 border border-tr-line rounded-[var(--tr-radius-control)] bg-tr-paper text-tr-ink text-small resize-none"
                      placeholder="Nota interna"
                      aria-label={`Notas internas del lead de ${lead.nombre}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setABorrar([lead])}
                      className={btnMini}
                      aria-label={`Borrar el lead de ${lead.nombre}`}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`${cardStyles} p-8 text-center text-tr-muted`}>
          {hayLeads ? "Ningún lead cumple los filtros." : "No hay leads todavía."}
        </div>
      )}

      {paginaDatos.totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-small">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={paginaDatos.pagina <= 1}
            className={btnMini}
          >
            Anterior
          </button>
          <span className="text-tr-muted">
            Página {paginaDatos.pagina} de {paginaDatos.totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(paginaDatos.totalPaginas, p + 1))}
            disabled={paginaDatos.pagina >= paginaDatos.totalPaginas}
            className={btnMini}
          >
            Siguiente
          </button>
        </div>
      )}

      <BorrarLeadDialog
        leads={aBorrar}
        borrando={borrando}
        onCancelar={() => setABorrar([])}
        onConfirmar={confirmarBorrado}
      />
    </div>
  );
}
