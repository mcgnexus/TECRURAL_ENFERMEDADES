import { describe, expect, it } from "vitest";
import { leadSchema } from "./route";

/**
 * Regla de contacto del formulario de solicitud.
 *
 * El informe completo (y su PDF) se desbloquea a cambio de un teléfono O un
 * correo: quien no quiere dar el número puede dejar el correo y viceversa. La
 * comprobación vive aquí porque el error del superRefine es lo que ve la
 * persona en pantalla, y un "Teléfono no válido" cuando no ha escrito ningún
 * teléfono sería un callejón sin salida.
 */

function cuerpo(parcial: Record<string, unknown> = {}) {
  return {
    origen: "contacto_directo",
    solicitud_respuesta: true,
    ...parcial,
  };
}

const erroresDe = (parcial: Record<string, unknown>) =>
  leadSchema.safeParse(cuerpo(parcial)).error?.issues.map((i) => i.message) ?? [];

describe("contacto: teléfono o correo", () => {
  it("acepta solo el teléfono y lo normaliza", () => {
    const r = leadSchema.safeParse(cuerpo({ telefono: " 600 123.456 " }));
    expect(r.success).toBe(true);
    expect(r.success && r.data.telefono).toBe("600123456");
  });

  it("acepta solo el correo y lo pasa a minúsculas", () => {
    const r = leadSchema.safeParse(cuerpo({ email: " Campo@Correo.ES " }));
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBe("campo@correo.es");
  });

  it("acepta los dos a la vez", () => {
    const r = leadSchema.safeParse(cuerpo({ telefono: "600123456", email: "a@b.es" }));
    expect(r.success).toBe(true);
  });

  it("rechaza el envío sin ningún canal de contacto", () => {
    expect(erroresDe({})).toContain(
      "Déjanos un teléfono o un correo para recibir el informe y poder contactarte."
    );
  });

  it("un teléfono o un correo en blanco cuenta como ausente, no como inválido", () => {
    // Regresión real: el regex vacío devolvía "Teléfono no válido" y tapaba el
    // mensaje que sí explica la solución.
    expect(erroresDe({ telefono: "   " })).toContain(
      "Déjanos un teléfono o un correo para recibir el informe y poder contactarte."
    );
    expect(erroresDe({ telefono: "" })).toContain(
      "Déjanos un teléfono o un correo para recibir el informe y poder contactarte."
    );
    expect(erroresDe({ email: "   " })).toContain(
      "Déjanos un teléfono o un correo para recibir el informe y poder contactarte."
    );
  });

  it("rechaza un teléfono mal formado aunque se deje correo", () => {
    expect(erroresDe({ telefono: "123", email: "a@b.es" })).toContain(
      "Teléfono no válido. Revisa el número indicado."
    );
  });

  it("rechaza un correo mal formado", () => {
    expect(erroresDe({ email: "campo@correo" })).toContain(
      "Correo no válido. Revisa la dirección indicada."
    );
  });

  it("sigue exigiendo un canal aunque no se pida revisión técnica", () => {
    // La separación de intenciones permite enviar "solo informe", pero el
    // contacto sigue siendo necesario para entregarlo.
    expect(erroresDe({ solicitud_respuesta: false })).toContain(
      "Déjanos un teléfono o un correo para recibir el informe y poder contactarte."
    );
  });

  it("acepta un envío sin revisión técnica (solo informe)", () => {
    // La casilla de solicitud dejó de ser obligatoria en el flujo posterior al
    // diagnóstico: quien solo quiere el informe no registra una solicitud de
    // contacto.
    const r = leadSchema.safeParse(cuerpo({ telefono: "600123456", solicitud_respuesta: false }));
    expect(r.success).toBe(true);
  });
});
