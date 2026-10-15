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

export const VALOR_OTRO = "__otro__";
export const VALOR_NO_LO_SE = "__no_lo_se__";

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
