import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TECRURAL Diagnóstico | Análisis fitosanitario por IA",
  description: "Diagnóstico de enfermedades, plagas y deficiencias en cultivos de Andalucía oriental usando inteligencia artificial. Toma una foto y obtén recomendaciones inmediatas.",
  keywords: ["agricultura", "fitosanitario", "diagnóstico", "IA", "cultivos", "Andalucía"],
  authors: [{ name: "TECRURAL" }],
  openGraph: {
    title: "TECRURAL Diagnóstico",
    description: "Análisis fitosanitario por IA para cultivos",
    type: "website",
    locale: "es_ES",
  },
  robots: "index, follow",
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#164B3B",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProduction = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";

  return (
    <html lang="es" className="h-full antialiased">
      <head>
        {isProduction && (
          <>
            <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            <meta name="apple-mobile-web-app-title" content="TECRURAL" />
            <link rel="apple-touch-icon" href="/icon-192.png" />
          </>
        )}
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col bg-tr-paper">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}