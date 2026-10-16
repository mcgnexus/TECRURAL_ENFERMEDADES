import { describe, expect, it } from "vitest";
import type { DiagnosticoPanelFila, DiagnosticoResponse } from "@/types/diagnostico";
import {
  FILTROS_DIAG_VACIOS,
  aplicarFiltrosDiag,
  confianzaPct,
  hayFiltrosDiagActivos,
  nivelSenalDiag,
  opcionesDiag,
  ordenarDiagnosticos,
  resultadoDe,
} from "./diagnosticos";

function respuesta(parcial: Partial<DiagnosticoResponse> = {}): DiagnosticoResponse {
  return {
    organo_detectado: "hoja",
    especie_identificada: "Olea europaea",
    confianza_identificacion: 0.9,
    diagnostico: {
      tipo: "enfermedad",
      nombre: "Alternaria",
      sintomas_observados: ["manchas"],
      confianza: 0.8,
      gravedad: "moderada",
    },
    estado_madurez: { aplica: false, estado: "", dias_estimados_cosecha: 0 },
    recomendacion: "Revisar con técnico.",
    requiere_experto: false,
    ...parcial,
  } as DiagnosticoResponse;
}

function fila(id: string, parcial: Partial<DiagnosticoPanelFila> = {}): DiagnosticoPanelFila {
  return {
    usuario_id: "u1",
    organo: "hoja",
    especie: "Olea europaea",
    nombre_planta: null,
    proveedor: "gemini",
    feedback_usuario: null,
    contexto_usuario: null,
    created_at: "2026-03-10T10:00:00.000Z",
    diagnostico: respuesta(),
    id,
    ...parcial,
  };
}

const A = fila("a", { created_at: "2026-03-10T10:00:00.000Z" });
const B = fila("b", {
  created_at: "2026-03-12T10:00:00.000Z",
  proveedor: "openai",
  feedback_usuario: "Sí, coincido",
  diagnostico: respuesta({
    diagnostico: {
      tipo: "plaga",
      nombre: "Ácaros",
      sintomas_observados: ["punteado"],
      confianza: 0.2,
      gravedad: "severa",
    },
    requiere_experto: true,
  }),
});
const C = fila("c", {
  created_at: "2026-02-01T10:00:00.000Z",
  diagnostico: respuesta({
    diagnostico: {
      tipo: "sano",
      nombre: "Sin anomalías",
      sintomas_observados: [],
      confianza: null as unknown as number,
      gravedad: "leve",
    },
  }),
});

describe("resultadoDe", () => {
  it("extrae tipo, nombre, gravedad, confianza y recomendación", () => {
    const r = resultadoDe(A);
    expect(r.tipo).toBe("enfermedad");
    expect(r.nombre).toBe("Alternaria");
    expect(r.gravedad).toBe("moderada");
    expect(r.confianza).toBe(0.8);
    expect(r.recomendacion).toBe("Revisar con técnico.");
    expect(r.requiere_experto).toBe(false);
    expect(r.ilegible).toBe(false);
  });

  it("marca como ilegible un resultado ausente sin lanzar", () => {
    const r = resultadoDe(fila("d", { diagnostico: null }));
    expect(r.ilegible).toBe(true);
    expect(r.tipo).toBeNull();
    expect(r.sintomas).toEqual([]);
  });

  it("extrae diferenciales y listas auxiliares", () => {
    const r = resultadoDe(
      fila("e", {
        diagnostico: respuesta({
          diagnosticos_diferenciales: [
            { nombre: "Oídio", confianza: 0.3, por_que_descartado: "falta polvo" },
          ],
          hallazgos_negativos: ["sin polvo"],
          datos_faltantes: ["foto del envés"],
        }),
      })
    );
    expect(r.diferenciales).toEqual([
      { nombre: "Oídio", confianza: 0.3, por_que_descartado: "falta polvo" },
    ]);
    expect(r.hallazgos_negativos).toEqual(["sin polvo"]);
    expect(r.datos_faltantes).toEqual(["foto del envés"]);
  });
});

describe("aplicarFiltrosDiag", () => {
  const items = [A, B, C];

  it("sin filtros devuelve todo", () => {
    expect(aplicarFiltrosDiag(items, FILTROS_DIAG_VACIOS)).toHaveLength(3);
  });

  it("filtra por tipo, gravedad y proveedor", () => {
    expect(aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, tipo: "plaga" })).toEqual([B]);
    expect(aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, gravedad: "severa" })).toEqual([B]);
    expect(aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, proveedor: "openai" })).toEqual([B]);
  });

  it("filtra por requiere_experto y por tener feedback", () => {
    expect(aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, requiereExperto: true })).toEqual([B]);
    expect(aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, requiereExperto: false })).toEqual([A, C]);
    expect(aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, conFeedback: true })).toEqual([B]);
    expect(aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, conFeedback: false })).toEqual([A, C]);
  });

  it("la búsqueda mira especie, enfermedad, cultivo y feedback", () => {
    expect(aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, texto: "alternaria" })).toEqual([A]);
    expect(aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, texto: "OLEA" })).toHaveLength(3);
    expect(
      aplicarFiltrosDiag(
        [A, B],
        { ...FILTROS_DIAG_VACIOS, texto: "coincido" }
      )
    ).toEqual([B]);
  });

  it("el rango de fechas es inclusivo", () => {
    expect(
      aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, desde: "2026-03-10", hasta: "2026-03-10" })
    ).toEqual([A]);
    expect(aplicarFiltrosDiag(items, { ...FILTROS_DIAG_VACIOS, desde: "2026-03-12" })).toEqual([B]);
  });
});

describe("ordenarDiagnosticos", () => {
  it("ordena por fecha", () => {
    expect(ordenarDiagnosticos([C, A, B], { campo: "created_at", dir: "asc" }).map((d) => d.id)).toEqual([
      "c", "a", "b",
    ]);
  });

  it("ordena por confianza y deja los nulos al final", () => {
    const lista = [C, B, A];
    expect(ordenarDiagnosticos(lista, { campo: "confianza", dir: "desc" }).map((d) => d.id)).toEqual([
      "a", "b", "c",
    ]);
    expect(ordenarDiagnosticos(lista, { campo: "confianza", dir: "asc" }).map((d) => d.id)).toEqual([
      "b", "a", "c",
    ]);
  });

  it("ordena gravedad por severidad, no alfabéticamente, y no muta", () => {
    const lista = [A, C, B];
    const copia = lista.slice();
    expect(ordenarDiagnosticos(lista, { campo: "gravedad", dir: "desc" }).map((d) => d.id)).toEqual([
      "b", "a", "c",
    ]);
    expect(lista).toEqual(copia);
  });
});

describe("utilidades", () => {
  it("opcionesDiag recoge valores únicos ordenados", () => {
    expect(opcionesDiag([A, B, C])).toEqual({
      gravedad: ["leve", "moderada", "severa"],
      proveedor: ["gemini", "openai"],
      tipo: ["enfermedad", "plaga", "sano"],
    });
  });

  it("hayFiltrosDiagActivos detecta cambios", () => {
    expect(hayFiltrosDiagActivos(FILTROS_DIAG_VACIOS)).toBe(false);
    expect(hayFiltrosDiagActivos({ ...FILTROS_DIAG_VACIOS, tipo: "sano" })).toBe(true);
  });

  it("confianzaPct y nivelSenalDiag convierten la escala 0–1", () => {
    expect(confianzaPct(0.8)).toBe("80 %");
    expect(confianzaPct(null)).toBe("—");
    expect(nivelSenalDiag(0.8)).toBe("claras");
    expect(nivelSenalDiag(0.5)).toBe("moderadas");
    expect(nivelSenalDiag(0.2)).toBe("pocas");
    expect(nivelSenalDiag(null)).toBeNull();
  });
});
