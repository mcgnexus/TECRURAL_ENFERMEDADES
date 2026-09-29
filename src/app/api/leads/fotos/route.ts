import { NextRequest, NextResponse } from "next/server";
import { initDatabase, obtenerFotoLead, contarFotosLead } from "@/lib/database";

/**
 * Devuelve UNA foto compartida en un lead, protegida por ADMIN_TOKEN.
 *
 * Por qué existe una ruta aparte en vez de traer las fotos en el listado de
 * /api/leads: con hasta tres fotos de WebP por lead, incluir el base64 en cada
 * respuesta del listado multiplicaría los megabytes, y con 100 leads serían
 * cientos de megas de fotos que el técnico no va a mirar. Aquí se piden bajo
 * demanda, una a una, y el `<img>` del panel apunta directamente a esta URL.
 *
 * Seguridad:
 * - Exige el mismo `x-admin-token` que el resto de la API de leads. Sin él,
 *   404, para no revelar ni siquiera que el endpoint existe.
 * - Las fotos son de la parcela del agricultor. Van en la cabecera
 *   `Cache-Control: no-store` para que no acaben en un disco ni en una CDN,
 *   y con `Content-Disposition: inline` para que se muestren en el visor en
 *   lugar de descargarse.
 * - El índice se valida contra el número real de fotos antes de tocar la base
 *   de datos.
 */

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const token = process.env.ADMIN_TOKEN;
  const recibido = request.headers.get("x-admin-token");

  if (!token || recibido !== token) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  const leadId = request.nextUrl.searchParams.get("lead") ?? "";
  const indiceRaw = Number(request.nextUrl.searchParams.get("indice") ?? "0");

  if (!UUID_RE.test(leadId) || !Number.isInteger(indiceRaw) || indiceRaw < 0) {
    return NextResponse.json({ error: "Parámetros no válidos" }, { status: 400 });
  }

  try {
    await initDatabase();

    // El número de fotos se consulta antes para no pasar un índice enorme a la
    // extracción de JSONB.
    const total = await contarFotosLead(leadId);
    if (total === 0) {
      return NextResponse.json({ error: "Ese lead no tiene fotos" }, { status: 404 });
    }
    if (indiceRaw >= total) {
      return NextResponse.json(
        { error: `Ese lead tiene ${total} foto${total > 1 ? "s" : ""}` },
        { status: 404 }
      );
    }

    const foto = await obtenerFotoLead(leadId, indiceRaw);
    if (!foto) {
      return NextResponse.json({ error: "Foto no disponible" }, { status: 404 });
    }

    const base64 = foto.dataUrl.slice(foto.dataUrl.indexOf(",") + 1);
    const buffer = Buffer.from(base64, "base64");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": foto.mimeType,
        "Content-Length": String(buffer.byteLength),
        // La foto es de la parcela del agricultor: ni caché ni CDN.
        "Cache-Control": "no-store, private",
        "Content-Disposition": `inline; filename="lead-${leadId.slice(0, 8)}-foto-${indiceRaw + 1}.${foto.mimeType.split("/")[1]}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error obteniendo foto de lead.");
    return NextResponse.json({ error: "No se pudo obtener la foto" }, { status: 500 });
  }
}
