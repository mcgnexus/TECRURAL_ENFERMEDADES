import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bajaComercial, bajaComercialEmail } from "@/lib/database";

export const runtime = "nodejs";

const TELEFONO_REGEX = /^[+]?[\d\s().-]{9,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// La baja acepta teléfono o correo: el consentimiento comercial puede haberse
// dado por WhatsApp (con teléfono) o por correo (formulario del informe).
const bajaSchema = z
  .object({
    telefono: z
      .string()
      .trim()
      .optional()
      .transform((t) => (t ? t.replace(/[\s().-]/g, "") : undefined))
      .refine((t) => t === undefined || TELEFONO_REGEX.test(t), {
        message: "Teléfono no válido",
      }),
    email: z
      .string()
      .trim()
      .optional()
      .transform((e) => (e && e !== "" ? e.toLowerCase() : undefined))
      .refine((e) => e === undefined || EMAIL_REGEX.test(e), {
        message: "Correo no válido",
      }),
  })
  .refine((d) => Boolean(d.telefono || d.email), {
    message: "Indica el teléfono o el correo donde recibías las comunicaciones",
  });

export async function POST(request: NextRequest) {
  try {
    const parsed = bajaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
    }

    let dadosDeBaja = 0;
    if (parsed.data.telefono) dadosDeBaja += await bajaComercial(parsed.data.telefono);
    if (parsed.data.email) dadosDeBaja += await bajaComercialEmail(parsed.data.email);

    // Respuesta genérica: no revelamos si el contacto estaba registrado
    return NextResponse.json({ success: true, bajas: dadosDeBaja });
  } catch (error) {
    console.error("Error en baja comercial.");
    return NextResponse.json(
      { error: "No se pudo procesar la baja. Inténtalo de nuevo más tarde." },
      { status: 500 }
    );
  }
}
