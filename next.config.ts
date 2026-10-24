import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    qualities: [70, 75],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "tecrural-diagnostico.vercel.app" }],
        destination: "https://diagnostico.tecrural.es/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
      {
        source: "/historial",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
      {
        // El informe se abre con un token: no puede quedar en cachés
        // compartidas ni volver a mostrarse tras cerrar el enlace.
        source: "/informe/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      ...["/aguacate.jpg", "/og-tecrural.jpg", "/icon-192.png", "/icon-512.png"].map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      })),
    ];
  },
  turbopack: {},
};

export default nextConfig;
