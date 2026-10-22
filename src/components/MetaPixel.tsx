"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

const PIXEL_ID = "2175598836026526";

type ParamsMeta = Record<string, unknown>;

declare global {
  interface Window {
    /** El snippet de fbevents acepta argumentos variables (track, trackCustom…). */
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Conversión de Meta desde el cliente. El píxel solo se carga en producción
 * (ver el montaje condicional del layout), así que en desarrollo es un no-op.
 * Los eventos estándar (Lead) alimentan las campañas; los personalizados
 * (RevisionTecnica, SuscripcionCorreo) matizan el valor de cada lead.
 */
export function trackMeta(evento: string, params: ParamsMeta = {}): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  const estandares = ["PageView", "Lead", "CompleteRegistration", "Purchase", "Contact"];
  if (estandares.includes(evento)) {
    window.fbq("track", evento, params);
  } else {
    window.fbq("trackCustom", evento, params);
  }
}

export function MetaPixel() {
  const pathname = usePathname();
  const cargaInicial = useRef(true);

  useEffect(() => {
    // El PageView inicial lo dispara el propio snippet; aquí solo se cuentan
    // las navegaciones del cliente, que next/script no vuelve a ejecutar.
    if (cargaInicial.current) {
      cargaInicial.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
