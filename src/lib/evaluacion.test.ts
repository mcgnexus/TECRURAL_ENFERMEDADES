import { describe, it, expect } from "vitest";
import {
  acierta,
  resumirEvaluacion,
  resultadoDe,
  type CasoEvaluable,
  type RespuestaEvaluable,
} from "./evaluacion";

const CASO: CasoEvaluable = {
  id: "olivo-repilo",
  cultivo: "Olivo",
  sintoma: "manchas circulares",
  esperado: {
    tipo: "enfermedad",
    categoriaAceptable: ["repilo", "mancha"],
    requiereExperto: true,
  },
};

function respuesta(
  tipo: string,
  nombre: string,
  requiere: boolean,
  confianza = 0.7
): RespuestaEvaluable {
  return {
    diagnostico: { tipo, nombre, confianza },
    confianza_identificacion: 0.8,
    requiere_experto: requiere,
  };
}

describe("acierta", () => {
  it("acuerdo con tipo, categoría y requiere_experto correctos", () => {
    expect(acierta(CASO, respuesta("enfermedad", "Repilo del olivo", true))).toBe(true);
  });

  it("desacuerdo si el tipo no coincide", () => {
    expect(acierta(CASO, respuesta("plaga", "Repilo", true))).toBe(false);
  });

  it("desacuerdo si el nombre no entra en las categorías aceptables", () => {
    expect(acierta(CASO, respuesta("enfermedad", "Tuberculosis", true))).toBe(false);
  });

  it("desacuerdo si requiere_experto no coincide", () => {
    expect(acierta(CASO, respuesta("enfermedad", "Repilo", false))).toBe(false);
  });

  it("sin esperado definido no hay acuerdo posible", () => {
    expect(acierta({ id: "x" }, respuesta("enfermedad", "Repilo", true))).toBe(false);
  });

  it("ignora requiere_experto si el técnico no lo definió", () => {
    const casoSinExperto: CasoEvaluable = {
      id: "x",
      esperado: { tipo: "sano" },
    };
    expect(acierta(casoSinExperto, respuesta("sano", "Olivo sano", true))).toBe(true);
  });
});

describe("resultadoDe", () => {
  it("conserva el error cuando la llamada falló", () => {
    const r = resultadoDe(CASO, undefined, "503 presupuesto");
    expect(r.error).toBe("503 presupuesto");
    expect(r.acuerdo).toBe(false);
  });

  it("extrae confianza y veredicto de la respuesta", () => {
    const r = resultadoDe(CASO, respuesta("enfermedad", "Repilo del olivo", true, 0.55));
    expect(r.acuerdo).toBe(true);
    expect(r.confianza).toBe(0.55);
  });
});

describe("resumirEvaluacion", () => {
  it("agrupa acuerdos por cultivo y tipo esperado", () => {
    const resultados = [
      resultadoDe(CASO, respuesta("enfermedad", "Repilo", true)),
      resultadoDe(CASO, respuesta("plaga", "Prays", false)),
      resultadoDe(
        { ...CASO, cultivo: "Vid", esperado: { tipo: "enfermedad", categoriaAceptable: ["mildiu"] } },
        respuesta("enfermedad", "Mildiu", true)
      ),
    ];
    const resumen = resumirEvaluacion(resultados);
    expect(resumen.total).toBe(3);
    expect(resumen.acuerdos).toBe(2);
    const olivo = resumen.porCultivo.find((g) => g.clave === "Olivo");
    expect(olivo).toEqual({ clave: "Olivo", total: 2, acuerdos: 1 });
  });

  it("los errores no cuentan en el total ni en los tramos", () => {
    const resultados = [
      resultadoDe(CASO, respuesta("enfermedad", "Repilo", true, 0.9)),
      resultadoDe(CASO, undefined, "error de red"),
    ];
    const resumen = resumirEvaluacion(resultados);
    expect(resumen.total).toBe(1);
    const tramoAlto = resumen.calibracion.find((t) => t.tramo === "0.8-1.0");
    expect(tramoAlto).toEqual({ tramo: "0.8-1.0", casos: 1, acuerdos: 1 });
  });

  it("calcula el balance de requiere_experto (tp/tn/fp/fn)", () => {
    const resultados = [
      resultadoDe(CASO, respuesta("enfermedad", "Repilo", true)), // tp
      resultadoDe(CASO, respuesta("enfermedad", "Repilo", false)), // fn
      resultadoDe(
        { ...CASO, esperado: { tipo: "sano", requiereExperto: false } },
        respuesta("sano", "Olivo sano", false) // tn
      ),
      resultadoDe(
        { ...CASO, esperado: { tipo: "sano", requiereExperto: false } },
        respuesta("sano", "Olivo sano", true) // fp
      ),
    ];
    const resumen = resumirEvaluacion(resultados);
    expect(resumen.requiereExperto).toEqual({ tp: 1, tn: 1, fp: 1, fn: 1 });
  });

  it("coloca la confianza en el tramo correcto", () => {
    const resultados = [resultadoDe(CASO, respuesta("enfermedad", "Repilo", true, 0.45))];
    const resumen = resumirEvaluacion(resultados);
    expect(resumen.calibracion.find((t) => t.tramo === "0.4-0.6")?.casos).toBe(1);
    expect(resumen.calibracion.find((t) => t.tramo === "0.0-0.4")?.casos).toBe(0);
  });
});
