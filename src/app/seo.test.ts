import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import robots from "./robots";
import sitemap from "./sitemap";

describe("metadata SEO", () => {
  it("publica robots y sitemap únicamente en el dominio canónico", () => {
    const robotsConfig = robots();
    const sitemapEntries = sitemap();

    expect(robotsConfig.sitemap).toBe("https://diagnostico.tecrural.es/sitemap.xml");
    expect(JSON.stringify(robotsConfig)).not.toContain("vercel.app");
    expect(sitemapEntries.map(({ url }) => url)).toEqual([
      "https://diagnostico.tecrural.es/",
      "https://diagnostico.tecrural.es/contacto",
      "https://diagnostico.tecrural.es/privacidad",
      "https://diagnostico.tecrural.es/aviso-legal",
      "https://diagnostico.tecrural.es/cookies",
    ]);
    expect(JSON.stringify(sitemapEntries)).not.toContain("vercel.app");
  });

  it("redirige permanentemente solo el alias Vercel de producción", async () => {
    const redirects = await nextConfig.redirects?.();
    const aliasRedirect = redirects?.find((redirect) =>
      redirect.has?.some((condition) =>
        condition.type === "host" && condition.value === "tecrural-diagnostico.vercel.app",
      ),
    );

    expect(aliasRedirect).toMatchObject({
      source: "/:path*",
      destination: "https://diagnostico.tecrural.es/:path*",
      permanent: true,
    });
    expect(redirects).toHaveLength(1);
  });
});
