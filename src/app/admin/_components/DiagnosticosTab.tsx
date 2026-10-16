"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { DiagnosticoPanelFila, DiagnosticosPanel } from "@/types/diagnostico";
import { KpiCard } from "./KpiCard";
import { paginar } from "./filtros";
import {
  FILTROS_DIAG_VACIOS,
  ORDEN_DIAG_POR_DEFECTO,
  aplicarFiltrosDiag,
  confianzaPct,
  hayFiltrosDiagActivos,
  nivelSenalDiag,
  opcionesDiag,
  ordenarDiagnosticos,
  resultadoDe,
} from "./diagnosticos";
import type { CampoOrdenDiag, FiltrosDiag, OrdenDiag } from "./diagnosticos";
import {
  COLOR,
  btnMini,
  cardStyles,
  formatFecha,
  formatNumero,
  inputMini,
} from "./ui";

const OPCIONES_POR_PAGINA = [25, 50, 100];

const COLOR_TIPO: Record<string, string> = {
  enfermedad: COLOR.perdido,
  plaga: COLOR.warning,
  deficiencia_nutricional: COLOR.leaf,
  sano: COLOR.greenStrong,
};

const COLOR_GRAVEDAD: Record<string, string> = {
  severa: COLOR.perdido,
  moderada: COLOR.warning,
  leve: COLOR.leaf,
};

const NOMBRE_GRAVEDAD: Record<string, string> = {
  severa: "Severa",
  moderada: "Moderada",
  leve: "Leve",
};

const NOMBRE_TIPO: Record<string, string> = {
  enfermedad: "Enfermedad",
  plaga: "Plaga",
  deficiencia_nutricional: "Deficiencia",
  sano: "Sano",
};

function nivelColor(confianza: number | null): string {
  const nivel = nivelSenalDiag(confianza);
  if (nivel === "claras") return COLOR.greenStrong;
  if (nivel === "moderadas") return COLOR.warning;
  if (nivel === "pocas") return COLOR.perdido;
  return COLOR.line;
}

function ThDiag({
  campo,
  orden,
  setOrden,
  children,
}: {
  campo: CampoOrdenDiag;
  orden: OrdenDiag;
  setOrden: (o: OrdenDiag) => void;
  children: React.ReactNode;
}) {
  const activo = orden.campo === campo;
  return (
    <th className="px-3 py-2 whitespace-nowrap">
      <button
        type="button"
        onClick={() =>
          setOrden(
            activo ? { campo, dir: orden.dir === "asc" ? "desc" : "asc" } : { campo, dir: "desc" }
          )
        }
        className={`inline-flex items-center gap-1 font-semibold ${
          activo ? "text-tr-forest" : "text-tr-muted hover:text-tr-ink"
        }`}
      >
        {children}
        <span aria-hidden="true">{activo ? (orden.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function BarrasResumen({
  titulo,
  datos,
  colores,
}: {
  titulo: string;
  datos: { clave: string; etiqueta: string; total: number }[];
  colores?: Record<string, string>;
}) {
  if (datos.length === 0) return null;
  const max = Math.max(1, ...datos.map((d) => d.total));
  return (
    <div>
      <h3 className="font-heading font-semibold text-tr-forest text-small mb-2">{titulo}</h3>
      {datos.map((d) => (
        <div key={d.clave} className="flex items-center gap-2 mb-1.5">
          <span className="text-small text-tr-muted w-28 truncate">{d.etiqueta}</span>
          <span className="h-2 rounded-full bg-tr-paper flex-1">
            <span
              className="block h-2 rounded-full"
              style={{
                width: `${(d.total / max) * 100}%`,
                backgroundColor: colores?.[d.clave] ?? COLOR.brandGreen,
              }}
            />
          </span>
          <span className="text-small font-semibold text-tr-ink w-8 text-right">
            {formatNumero(d.total)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DetalleDiagnostico({ fila }: { fila: DiagnosticoPanelFila }) {
  const r = resultadoDe(fila);
  const contexto = fila.contexto_usuario ?? {};

  return (
    <div className="bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line p-4 space-y-3 text-small text-tr-muted">
      <section>
        <h4 className="font-heading font-semibold text-tr-forest text-small mb-1">Resultado</h4>
        {r.ilegible ? (
          <p className="text-tr-warning-text">
            No se pudo leer el resultado de esta fila. Revisa la base de datos.
          </p>
        ) : (
          <>
            {r.recomendacion && <p className="text-tr-ink leading-relaxed">{r.recomendacion}</p>}
            {r.sintomas.length > 0 && (
              <p className="mt-2">
                <span className="font-semibold text-tr-forest">Síntomas observados:</span>{" "}
                {r.sintomas.join(" · ")}
              </p>
            )}
          </>
        )}
      </section>

      {r.diferenciales.length > 0 && (
        <section>
          <h4 className="font-heading font-semibold text-tr-forest text-small mb-1">
            Diferenciales
          </h4>
          <ul className="space-y-1">
            {r.diferenciales.map((d) => (
              <li key={d.nombre}>
                <span className="text-tr-ink font-medium">{d.nombre}</span>{" "}
                <span className="text-caption">({confianzaPct(d.confianza)})</span>
                {d.por_que_descartado && <> — {d.por_que_descartado}</>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(r.hallazgos_negativos.length > 0 || r.datos_faltantes.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {r.hallazgos_negativos.length > 0 && (
            <div>
              <h4 className="font-heading font-semibold text-tr-forest text-small mb-1">
                Hallazgos negativos
              </h4>
              <ul className="list-disc pl-4">
                {r.hallazgos_negativos.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {r.datos_faltantes.length > 0 && (
            <div>
              <h4 className="font-heading font-semibold text-tr-forest text-small mb-1">
                Datos que faltan
              </h4>
              <ul className="list-disc pl-4">
                {r.datos_faltantes.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 border-t border-tr-line pt-3">
        <div>
          <span className="font-semibold text-tr-forest">Contexto declarado</span>
          <p>
            {[
              contexto.cultivo,
              contexto.variedad,
              contexto.municipio,
              contexto.sintoma,
              contexto.duracion,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <div>
          <span className="font-semibold text-tr-forest">Técnico</span>
          <p>
            Órgano: {fila.organo ?? "—"} · visitante: {fila.usuario_id?.slice(0, 8) ?? "—"} ·
            id: {fila.id.slice(0, 8)}
          </p>
        </div>
      </section>
    </div>
  );
}

export function DiagnosticosTab({ datos }: { datos: DiagnosticosPanel }) {
  const [filtros, setFiltros] = useState<FiltrosDiag>({ ...FILTROS_DIAG_VACIOS });
  const [orden, setOrden] = useState<OrdenDiag>(ORDEN_DIAG_POR_DEFECTO);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [expandidos, setExpandidos] = useState<string[]>([]);

  useEffect(() => {
    setPagina(1);
    setExpandidos([]);
  }, [filtros, orden, porPagina]);

  const opciones = useMemo(() => opcionesDiag(datos.items), [datos.items]);
  const filtrados = useMemo(() => aplicarFiltrosDiag(datos.items, filtros), [datos.items, filtros]);
  const ordenados = useMemo(() => ordenarDiagnosticos(filtrados, orden), [filtrados, orden]);
  const paginaDatos = useMemo(
    () => paginar(ordenados, pagina, porPagina),
    [ordenados, pagina, porPagina]
  );

  const alternar = (id: string) =>
    setExpandidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const algunFiltro = hayFiltrosDiagActivos(filtros);

  const conExpertoPct =
    datos.totales.diagnosticos > 0
      ? (datos.totales.requiereExperto / datos.totales.diagnosticos) * 100
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <KpiCard
          etiqueta="Análisis guardados"
          valor={formatNumero(datos.totales.diagnosticos)}
          detalle="terminaron con éxito"
          acento={COLOR.greenStrong}
        />
        <KpiCard
          etiqueta="Confianza media"
          valor={confianzaPct(datos.confianzaMedia)}
          detalle="escala del modelo, sin calibrar"
          acento={COLOR.cyan}
        />
        <KpiCard
          etiqueta="Requiere experto"
          valor={formatNumero(datos.totales.requiereExperto)}
          detalle={conExpertoPct === null ? "—" : `${conExpertoPct.toFixed(1)} % de los guardados`}
          acento={COLOR.warning}
        />
        <KpiCard
          etiqueta="Con feedback"
          valor={formatNumero(datos.totales.conFeedback)}
          detalle="el agricultor valoró el resultado"
          acento={COLOR.leaf}
        />
        <KpiCard
          etiqueta="Iniciaron análisis"
          valor={formatNumero(datos.intentos.iniciados)}
          detalle={`últimos ${datos.dias} días`}
          acento={COLOR.cyanText}
        />
        <KpiCard
          etiqueta="Errores de análisis"
          valor={formatNumero(datos.intentos.errores)}
          detalle={`últimos ${datos.dias} días`}
          acento={datos.intentos.errores > 0 ? COLOR.perdido : COLOR.leaf}
        />
      </div>

      <details className={`${cardStyles} p-3 text-caption text-tr-muted leading-relaxed`}>
        <summary className="cursor-pointer font-semibold text-tr-forest text-small">
          Cómo leer «realizados» y «errores»
        </summary>
        <p className="mt-2">
          Una fila aparece en <strong>Análisis guardados</strong> solo cuando el análisis
          terminó bien: si falló, no hay fila y su rastro queda en los eventos. Por eso «Iniciaron
          análisis» y «Errores» salen de otra tabla, que cuenta <strong>visitantes distintos por
          día</strong> y no intentos crudos: un agricultor que reintenta cinco veces en la misma
          hora sigue siendo un visitante. Las dos cifras no se suman.
        </p>
      </details>

      <div className={`${cardStyles} p-4`}>
        <h2 className="font-heading font-semibold text-tr-forest text-small mb-3">
          Reparto de los resultados
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <BarrasResumen
            titulo="Por tipo"
            datos={datos.porTipo.map((t) => ({
              clave: t.tipo,
              etiqueta: NOMBRE_TIPO[t.tipo] ?? t.tipo,
              total: t.total,
            }))}
            colores={COLOR_TIPO}
          />
          <BarrasResumen
            titulo="Por gravedad"
            datos={datos.porGravedad.map((g) => ({
              clave: g.gravedad,
              etiqueta: NOMBRE_GRAVEDAD[g.gravedad] ?? g.gravedad,
              total: g.total,
            }))}
            colores={COLOR_GRAVEDAD}
          />
        </div>
        {datos.porProveedor.length > 0 && (
          <p className="text-caption text-tr-muted mt-4 pt-3 border-t border-tr-line">
            Proveedores:{" "}
            {datos.porProveedor.map((p) => `${p.proveedor} (${p.total})`).join(" · ")}
          </p>
        )}
      </div>

      <div className={`${cardStyles} p-4`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="block text-caption text-tr-muted mb-1" htmlFor="dg-texto">
              Buscar
            </label>
            <input
              id="dg-texto"
              type="search"
              value={filtros.texto}
              onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
              placeholder="Especie, enfermedad, cultivo, municipio, síntoma…"
              className={inputMini}
            />
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="dg-tipo">
              Tipo
            </label>
            <select
              id="dg-tipo"
              value={filtros.tipo}
              onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
              className={inputMini}
            >
              <option value="">Todos</option>
              {opciones.tipo.map((t) => (
                <option key={t} value={t}>
                  {NOMBRE_TIPO[t] ?? t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="dg-gravedad">
              Gravedad
            </label>
            <select
              id="dg-gravedad"
              value={filtros.gravedad}
              onChange={(e) => setFiltros({ ...filtros, gravedad: e.target.value })}
              className={inputMini}
            >
              <option value="">Todas</option>
              {opciones.gravedad.map((g) => (
                <option key={g} value={g}>
                  {NOMBRE_GRAVEDAD[g] ?? g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="dg-proveedor">
              Proveedor
            </label>
            <select
              id="dg-proveedor"
              value={filtros.proveedor}
              onChange={(e) => setFiltros({ ...filtros, proveedor: e.target.value })}
              className={inputMini}
            >
              <option value="">Todos</option>
              {opciones.proveedor.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="dg-experto">
              Requiere experto
            </label>
            <select
              id="dg-experto"
              value={filtros.requiereExperto === "" ? "" : String(filtros.requiereExperto)}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  requiereExperto: e.target.value === "" ? "" : e.target.value === "true",
                })
              }
              className={inputMini}
            >
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="dg-feedback">
              Con feedback
            </label>
            <select
              id="dg-feedback"
              value={filtros.conFeedback === "" ? "" : String(filtros.conFeedback)}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  conFeedback: e.target.value === "" ? "" : e.target.value === "true",
                })
              }
              className={inputMini}
            >
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="dg-desde">
              Desde
            </label>
            <input
              id="dg-desde"
              type="date"
              value={filtros.desde}
              onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
              className={inputMini}
            />
          </div>
          <div>
            <label className="block text-caption text-tr-muted mb-1" htmlFor="dg-hasta">
              Hasta
            </label>
            <input
              id="dg-hasta"
              type="date"
              value={filtros.hasta}
              onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
              className={inputMini}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
          <p className="text-caption text-tr-muted">
            {formatNumero(filtrados.length)} de {formatNumero(datos.items.length)} análisis (de
            {formatNumero(datos.totales.diagnosticos)} en total)
          </p>
          <div className="flex items-center gap-2">
            <label className="text-caption text-tr-muted" htmlFor="dg-porpagina">
              Por página
            </label>
            <select
              id="dg-porpagina"
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
              <button type="button" onClick={() => setFiltros({ ...FILTROS_DIAG_VACIOS })} className={btnMini}>
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {paginaDatos.items.length > 0 ? (
        <div className={`${cardStyles} overflow-x-auto`}>
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-tr-line text-left text-caption text-tr-muted">
                <th className="px-3 py-2" />
                <ThDiag campo="created_at" orden={orden} setOrden={setOrden}>
                  Fecha
                </ThDiag>
                <th className="px-3 py-2">Especie</th>
                <ThDiag campo="tipo" orden={orden} setOrden={setOrden}>
                  Tipo
                </ThDiag>
                <th className="px-3 py-2">Resultado</th>
                <ThDiag campo="gravedad" orden={orden} setOrden={setOrden}>
                  Gravedad
                </ThDiag>
                <ThDiag campo="confianza" orden={orden} setOrden={setOrden}>
                  Confianza
                </ThDiag>
                <th className="px-3 py-2">Experto</th>
                <th className="px-3 py-2">Proveedor</th>
                <th className="px-3 py-2">Cultivo / zona</th>
                <th className="px-3 py-2">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {paginaDatos.items.map((fila) => {
                const r = resultadoDe(fila);
                const abierto = expandidos.includes(fila.id);
                const nivel = nivelSenalDiag(r.confianza);
                return (
                  <Fragment key={fila.id}>
                    <tr
                      onClick={() => alternar(fila.id)}
                      className={`border-b border-tr-line align-top cursor-pointer hover:bg-tr-paper ${
                        abierto ? "bg-tr-paper" : ""
                      }`}
                    >
                      <td className="px-3 py-3 text-tr-muted" aria-hidden="true">
                        {abierto ? "▾" : "▸"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-tr-muted">
                        {formatFecha(fila.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-tr-ink font-medium">
                          {fila.nombre_planta || fila.especie || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {r.tipo ? (
                          <span
                            className="font-semibold"
                            style={{ color: COLOR_TIPO[r.tipo] ?? COLOR.ink }}
                          >
                            {NOMBRE_TIPO[r.tipo] ?? r.tipo}
                          </span>
                        ) : (
                          <span className="text-tr-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 max-w-[260px]">
                        {r.ilegible ? (
                          <span className="text-tr-warning-text">Resultado ilegible</span>
                        ) : (
                          <span className="text-tr-ink">{r.nombre ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {r.gravedad ? (
                          <span
                            className="font-semibold capitalize"
                            style={{ color: COLOR_GRAVEDAD[r.gravedad] ?? COLOR.ink }}
                          >
                            {NOMBRE_GRAVEDAD[r.gravedad] ?? r.gravedad}
                          </span>
                        ) : (
                          <span className="text-tr-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 min-w-[110px]">
                        <span className="font-semibold text-tr-ink">
                          {confianzaPct(r.confianza)}
                        </span>
                        {nivel && (
                          <span className="block text-caption text-tr-muted">{nivel}</span>
                        )}
                        <span className="block h-1.5 mt-1 rounded-full bg-tr-paper">
                          <span
                            className="block h-1.5 rounded-full"
                            style={{
                              width: `${(r.confianza ?? 0) * 100}%`,
                              backgroundColor: nivelColor(r.confianza),
                            }}
                          />
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {r.requiere_experto ? (
                          <span className="font-semibold text-tr-warning-text">Sí</span>
                        ) : (
                          <span className="text-tr-muted">No</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-tr-muted">{fila.proveedor ?? "—"}</td>
                      <td className="px-3 py-3 text-tr-muted">
                        {[
                          fila.contexto_usuario?.cultivo,
                          fila.contexto_usuario?.municipio,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="px-3 py-3 max-w-[220px]">
                        {fila.feedback_usuario ? (
                          <span className="text-tr-ink">{fila.feedback_usuario}</span>
                        ) : (
                          <span className="text-tr-muted">—</span>
                        )}
                      </td>
                    </tr>
                    {abierto && (
                      <tr>
                        <td colSpan={11} className="px-3 pb-4">
                          <DetalleDiagnostico fila={fila} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`${cardStyles} p-8 text-center text-tr-muted`}>
          {datos.items.length === 0
            ? "Todavía no hay diagnósticos guardados."
            : "Ningún análisis cumple los filtros."}
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
    </div>
  );
}
