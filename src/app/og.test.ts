import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";

vi.mock("./globals.css", () => ({}));
vi.mock("next/font/google", () => ({
  Manrope: () => ({ variable: "font-manrope" }),
  DM_Sans: () => ({ variable: "font-dm-sans" }),
}));

import { metadata as layoutMetadata } from "./layout";
import { metadata as adminMetadata } from "./admin/layout";
import { metadata as avisoLegalMetadata } from "./aviso-legal/page";
import { metadata as bajaMetadata } from "./baja/layout";
import { metadata as contactoMetadata } from "./contacto/page";
import { metadata as cookiesMetadata } from "./cookies/page";
import { metadata as offlineMetadata } from "./offline/layout";
import { metadata as privacidadMetadata } from "./privacidad/page";

type ImagenOg = { url: string; width?: number; height?: number; alt?: string };

function primerImagen(metadata: Metadata): ImagenOg {
  const { images } = metadata.openGraph ?? {};
  const lista = Array.isArray(images) ? images : [images];
  return lista[0] as ImagenOg;
}

function twitter(metadata: Metadata) {
  return metadata.twitter as { card?: string; images?: unknown[] } | null | undefined;
}

function og(metadata: Metadata) {
  return metadata.openGraph as
    | { type?: string; locale?: string; siteName?: string }
    | null
    | undefined;
}

const IMAGEN = {
  url: "/og-tecrural.jpg",
  width: 1200,
  height: 630,
};

const PAGINAS_PUBLICAS: [string, Metadata][] = [
  ["portada", layoutMetadata],
  ["contacto", contactoMetadata],
  ["privacidad", privacidadMetadata],
  ["aviso-legal", avisoLegalMetadata],
  ["cookies", cookiesMetadata],
];

describe("imagen de compartido", () => {
  it("la portada publica og:image y tarjeta Twitter de imagen grande", () => {
    expect(primerImagen(layoutMetadata)).toMatchObject(IMAGEN);
    expect(primerImagen(layoutMetadata).alt).toBeTruthy();

    expect(twitter(layoutMetadata)?.card).toBe("summary_large_image");
    expect(twitter(layoutMetadata)?.images).toContain("/og-tecrural.jpg");
  });

  it("las páginas públicas mantienen imagen y campos que aporta el layout", () => {
    for (const [nombre, metadata] of PAGINAS_PUBLICAS) {
      expect(primerImagen(metadata), nombre).toMatchObject(IMAGEN);
      expect(og(metadata)?.type, nombre).toBe("website");
      expect(og(metadata)?.locale, nombre).toBe("es_ES");
      expect(og(metadata)?.siteName, nombre).toBe("TECRURAL");
    }
  });

  it("las rutas privadas se marcan como no indexables", () => {
    for (const [nombre, metadata] of [
      ["baja", bajaMetadata],
      ["offline", offlineMetadata],
      ["admin", adminMetadata],
    ] as [string, Metadata][]) {
      expect(metadata.robots, nombre).toMatchObject({ index: false, follow: false });
    }
  });

  it("el activo existe con las dimensiones, formato y peso esperados", async () => {
    const ruta = path.resolve(process.cwd(), "public/og-tecrural.jpg");
    const { size } = await fs.promises.stat(ruta);
    const info = await sharp(ruta).metadata();

    expect(info.format).toBe("jpeg");
    expect(info.width).toBe(1200);
    expect(info.height).toBe(630);
    expect(size).toBeLessThan(300 * 1024);
  });
});
