"use client";

import {
  MUNICIPIOS_POR_COMARCA,
  CULTIVOS_FRECUENTES,
  SINTOMAS_FRECUENTES,
  DURACIONES,
} from "@/lib/datos-zona";

export interface ContextoForm {
  cultivo: string;
  cultivoOtro: string;
  municipio: string;
  municipioOtro: string;
  sintoma: string;
  sintomaOtro: string;
  duracion: string;
  variedad: string;
}

export const CONTEXTO_INICIAL: ContextoForm = {
  cultivo: "",
  cultivoOtro: "",
  municipio: "",
  municipioOtro: "",
  sintoma: "",
  sintomaOtro: "",
  duracion: "",
  variedad: "",
};

interface ContextoCultivoProps {
  valor: ContextoForm;
  onChange: (valor: ContextoForm) => void;
  disabled?: boolean;
}

const labelCls = "block font-body font-semibold text-tr-forest text-small mb-1.5";
const selectCls = "w-full px-3 py-2.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink font-body text-body focus:border-tr-brand-green focus:bg-tr-surface disabled:opacity-50";
const inputCls = "w-full px-3 py-2.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink font-body text-body placeholder:text-tr-muted focus:border-tr-brand-green focus:bg-tr-surface disabled:opacity-50";

const VALOR_OTRO = "__otro__";
const VALOR_NO_LO_SE = "__no_lo_se__";

const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";

export function resumenContexto(c: ContextoForm) {
  return {
    cultivo:
      c.cultivo === VALOR_OTRO ? c.cultivoOtro.trim() : c.cultivo === VALOR_NO_LO_SE ? "" : c.cultivo.trim(),
    municipio:
      c.municipio === VALOR_OTRO ? c.municipioOtro.trim() : c.municipio === VALOR_NO_LO_SE ? "" : c.municipio.trim(),
    sintoma:
      c.sintoma === VALOR_OTRO ? c.sintomaOtro.trim() : c.sintoma === VALOR_NO_LO_SE ? "" : c.sintoma.trim(),
    duracion: c.duracion === VALOR_NO_LO_SE ? "" : c.duracion.trim(),
    variedad: c.variedad.trim(),
  };
}

export function ContextoCultivo({ valor, onChange, disabled = false }: ContextoCultivoProps) {
  const set = <K extends keyof ContextoForm>(campo: K, v: ContextoForm[K]) =>
    onChange({ ...valor, [campo]: v });

  return (
    <div className={`p-5 ${cardStyles}`}>
      <h3 className="font-heading font-semibold text-tr-forest mb-1">Cuéntanos sobre tu cultivo</h3>
      <p className="text-caption text-tr-muted mb-4">
        Esto ayuda a orientar mejor el análisis. Todo es opcional salvo el cultivo.
      </p>

      <div className="space-y-4">
        <div>
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
            <option value="__no_lo_se__">No lo sé</option>
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
  );
}
