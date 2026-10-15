import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { MetaPixel } from "@/components/MetaPixel";
import { SITE_URL, TWITTER_IMAGES, openGraphDeRuta } from "@/lib/seo";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  title: {
    default: "TECRURAL | Orientación fitosanitaria por foto",
    template: "%s | TECRURAL",
  },
  description:
    "Toma una foto de tu cultivo y obtén una orientación inicial sobre los síntomas observados, con recomendaciones de manejo. No es un diagnóstico fitosanitario definitivo.",
  keywords: ["agricultura", "fitosanidad", "síntomas cultivo", "orientación", "revisión técnica", "Andalucía"],
  authors: [{ name: "TECRURAL" }],
  openGraph: {
    ...openGraphDeRuta("/"),
    title: "TECRURAL | Orientación fitosanitaria por foto",
    description: "Orientación inicial sobre los síntomas de tu cultivo a partir de una foto.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TECRURAL | Orientación fitosanitaria por foto",
    description: "Orientación inicial sobre los síntomas de tu cultivo a partir de una foto.",
    images: TWITTER_IMAGES,
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
    <html lang="es" className={`h-full antialiased ${manrope.variable} ${dmSans.variable}`}>
      <head>
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
      </head>
      <body className="min-h-full flex flex-col bg-tr-paper">
      {isProduction && (
        <>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js', { scope: '/' })
                      .catch((error) => console.error('No se pudo registrar el service worker:', error));
                  });
                }
              `,
            }}
          />
          <MetaPixel />
        </>
      )}
        {children}
      </body>
    </html>
  );
}
