import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bajaComercial } from "@/lib/database";

export const runtime = "nodejs";

const TELEFONO_REGEX = /^[+]?[\d\s().-]{9,20}$/;

const bajaSchema = z.object({
  telefono: z
    .string()
    .trim()
    .regex(TELEFONO_REGEX, "Teléfono no válido")
    .transform((t) => t.replace(/[\s().-]/g, "")),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bajaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Introduce un teléfono válido" }, { status: 400 });
    }

    await bajaComercial(parsed.data.telefono);

    // Respuesta genérica: no revelamos si el teléfono estaba registrado
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en baja comercial.");
    return NextResponse.json(
      { error: "No se pudo procesar la baja. Inténtalo de nuevo más tarde." },
      { status: 500 }
    );
  }
}
