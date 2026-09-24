import { NextRequest, NextResponse } from "next/server";
import { analizarConReintento } from "@/lib/gemini";
import { initDatabase, guardarDiagnostico } from "@/lib/database";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("imagen") as File | null;
    const usuarioId = formData.get("usuario_id") as string || "anonimo";

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió ninguna imagen" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "El archivo debe ser una imagen" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const diagnostico = await analizarConReintento(base64, file.type);

    await initDatabase();

    const imagenUrl = `data:${file.type};base64,${base64}`;
    const saved = await guardarDiagnostico(usuarioId, imagenUrl, diagnostico);

    return NextResponse.json({
      ...diagnostico,
      id: saved.id,
      created_at: saved.created_at,
    });
  } catch (error) {
    console.error("Error en diagnóstico:", error);
    
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    
    if (message.includes("JSON inválido") || message.includes("Respuesta vacía")) {
      return NextResponse.json(
        { error: "Error procesando la respuesta de IA, intente de nuevo", retry: true },
        { status: 502 }
      );
    }
    
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}