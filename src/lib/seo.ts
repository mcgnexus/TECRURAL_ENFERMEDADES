/**
 * Metadatos SEO compartidos entre el layout y las páginas públicas.
 *
 * Fuente única del origen canónico y de la imagen de compartido. La imagen se
 * define aquí una sola vez porque, cuando una página declara su propio objeto
 * `openGraph`, Next reemplaza por completo el del layout: si las páginas no la
 * incluyen, el og:image desaparece.
 */
import type { Metadata } from "next";

export const SITE_URL = "https://diagnostico.tecrural.es";

export const OG_IMAGE_PATH = "/og-tecrural.jpg";

export const OG_IMAGE = {
  url: OG_IMAGE_PATH,
  width: 1200,
  height: 630,
  alt: "Rama de olivo con manchas foliares, con un olivar al fondo",
};

export const TWITTER_IMAGES = [OG_IMAGE_PATH];

/**
 * openGraph base para una ruta: url absoluta, imagen de compartido y los campos
 * (`type`, `locale`, `siteName`) que una página pierde al reemplazar el
 * openGraph del layout. El `title` y la `description` los hereda Next desde los
 * metadatos de nivel superior de cada página.
 */
export function openGraphDeRuta(path: string): NonNullable<Metadata["openGraph"]> {
  return {
    url: new URL(path, SITE_URL).toString(),
    siteName: "TECRURAL",
    type: "website",
    locale: "es_ES",
    images: [OG_IMAGE],
  };
}
