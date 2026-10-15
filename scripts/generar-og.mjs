/**
 * Genera la imagen de compartido (og:image) a partir del material del repositorio.
 *
 * Salida: public/og-tecrural.jpg (1200x630, JPEG). Se versiona el resultado; este
 * script solo hace falta para regenerarlo cuando cambie la foto o el logotipo.
 *
 *   node scripts/generar-og.mjs
 *
 * Usa sharp, que ya viene como dependencia de Next. No se añade solo.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANCHO = 1200;
const ALTO = 630;

const foto = path.join(raiz, "hoja olivo.jpg");
const logo = path.join(raiz, "TecRural_icono.png");
const destino = path.join(raiz, "public", "og-tecrural.jpg");

const MARGEN = 40;
const LADO_INSIGNIA = 144;
const RELLENO_INSIGNIA = 16;
const LADO_LOGO = LADO_INSIGNIA - RELLENO_INSIGNIA * 2;

// Degradado inferior para dar contraste sobre cualquier foto.
const cortina = Buffer.from(
  `<svg width="${ANCHO}" height="${ALTO}" xmlns="http://www.w3.org/2000/svg">
     <defs>
       <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
         <stop offset="55%" stop-color="#103b2f" stop-opacity="0"/>
         <stop offset="100%" stop-color="#103b2f" stop-opacity="0.82"/>
       </linearGradient>
     </defs>
     <rect width="${ANCHO}" height="${ALTO}" fill="url(#g)"/>
   </svg>`,
);

const marcoInsignia = Buffer.from(
  `<svg width="${LADO_INSIGNIA}" height="${LADO_INSIGNIA}" xmlns="http://www.w3.org/2000/svg">
     <rect x="0" y="0" width="${LADO_INSIGNIA}" height="${LADO_INSIGNIA}" rx="30" fill="#ffffff"/>
   </svg>`,
);

const logoReducido = await sharp(logo)
  .resize(LADO_LOGO, LADO_LOGO, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  })
  .png()
  .toBuffer();

const insignia = await sharp({
  create: {
    width: LADO_INSIGNIA,
    height: LADO_INSIGNIA,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    { input: marcoInsignia, top: 0, left: 0 },
    { input: logoReducido, top: RELLENO_INSIGNIA, left: RELLENO_INSIGNIA },
  ])
  .png()
  .toBuffer();

const info = await sharp(foto)
  .resize(ANCHO, ALTO, { fit: "cover", position: "centre" })
  .composite([
    { input: cortina, top: 0, left: 0 },
    { input: insignia, top: ALTO - LADO_INSIGNIA - MARGEN, left: MARGEN },
  ])
  .jpeg({ quality: 82, progressive: true })
  .toFile(destino);

const kb = (info.size / 1024).toFixed(0);
console.log(`Escrito ${path.relative(raiz, destino)} (${info.width}x${info.height}, ${kb} KB)`);

if (info.size > 300 * 1024) {
  console.warn("Aviso: la imagen supera 300 KB; WhatsApp podría no mostrar la miniatura.");
}
