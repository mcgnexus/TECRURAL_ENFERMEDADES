import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./globals.css", () => ({}));
vi.mock("next/font/google", () => ({
  Manrope: () => ({ variable: "font-manrope" }),
  DM_Sans: () => ({ variable: "font-dm-sans" }),
}));

import RootLayout from "./layout";

const originalGaId = process.env.NEXT_PUBLIC_GA_ID;
const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (originalGaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
  else process.env.NEXT_PUBLIC_GA_ID = originalGaId;
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
});

const htmlDeLayout = () =>
  renderToStaticMarkup(
    createElement(RootLayout, { children: createElement("main", null, "Inicio") }),
  );

describe("scripts de terceros", () => {
  it("no incluye Google Analytics en el HTML con o sin ID configurado", () => {
    for (const gaId of [undefined, "G-TEST123456"]) {
      if (gaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
      else process.env.NEXT_PUBLIC_GA_ID = gaId;

      const html = htmlDeLayout();

      expect(html).not.toContain("googletagmanager.com");
      expect(html).not.toContain("gtag/js");
      expect(html).not.toContain("dataLayer");
      expect(html).not.toContain("gtag('config'");
    }
  });

  it("carga el Meta Pixel solo en entorno de producción", () => {
    delete process.env.VERCEL_ENV;
    expect(htmlDeLayout()).not.toContain("facebook.com/tr");

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    const html = htmlDeLayout();

    // next/script con afterInteractive inyecta el script en el cliente tras la
    // hidratación; en el HTML del servidor solo se observa la imagen <noscript>.
    expect(html).toContain("facebook.com/tr?id=2175598836026526");
    expect(html).not.toContain("googletagmanager.com");
  });

  it("mantiene el envío first-party y el buffer local sin invocar gtag", async () => {
    const valores = new Map<string, string>();
    const gtag = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("window", { gtag });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => valores.get(key) ?? null,
      setItem: (key: string, value: string) => valores.set(key, value),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { trackEvento, volcarEventos } = await import("../lib/analitica");
    trackEvento("portada_vista");
    await volcarEventos();

    expect(JSON.parse(valores.get("tr-eventos") ?? "[]")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/eventos",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    expect(gtag).not.toHaveBeenCalled();
  });
});
