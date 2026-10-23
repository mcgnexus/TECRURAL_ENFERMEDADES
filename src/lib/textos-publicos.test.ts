import { describe, expect, it } from "vitest";
import {
  LIMITE_GRATIS,
  LIMITE_AMPLIADO,
  PROPOSITO_CORREO,
  REVISION_TECNICA,
  TIEMPO_ANALISIS,
  LIMITES_HONESTOS,
  IDENTIDAD,
  SIN_REGISTRO,
} from "./textos-publicos";

/**
 * Los textos públicos son promesas repetidas en varias pantallas. Estas
 * pruebas fijan lo que se promete y lo que no se puede decir: jerga interna,
 * compromisos de tiempo que el servicio no garantiza y fórmulas que la
 * evaluación de usuarios marcó como confusas.
 */

describe("límites de uso", () => {
  it("el límite gratuito declara cuántos análisis y cada cuánto", () => {
    expect(LIMITE_GRATIS).toContain("1 análisis");
    expect(LIMITE_GRATIS).toContain("7 días");
  });

  it("el límite ampliado declara cuántos análisis y cada cuánto", () => {
    expect(LIMITE_AMPLIADO).toContain("6 análisis");
    expect(LIMITE_AMPLIADO).toContain("7 días");
  });

  it("el límite gratuito va sin registro", () => {
    expect(`${LIMITE_GRATIS}, ${SIN_REGISTRO}`).toContain("sin registro");
    expect(SIN_REGISTRO).toBe("sin registro");
  });
});

describe("propósito del correo", () => {
  it("aclara que el informe se abre en pantalla", () => {
    expect(PROPOSITO_CORREO).toContain("aquí mismo");
  });

  it("aclara que el informe no llega por correo", () => {
    expect(PROPOSITO_CORREO).toContain("No te lo enviamos por correo");
  });
});

describe("revisión técnica", () => {
  it("es opcional y sin coste", () => {
    expect(REVISION_TECNICA).toContain("opcional");
    expect(REVISION_TECNICA).toContain("no tiene coste");
  });

  it("compromete 48 horas como máximo", () => {
    expect(REVISION_TECNICA).toContain("48 horas");
  });
});

describe("texto del análisis", () => {
  it("da un tiempo orientativo sin prometer un máximo", () => {
    expect(TIEMPO_ANALISIS).toContain("Suele tardar");
  });
});

describe("límites honestos", () => {
  it("promete no llamar para vender", () => {
    expect(LIMITES_HONESTOS).toContain("No te llamamos para vender");
  });

  it("promete avisar cuando la foto no basta", () => {
    expect(LIMITES_HONESTOS).toContain("si la foto no basta, te lo decimos");
  });
});

describe("identidad", () => {
  it("muestra responsable, ubicación y correo reales", () => {
    expect(IDENTIDAD.responsable).toContain("Manuel Carrasco");
    expect(IDENTIDAD.ubicacion).toContain("Granada");
    expect(IDENTIDAD.correo).toMatch(/@/);
  });
});

describe("ausencia de jerga y fórmulas retiradas", () => {
  const todo = JSON.stringify([
    LIMITE_GRATIS,
    LIMITE_AMPLIADO,
    PROPOSITO_CORREO,
    REVISION_TECNICA,
    TIEMPO_ANALISIS,
    LIMITES_HONESTOS,
  ]);

  it("no usa jerga fitosanitaria ni técnica", () => {
    expect(todo).not.toMatch(/fitosanitari/i);
    expect(todo).not.toMatch(/seudonimiz/i);
  });

  it("no utiliza fórmulas retiradas por confusas", () => {
    expect(todo).not.toContain("según demanda");
    expect(todo).not.toContain("Primera prueba sin registro");
    expect(todo).not.toContain("límite semanal de análisis");
  });
});
