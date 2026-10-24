import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  construirCorreoInforme,
  enviarEnlaceInforme,
  envioInformeHabilitado,
} from "./email-envio";

/**
 * La entrega del enlace es la única parte del correo que no se puede probar en
 * vivo sin enviar. Estas pruebas fijan lo que no debe cambiar:
 *
 * - sin clave no hay función y ninguna pantalla puede prometerla;
 * - el correo no lleva el contenido clínico;
 * - solo un 2xx CON id de Resend es aceptación; el resto es fallo y la UI debe
 *   seguir ofreciendo el informe y el reintento.
 */

const ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ENV };
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  delete process.env.RESEND_REPLY_TO;
  process.env.NEXT_PUBLIC_SITE_URL = "https://diagnostico.tecrural.es";
});

afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("envioInformeHabilitado", () => {
  it("se apaga si falta la clave o el remitente", () => {
    expect(envioInformeHabilitado()).toBe(false);
    process.env.RESEND_API_KEY = "re_123";
    expect(envioInformeHabilitado()).toBe(false);
    process.env.RESEND_FROM = "TecRural <informes@tecrural.es>";
    expect(envioInformeHabilitado()).toBe(true);
  });

  it("un valor vacío no habilita el envío", () => {
    process.env.RESEND_API_KEY = "   ";
    process.env.RESEND_FROM = "   ";
    expect(envioInformeHabilitado()).toBe(false);
  });
});

describe("contenido del correo", () => {
  it("contiene un enlace y no el diagnóstico ni la dosis", () => {
    const correo = construirCorreoInforme("token-de-prueba");
    const todo = `${correo.asunto}\n${correo.texto}\n${correo.html}`;
    expect(correo.url).toBe(
      "https://diagnostico.tecrural.es/informe/token-de-prueba"
    );
    expect(todo).toContain("90 días");
    expect(todo).not.toMatch(/dosis|materia activa|plazo de seguridad|mancha|mildiu/i);
  });
});

describe("enviarEnlaceInforme", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_123";
    process.env.RESEND_FROM = "TecRural <informes@tecrural.es>";
    process.env.RESEND_REPLY_TO = "respuestas@tecrural.es";
  });

  it("envía un payload mínimo con la clave de idempotencia del intento", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "correo-1" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await enviarEnlaceInforme({
      to: "agricultor@example.com",
      token: "token-de-prueba",
      diagnosticoId: "uuid-diagnostico",
      intento: 2,
    });

    expect(resultado).toEqual({ aceptado: true, id: "correo-1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers["Idempotency-Key"]).toBe("uuid-diagnostico:2");
    expect(init.headers.Authorization).toBe("Bearer re_123");

    const payload = JSON.parse(init.body);
    expect(payload.to).toEqual(["agricultor@example.com"]);
    expect(payload.reply_to).toBe("respuestas@tecrural.es");
    expect(payload.subject).toContain("enlace válido 90 días");
    expect(payload.text).toContain("/informe/token-de-prueba");
    expect(JSON.stringify(payload)).not.toMatch(/dosis|materia activa/i);
  });

  it("solo acepta 2xx con id", async () => {
    const casos = [
      { status: 200, body: {} },
      { status: 202, body: { id: "" } },
      { status: 429, body: { id: "no-cuenta" } },
      { status: 402, body: { message: "sin saldo" } },
      { status: 500, body: { id: "no-cuenta" } },
    ];

    for (const caso of casos) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(caso.body), { status: caso.status })
        )
      );
      const resultado = await enviarEnlaceInforme({
        to: "agricultor@example.com",
        token: "token-de-prueba",
      });
      expect(resultado.aceptado).toBe(false);
    }
  });

  it("un timeout o fallo de red es fallo, no aceptación", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("timeout"))
    );
    const resultado = await enviarEnlaceInforme({
      to: "agricultor@example.com",
      token: "token-de-prueba",
    });
    expect(resultado).toEqual({ aceptado: false, motivo: "red" });
  });

  it("sin configuración no llama a la red", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await enviarEnlaceInforme({
      to: "agricultor@example.com",
      token: "token-de-prueba",
    });

    expect(resultado).toEqual({ aceptado: false, motivo: "no_configurado" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
