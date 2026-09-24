import { NextRequest, NextResponse } from "next/server";
import { analizarConReintento } from "@/lib/gemini";
import { analizarConReintentoDeepSeek } from "@/lib/deepseek";
import { initDatabase, guardarDiagnostico } from "@/lib/database";

export const runtime = "nodejs";
export const maxDuration = 120;

type Proveedor = "gemini" | "deepseek";

async function analizarConProveedor(
  base64: string,
  mimeType: string,
  proveedor: Proveedor
) {
  if (proveedor === "gemini") {
    return await analizarConReintento(base64, mimeType);
  }
  return await analizarConReintentoDeepSeek(base64, mimeType);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("imagen") as File | null;
    const usuarioId = formData.get("usuario_id") as string || "anonimo";
    const proveedor = (formData.get("proveedor") as Proveedor) || "gemini";

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

    let diagnostico;
    let proveedorUsado = proveedor;

    try {
      diagnostico = await analizarConProveedor(base64, file.type, proveedor);
    } catch (error) {
      console.warn(`Fallo ${proveedor}, intentando fallback...`, error);
      
      const fallback: Proveedor = proveedor === "gemini" ? "deepseek" : "gemini";
      
      try {
        diagnostico = await analizarConProveedor(base64, file.type, fallback);
        proveedorUsado = fallback;
      } catch (fallbackError) {
        console.error(`Fallo también ${fallback}:`, fallbackError);
        throw fallbackError;
      }
    }

    await initDatabase();

    const imagenUrl = `data:${file.type};base64,${base64}`;
    const saved = await guardarDiagnostico(usuarioId, imagenUrl, diagnostico);

    return NextResponse.json({
      ...diagnostico,
      id: saved.id,
      created_at: saved.created_at,
      proveedor_usado: proveedorUsado,
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