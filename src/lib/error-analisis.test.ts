import { describe, it, expect } from "vitest";
import { mensajeAmigable, errorDeRespuesta, ErrorAnalisis } from "./error-analisis";

/**
 * Traducción de errores del análisis.
 *
 * El fallo que motivó estas pruebas: la función contemplaba 400/413/429/502/503,
 * pero se la llamaba sin el estado HTTP, así que todas esas ramas caían al
 * mensaje genérico y un problema concreto le llegaba al agricultor como un fallo
 * de conexión.
 */

describe("mensajeAmigable: red caída", () => {
  it("un TypeError se explica como falta de conexión", () => {
    expect(mensajeAmigable(new TypeError("Failed to fetch"))).toBe(
      "Sin conexión suficiente. Comprueba tu red y reintenta: no has perdido las fotos ni los datos."
    );
  });
});

describe("mensajeAmigable: el estado conservado (el caso que fallaba)", () => {
  it("502 usa el mensaje del servidor", () => {
    const servidor =
      "No hemos podido interpretar bien esta foto. Prueba a repetirla con más luz y el síntoma bien enfocado.";
    expect(mensajeAmigable(new ErrorAnalisis(502, servidor))).toBe(servidor);
  });

  it("502 sin mensaje usa el de reserva", () => {
    expect(mensajeAmigable(new ErrorAnalisis(502))).toContain(
      "No hemos podido interpretar bien esta foto"
    );
  });

  it("429 usa el mensaje del servidor, no un fallo de conexión", () => {
    const cuota = "Has alcanzado el límite de análisis de este dispositivo.";
    const salida = mensajeAmigable(new ErrorAnalisis(429, cuota));
    expect(salida).toBe(cuota);
    expect(salida).not.toContain("conexión");
  });

  it("429 sin mensaje usa el de reserva", () => {
    expect(mensajeAmigable(new ErrorAnalisis(429))).toContain("límite de uso temporal");
  });

  it("400 usa el mensaje del servidor", () => {
    const falta = "Falta la foto principal. Sube una foto del síntoma para continuar.";
    expect(mensajeAmigable(new ErrorAnalisis(400, falta))).toBe(falta);
  });

  it("413 habla de tamaño y no de formato", () => {
    expect(mensajeAmigable(new ErrorAnalisis(413))).toContain("demasiado grande");
  });

  it("503 avisa de que el servicio no está disponible", () => {
    expect(mensajeAmigable(new ErrorAnalisis(503))).toContain("no está disponible");
  });

  it("500 sin mensaje da el genérico", () => {
    expect(mensajeAmigable(new ErrorAnalisis(500))).toContain(
      "No hemos podido completar el análisis"
    );
  });
});

describe("mensajeAmigable: entradas degeneradas", () => {
  it("un mensaje en blanco cae al de reserva", () => {
    expect(mensajeAmigable(new ErrorAnalisis(502, "   "))).toContain(
      "No hemos podido interpretar bien esta foto"
    );
  });

  it("un Error normal con texto se respeta", () => {
    expect(mensajeAmigable(new Error("algo raro"))).toBe("algo raro");
  });

  it("un Error normal sin texto da el genérico", () => {
    expect(mensajeAmigable(new Error(""))).toContain("No hemos podido completar el análisis");
  });

  it("un valor que no es Error da el genérico", () => {
    expect(mensajeAmigable("vaya")).toContain("No hemos podido completar el análisis");
    expect(mensajeAmigable(undefined)).toContain("No hemos podido completar el análisis");
    expect(mensajeAmigable(null)).toContain("No hemos podido completar el análisis");
  });
});

describe("errorDeRespuesta", () => {
  it("lee el estado y el mensaje de un JSON de nuestra API", async () => {
    const r = new Response(JSON.stringify({ error: "Falta la foto principal." }), { status: 400 });
    const e = await errorDeRespuesta(r);
    expect(e).toBeInstanceOf(ErrorAnalisis);
    expect(e.status).toBe(400);
    expect(e.message).toBe("Falta la foto principal.");
    expect(mensajeAmigable(e)).toBe("Falta la foto principal.");
  });

  it("con texto plano (el 413 de la plataforma) conserva el estado y no el texto", async () => {
    // La plataforma responde text/plain en un 413. Sin el try/catch, el
    // response.json() lanzaba SyntaxError y se perdía hasta el estado.
    const r = new Response("Request Entity Too Large", { status: 413 });
    const e = await errorDeRespuesta(r);
    expect(e.status).toBe(413);
    expect(e.message).toBe("");
    expect(mensajeAmigable(e)).toContain("demasiado grande");
    expect(mensajeAmigable(e)).not.toContain("Request Entity");
  });

  it("un JSON con error vacío cae al mensaje de reserva", async () => {
    const r = new Response(JSON.stringify({ error: "" }), { status: 502 });
    const e = await errorDeRespuesta(r);
    expect(mensajeAmigable(e)).toContain("No hemos podido interpretar bien esta foto");
  });

  it("una respuesta no JSON en 500 da el genérico", async () => {
    const r = new Response("no json", { status: 500 });
    const e = await errorDeRespuesta(r);
    expect(mensajeAmigable(e)).toContain("No hemos podido completar el análisis");
  });

  it("un JSON válido sin campo error no inventa mensaje", async () => {
    const r = new Response(JSON.stringify({ algo: 1 }), { status: 503 });
    const e = await errorDeRespuesta(r);
    expect(e.status).toBe(503);
    expect(e.message).toBe("");
    expect(mensajeAmigable(e)).toContain("no está disponible");
  });
});

describe("ErrorAnalisis", () => {
  it("conserva estado, nombre y prototipo", () => {
    const e = new ErrorAnalisis(429, "x");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ErrorAnalisis);
    expect(e.status).toBe(429);
    expect(e.name).toBe("ErrorAnalisis");
  });
});
