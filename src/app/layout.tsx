import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TECRURAL | Orientación fitosanitaria por foto",
    template: "%s | TECRURAL",
  },
  description:
    "Toma una foto de tu cultivo y obtén una orientación inicial sobre los síntomas observados, con recomendaciones de manejo. No es un diagnóstico fitosanitario definitivo.",
  keywords: ["agricultura", "fitosanidad", "síntomas cultivo", "orientación", "revisión técnica", "Andalucía"],
  authors: [{ name: "TECRURAL" }],
  openGraph: {
    title: "TECRURAL | Orientación fitosanitaria por foto",
    description: "Orientación inicial sobre los síntomas de tu cultivo a partir de una foto.",
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
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <meta name="color-scheme" content="light" />
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
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId}');
                `,
              }}
            />
          </>
        )}
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