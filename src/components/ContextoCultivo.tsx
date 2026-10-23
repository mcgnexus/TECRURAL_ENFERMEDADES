"use client";

import {
  MUNICIPIOS_POR_COMARCA,
  CULTIVOS_FRECUENTES,
  SINTOMAS_FRECUENTES,
  DURACIONES,
} from "@/lib/datos-zona";
import { VALOR_OTRO, VALOR_NO_LO_SE, type ContextoForm } from "@/lib/contexto-cultivo";

/**
 * Contexto del cultivo en dos piezas, a propósito:
 *
 * - `CultivoSelector` es lo único imprescindible (junto a la foto) y se ve
 *   siempre. Sin saber la planta, la orientación es mucho menos fiable.
 * - `ContextoOpcional` agrupa municipio, síntoma, antigüedad y variedad en un
 *   desplegable cerrado por defecto. No bloquea el análisis, pero se explica
 *   para qué sirve: afinar la interpretación.
 *
 * Los valores viven en `page.tsx`, así que colapsar el desplegable (o sufrir un
 * error recuperable) no pierde nada.
 */

interface BaseProps {
  valor: ContextoForm;
  onChange: (valor: ContextoForm) => void;
  disabled?: boolean;
}

const labelCls = "block font-body font-semibold text-tr-forest text-small mb-1.5";
const selectCls = "w-full px-3 py-2.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink font-body text-body focus:border-tr-brand-green focus:bg-tr-surface disabled:opacity-50";
const inputCls = "w-full px-3 py-2.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink font-body text-body placeholder:text-tr-muted focus:border-tr-brand-green focus:bg-tr-surface disabled:opacity-50";

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

function actualizador(valor: ContextoForm, onChange: (valor: ContextoForm) => void) {
  return <K extends keyof ContextoForm>(campo: K, v: ContextoForm[K]) =>
    onChange({ ...valor, [campo]: v });
}

export function CultivoSelector({ valor, onChange, disabled = false }: BaseProps) {
  const set = actualizador(valor, onChange);

  return (
    <div className={`p-4 sm:p-5 ${cardStyles}`}>
      <h2 className="font-heading font-semibold text-tr-forest">¿Qué cultivo es?</h2>
      <p className="mt-1 text-caption text-tr-muted">
        Con saber la planta, la orientación es más fiable. Si no la tienes claro,
        elige «No lo sé».
      </p>

      <div className="mt-3">
        <label htmlFor="ctx-cultivo" className={labelCls}>Cultivo *</label>
        <select
          id="ctx-cultivo"
          required
          value={valor.cultivo}
          onChange={(e) => set("cultivo", e.target.value)}
          disabled={disabled}
          className={selectCls}
        >
          <option value="" disabled>Selecciona un cultivo</option>
          {CULTIVOS_FRECUENTES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          <option value={VALOR_OTRO}>Otro</option>
          <option value={VALOR_NO_LO_SE}>No lo sé</option>
        </select>
        {valor.cultivo === VALOR_OTRO && (
          <input
            type="text"
            value={valor.cultivoOtro}
            onChange={(e) => set("cultivoOtro", e.target.value)}
            disabled={disabled}
            placeholder="¿Qué cultivo es?"
            autoComplete="off"
            className={`${inputCls} mt-2`}
            aria-label="Escribe tu cultivo"
          />
        )}
      </div>
    </div>
  );
}

export function ContextoOpcional({ valor, onChange, disabled = false }: BaseProps) {
  const set = actualizador(valor, onChange);

  return (
    <details className={`group ${cardStyles}`}>
      <summary className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-[var(--tr-radius-card)] px-4 py-3 text-small font-semibold text-tr-forest hover:bg-tr-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tr-green-strong">
        <span>
          Más datos sobre el caso <span className="font-normal text-tr-muted">(opcional)</span>
        </span>
        <svg
          className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      <div className="border-t border-tr-line px-4 pb-4 pt-3">
        <p className="mb-4 text-caption leading-relaxed text-tr-muted">
          La zona, lo que has observado y desde cuándo ayudan a distinguir una plaga
          de un problema de riego o de ambiente. Puedes analizar sin rellenar nada.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="ctx-municipio" className={labelCls}>Municipio o comarca</label>
            <select
              id="ctx-municipio"
              value={valor.municipio}
              onChange={(e) => set("municipio", e.target.value)}
              disabled={disabled}
              className={selectCls}
            >
              <option value="" disabled>Selecciona tu zona</option>
              {Object.entries(MUNICIPIOS_POR_COMARCA).map(([comarca, municipios]) => (
                <optgroup key={comarca} label={comarca}>
                  {municipios.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </optgroup>
              ))}
              <option value={VALOR_OTRO}>Otro municipio</option>
              <option value="__no_lo_se__">No lo sé / fuera de la zona</option>
            </select>
            {valor.municipio === VALOR_OTRO && (
              <input
                type="text"
                value={valor.municipioOtro}
                onChange={(e) => set("municipioOtro", e.target.value)}
                disabled={disabled}
                placeholder="Escribe tu municipio"
                autoComplete="off"
                className={`${inputCls} mt-2`}
                aria-label="Escribe tu municipio"
              />
            )}
          </div>

          <div>
            <label htmlFor="ctx-sintoma" className={labelCls}>¿Qué has observado?</label>
            <select
              id="ctx-sintoma"
              value={valor.sintoma}
              onChange={(e) => set("sintoma", e.target.value)}
              disabled={disabled}
              className={selectCls}
            >
              <option value="" disabled>Selecciona el síntoma principal</option>
              {SINTOMAS_FRECUENTES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value={VALOR_OTRO}>Otro</option>
            </select>
            {valor.sintoma === VALOR_OTRO && (
              <input
                type="text"
                value={valor.sintomaOtro}
                onChange={(e) => set("sintomaOtro", e.target.value)}
                disabled={disabled}
                placeholder="Describe brevemente lo que ves"
                autoComplete="off"
                className={`${inputCls} mt-2`}
                aria-label="Describe el síntoma"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ctx-duracion" className={labelCls}>
                Desde cuándo <span className="font-normal text-tr-muted">(opcional)</span>
              </label>
              <select
                id="ctx-duracion"
                value={valor.duracion}
                onChange={(e) => set("duracion", e.target.value)}
                disabled={disabled}
                className={selectCls}
              >
                <option value="">Sin especificar</option>
                {DURACIONES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ctx-variedad" className={labelCls}>
                Variedad <span className="font-normal text-tr-muted">(opcional)</span>
              </label>
              <input
                id="ctx-variedad"
                type="text"
                value={valor.variedad}
                onChange={(e) => set("variedad", e.target.value)}
                disabled={disabled}
                placeholder="Ej: Picual"
                autoComplete="off"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
