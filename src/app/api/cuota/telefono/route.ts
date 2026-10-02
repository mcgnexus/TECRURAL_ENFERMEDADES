import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uidDeVisitante } from "@/lib/identidad";
import { hashTelefonoCuota, vincularTelefonoCuota } from "@/lib/cuota";

export const runtime = "nodejs";

const schema = z.object({
  telefono: z.string().trim().min(9).max(24),
  aviso_uso_datos: z.literal(true),
});

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
      return NextResponse.json({ error: "Introduce un teléfono válido y confirma el uso descrito." }, { status: 400 });
    }

    const telefono = normalizarTelefono(parsed.data.telefono);
    if (!telefono) return NextResponse.json({ error: "Introduce un teléfono válido." }, { status: 400 });

    const telefonoHash = hashTelefonoCuota(telefono);
    await vincularTelefonoCuota(uid, telefonoHash);
    return NextResponse.json({ success: true, limite: 6, periodo: "7 días" });
  } catch (error) {
    console.error("No se pudo activar la cuota semanal por teléfono.");
    const faltaClave = error instanceof Error && error.message.includes("CUOTA_TELEFONO_SECRET");
    return NextResponse.json(
      { error: faltaClave ? "La ampliación de cuota no está disponible ahora mismo." : "No se pudo activar el límite semanal. Inténtalo de nuevo." },
      { status: 503 },
    );
  }
}
