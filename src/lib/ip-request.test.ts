import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ipCliente } from "./ip-request";

describe("ipCliente", () => {
  it("prefiere la cabecera asignada por Vercel sobre x-forwarded-for", () => {
    const request = new NextRequest("https://tecrural.test/api/leads", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.17",
        "x-forwarded-for": "198.51.100.99",
      },
    });

    expect(ipCliente(request)).toBe("203.0.113.17");
  });

  it("extrae y valida la primera IP de la cabecera reenviada", () => {
    const request = new NextRequest("https://tecrural.test/api/leads", {
      headers: { "x-forwarded-for": "2001:db8::1, 10.0.0.1" },
    });

    expect(ipCliente(request)).toBe("2001:db8::1");
  });

  it("no usa una cabecera con contenido que no sea una IP", () => {
    const request = new NextRequest("https://tecrural.test/api/leads", {
      headers: { "x-forwarded-for": "spoofed-value" },
    });

    expect(ipCliente(request)).toBe("desconocida");
  });
});
