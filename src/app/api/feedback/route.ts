import { NextRequest, NextResponse } from "next/server";
import { actualizarFeedback } from "@/lib/database";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, feedback } = body;

    if (!id || !feedback) {
      return NextResponse.json(
        { error: "Faltan parámetros: id y feedback son requeridos" },
        { status: 400 }
      );
    }

    await actualizarFeedback(id, feedback);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error guardando feedback:", error);
    return NextResponse.json(
      { error: "Error guardando feedback" },
      { status: 500 }
    );
  }
}