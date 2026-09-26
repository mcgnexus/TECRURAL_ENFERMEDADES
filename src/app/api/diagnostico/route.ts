import { NextRequest, NextResponse } from "next/server";
import { analizarConReintento } from "@/lib/gemini";
import { analizarConReintentoDeepSeek } from "@/lib/deepseek";
import { initDatabase, guardarDiagnostico } from "@/lib/database";
import type { DiagnosticoResponse } from "@/types/diagnostico";

export const runtime = "nodejs";
export const maxDuration = 120;

type Proveedor = "gemini" | "deepseek";
type Angulo = "haz" | "enves" | "planta_completa";

async function analizarConProveedor(
  base64: string,
  mimeType: string,
  proveedor: Proveedor,
  nombrePlanta?: string
) {
  if (proveedor === "gemini") {
    return await analizarConReintento(base64, mimeType, nombrePlanta);
  }
  return await analizarConReintentoDeepSeek(base64, mimeType, nombrePlanta);
}

function isMissingApiKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("DEEPSEEK_API_KEY no configurada") || 
         message.includes("GEMINI_API_KEY") ||
         message.includes("apiKey") ||
         message.includes("Missing credentials");
}

function sanitizarSintomas(sintomas: string[]): string[] {
  const genericos = new Set([
    "manchas", "color raro", "extraño", "raro", "malo", "enfermo",
    "amarillo", "marron", "negro", "blanco", "verde", "seco", "marchito",
    "mancha", "punto", "rayas", "lineas", "zonas", "areas",
  ]);
  
  return sintomas
    .map((s) => s.trim())
    .filter((s) => s.length > 5)
    .filter((s) => !genericos.has(s.toLowerCase()))
    .filter((s, i, arr) => arr.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i)
    .slice(0, 8);
}

function validarCoherencia(diagnostico: DiagnosticoResponse): { valido: boolean; errores: string[] } {
  const errores: string[] = [];
  
  if (diagnostico.diagnostico.tipo === "sano" && diagnostico.diagnostico.confianza > 0.8) {
    errores.push("Diagnóstico 'sano' con confianza muy alta (>0.8) sin síntomas observados");
  }
  
  if (diagnostico.diagnostico.tipo !== "sano" && diagnostico.diagnostico.sintomas_observados.length === 0) {
    errores.push("Diagnóstico de problema sin síntomas observados");
  }
  
  if (["fruto", "flor"].includes(diagnostico.organo_detectado) && !diagnostico.estado_madurez.aplica) {
    errores.push(`Órgano ${diagnostico.organo_detectado} pero estado_madurez.aplica = false`);
  }
  
  if (!["fruto", "flor"].includes(diagnostico.organo_detectado) && diagnostico.estado_madurez.aplica) {
    errores.push(`Órgano ${diagnostico.organo_detectado} no es fruto/flor pero estado_madurez.aplica = true`);
  }
  
  if (diagnostico.diagnostico.confianza < 0.3 && diagnostico.confianza_identificacion < 0.3) {
    errores.push("Confianza muy baja en ambas identificaciones");
  }
  
  if (diagnostico.diagnostico.gravedad === "severa" && diagnostico.diagnostico.confianza < 0.6) {
    errores.push("Gravedad 'severa' con confianza baja (<0.6)");
  }
  
  return { valido: errores.length === 0, errores };
}

function requiereExpertoPorValidacion(diagnostico: DiagnosticoResponse): boolean {
  const { errores } = validarCoherencia(diagnostico);
  if (errores.length > 0) return true;
  
  if (diagnostico.confianza_identificacion < 0.4) return true;
  if (diagnostico.diagnostico.confianza < 0.4) return true;
  if (diagnostico.diagnostico.tipo !== "sano" && diagnostico.diagnostico.sintomas_observados.length < 2) return true;
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("imagen") as File | null;
    const usuarioId = formData.get("usuario_id") as string || "anonimo";
    const proveedor = (formData.get("proveedor") as Proveedor) || "gemini";
    const nombrePlanta = ((formData.get("nombre_planta") as string) || "").trim() || undefined;
    const angulo = (formData.get("angulo") as Angulo) || undefined;

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

    let diagnostico: DiagnosticoResponse;
    let proveedorUsado = proveedor;

    try {
      diagnostico = await analizarConProveedor(base64, file.type, proveedor, nombrePlanta);
    } catch (error) {
      console.warn(`Fallo ${proveedor}, intentando fallback...`, error);
      
      const fallback: Proveedor = proveedor === "gemini" ? "deepseek" : "gemini";
      
      if (isMissingApiKeyError(error)) {
        console.warn(`Error de API key en ${proveedor}, fallback no disponible`);
        throw error;
      }
      
      try {
        diagnostico = await analizarConProveedor(base64, file.type, fallback, nombrePlanta);
        proveedorUsado = fallback;
      } catch (fallbackError) {
        console.error(`Fallo también ${fallback}:`, fallbackError);
        throw fallbackError;
      }
    }

    diagnostico.diagnostico.sintomas_observados = sanitizarSintomas(diagnostico.diagnostico.sintomas_observados);

    const validacion = validarCoherencia(diagnostico);
    if (!validacion.valido) {
      console.warn("Validación de coherencia fallida:", validacion.errores);
      diagnostico.requiere_experto = true;
      diagnostico.recomendacion = `${diagnostico.recomendacion} ⚠ Validación automática detectó inconsistencias: ${validacion.errores.join("; ")}. Consulte a técnico para confirmar.`;
    }

    if (requiereExpertoPorValidacion(diagnostico)) {
      diagnostico.requiere_experto = true;
    }

    await initDatabase();

    const imagenUrl = `data:${file.type};base64,${base64}`;
    const saved = await guardarDiagnostico(usuarioId, imagenUrl, diagnostico, nombrePlanta);

    return NextResponse.json({
      ...diagnostico,
      id: saved.id,
      nombre_planta: saved.nombre_planta,
      created_at: saved.created_at,
      proveedor_usado: proveedorUsado,
      angulo_usado: angulo,
      validacion: {
        coherente: validacion.valido,
        errores: validacion.errores,
      },
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
    
    if (message.includes("API_KEY no configurada") || message.includes("Missing credentials")) {
      return NextResponse.json(
        { error: "Proveedor de IA no configurado. Contacte al administrador." },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
