import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uidDeVisitante } from "@/lib/identidad";
import { hashContactoCuota, vincularContactoCuota } from "@/lib/cuota";

export const runtime = "nodejs";

/**
 * Ampliación de la cuota semanal a cambio de un contacto: basta un correo (la
 * vía normal desde la pantalla de resultado) y se acepta también un teléfono
 * para quien no use correo. El contacto no se almacena en claro: solo su HMAC.
 */
const schema = z
  .object({
    email: z.string().trim().max(120).optional(),
    telefono: z.string().trim().max(24).optional(),
    aviso_uso_datos: z.literal(true),
  })
  .refine((d) => Boolean(d.email || d.telefono), {
    message: "Indica un correo o un teléfono para ampliar el límite.",
  });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizarTelefono(valor: string): string | null {
  const limpio = valor.replace(/[\s().-]/g, "");
  if (!/^\+?[\d]{9,15}$/.test(limpio)) return null;
  if (limpio.startsWith("+")) return limpio;
  // En este MVP los números locales de 9 cifras se interpretan como españoles.
  return limpio.length === 9 ? `+34${limpio}` : `+${limpio}`;
}

export async function POST(request: NextRequest) {
  try {
    const uid = await uidDeVisitante();
    if (!uid) return NextResponse.json({ error: "No se ha podido identificar este dispositivo." }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Indica un contacto válido y confirma el uso descrito." }, { status: 400 });
    }

    const contacto = parsed.data.email
      ? (() => {
          const correo = parsed.data.email!.toLowerCase();
          return EMAIL_REGEX.test(correo) ? `correo:${correo}` : null;
        })()
      : normalizarTelefono(parsed.data.telefono!);

    if (!contacto) {
      return NextResponse.json({ error: parsed.data.email ? "Introduce un correo válido." : "Introduce un teléfono válido." }, { status: 400 });
    }

    const contactoHash = hashContactoCuota(contacto);
    await vincularContactoCuota(uid, contactoHash);
    return NextResponse.json({ success: true, limite: 6, periodo: "7 días" });
  } catch (error) {
    console.error("No se pudo activar la cuota semanal por contacto.");
    const faltaClave = error instanceof Error && error.message.includes("CUOTA_TELEFONO_SECRET");
    return NextResponse.json(
      { error: faltaClave ? "La ampliación de cuota no está disponible ahora mismo." : "No se pudo activar el límite semanal. Inténtalo de nuevo." },
      { status: 503 },
    );
  }
}
