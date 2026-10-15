import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./globals.css", () => ({}));

import RootLayout from "./layout";

const originalGaId = process.env.NEXT_PUBLIC_GA_ID;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalGaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
  else process.env.NEXT_PUBLIC_GA_ID = originalGaId;
});

describe("analítica sin terceros", () => {
  it("no incluye Google Analytics en el HTML con o sin ID configurado", () => {
    for (const gaId of [undefined, "G-TEST123456"]) {
      if (gaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
      else process.env.NEXT_PUBLIC_GA_ID = gaId;

      const html = renderToStaticMarkup(
        createElement(RootLayout, { children: createElement("main", null, "Inicio") }),
      );

      expect(html).not.toContain("googletagmanager.com");
      expect(html).not.toContain("gtag/js");
      expect(html).not.toContain("dataLayer");
      expect(html).not.toContain("gtag('config'");
    }
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
