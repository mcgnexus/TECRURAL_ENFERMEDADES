import { NextRequest, NextResponse } from "next/server";
import { analizarConReintento, type ImagenAnalisis } from "@/lib/gemini";
import { analizarConReintentoDeepSeek } from "@/lib/deepseek";
import { initDatabase, guardarDiagnostico } from "@/lib/database";
import { validarImagenServidor } from "@/lib/imagen";
import { uidObligatorio } from "@/lib/identidad";
import { consumirUso } from "@/lib/cuota";
import type { ContextoUsuario, DiagnosticoResponse } from "@/types/diagnostico";

export const runtime = "nodejs";
export const maxDuration = 120;

type Proveedor = "gemini" | "deepseek";

/** Por qué se corta el fallback. Para no caer al segundo proveedor cuando el
 * primer fallo no es del proveedor, sino que se acabaron las llamadas. */
function esFalloDeProveedor(error: unknown): boolean {
  const nombre = (error as { name?: string })?.name;
  return nombre !== "PresupuestoAgotadoError";
}

async function analizarConProveedor(
  imagenes: ImagenAnalisis[],
  proveedor: Proveedor,
  contexto?: ContextoUsuario
) {
  if (proveedor === "gemini") {
    return await analizarConReintento(imagenes, contexto);
  }
  return await analizarConReintentoDeepSeek(imagenes, contexto);
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

/** Normaliza el nombre del diagnóstico al formato "Compatible con X" para que la
 * vista pueda mostrarlo de un vistazo, con o sin el prefijo que devuelve el modelo. */
function normalizarNombreDiagnostico(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
  if (!limpio) return "Compatible con un problema no identificado.";
  if (/^compatible con\b/i.test(limpio)) {
    return `Compatible con ${limpio.replace(/^compatible con\s*/i, "")}.`;
  }
  return `Compatible con ${limpio}.`;
}

/** Normaliza cada texto visible: espacio simple, mayúscula inicial y punto final. */
function normalizarTextoVisible(texto: string): string {
  const limpio = texto.trim().replace(/\s+/g, " ");
  if (!limpio) return limpio;
  const conPunto = /[.!?…]$/.test(limpio) ? limpio : `${limpio}.`;
  return conPunto.charAt(0).toUpperCase() + conPunto.slice(1);
}

function normalizarTextoPaciente(diagnostico: DiagnosticoResponse): void {
  const d = diagnostico.diagnostico;
  d.nombre = normalizarNombreDiagnostico(d.nombre);
  d.sintomas_observados = d.sintomas_observados.map(normalizarTextoVisible);
  if (diagnostico.diagnosticos_diferenciales) {
    for (const dif of diagnostico.diagnosticos_diferenciales) {
      dif.nombre = normalizarNombreDiagnostico(dif.nombre);
      if (dif.por_que_descartado) dif.por_que_descartado = normalizarTextoVisible(dif.por_que_descartado);
    }
  }
  if (diagnostico.datos_faltantes) {
    diagnostico.datos_faltantes = diagnostico.datos_faltantes.map(normalizarTextoVisible);
  }
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

  const calidad = diagnostico.calidad_imagen;
  if (calidad) {
    if (calidad.nitidez === "baja" || calidad.encuadre === "insuficiente") return true;
  }

  if (!diagnostico.diagnosticos_diferenciales || diagnostico.diagnosticos_diferenciales.length === 0) return true;

  return false;
}

function notaCalidadImagen(diagnostico: DiagnosticoResponse): string {
  const calidad = diagnostico.calidad_imagen;
  if (!calidad) return "";

  const problemas: string[] = [];
  if (calidad.nitidez === "baja") problemas.push("imagen poco nítida");
  if (calidad.iluminacion === "deficiente") problemas.push("iluminación deficiente");
  if (calidad.iluminacion === "excesiva") problemas.push("sobreexposición");
  if (calidad.encuadre === "parcial") problemas.push("encuadre parcial");
  if (calidad.encuadre === "insuficiente") problemas.push("encuadre insuficiente");

  if (problemas.length === 0) return "";
  return ` Calidad de la foto: ${problemas.join(", ")}. Una foto más clara permitiría afinar mejor la orientación.`;
}

interface ImagenValidada extends ImagenAnalisis {
  tipoReal: string;
}

async function leerImagenValidada(
  file: File | null,
  etiqueta: string,
  obligatoria: boolean
): Promise<ImagenValidada | null> {
  if (!file || file.size === 0) {
    if (obligatoria) throw new Error("Falta la foto principal. Sube una foto del síntoma para continuar.");
    return null;
  }

  const buffer = await file.arrayBuffer();
  const validacion = validarImagenServidor(buffer, file.type || "");
  if (!validacion.ok) {
    throw new Error(`${etiqueta}: ${validacion.error}`);
  }

  return {
    base64: Buffer.from(buffer).toString("base64"),
    mimeType: validacion.tipo === "png" ? "image/png" : validacion.tipo === "webp" ? "image/webp" : "image/jpeg",
    tipoReal: validacion.tipo!,
  };
}

export async function POST(request: NextRequest) {
  try {
    // El identificador de visitante viene de la cookie httpOnly que emite el
    // proxy, no del cuerpo de la petición: así no se puede atribuir el
    // diagnóstico a otro visitante.
    const usuarioId = await uidObligatorio();

    const formData = await request.formData();
    const nombrePlanta = ((formData.get("nombre_planta") as string) || "").trim() || undefined;

    // Contexto declarado por el agricultor (mejora la orientación, opcional)
    const contexto: ContextoUsuario = {
      cultivo: ((formData.get("cultivo") as string) || "").trim() || undefined,
      municipio: ((formData.get("municipio") as string) || "").trim() || undefined,
      sintoma: ((formData.get("sintoma") as string) || "").trim() || undefined,
      duracion: ((formData.get("duracion") as string) || "").trim() || undefined,
      variedad: nombrePlanta,
    };

    // Foto principal obligatoria + opcionales (envés, planta completa)
    const principal = await leerImagenValidada(formData.get("imagen") as File | null, "La foto principal", true);
    const enves = await leerImagenValidada(formData.get("imagen_enves") as File | null, "La foto del envés", false);
    const planta = await leerImagenValidada(formData.get("imagen_planta") as File | null, "La foto de la planta completa", false);

    const imagenes: ImagenAnalisis[] = [principal!];
    if (enves) imagenes.push(enves);
    if (planta) imagenes.push(planta);

    // Cuota DESPUÉS de validar las fotos y ANTES de llamar al proveedor. Si se
    // hiciera antes, un cuerpo de 4 MB sin imagen válida consumiría cuota sin
    // coste detrás, y un agricultor con la foto mal hecha pagaría un uso que no
    // le hemos analizado.
    try {
      await initDatabase();
    } catch (error) {
      console.warn("initDatabase falló; se continúa sin cuota:", error);
    }
    const cuota = await consumirUso("diag", usuarioId);
    if (!cuota.permitido) {
      console.warn(`Diagnóstico bloqueado por cuota: ${cuota.detalle}`);
      return NextResponse.json(
        { error: cuota.mensaje, cuota: { motivo: cuota.motivo } },
        { status: cuota.motivo === "global" ? 503 : 429 }
      );
    }
    const headers: Record<string, string> = { "X-Cuota-Restante": String(cuota.restantes) };

    let diagnostico: DiagnosticoResponse;
    let proveedorUsado: Proveedor = "gemini";

    try {
      diagnostico = await analizarConProveedor(imagenes, "gemini", contexto);
    } catch (error) {
      // El fallback solo tiene sentido si el primer proveedor falló. Si el
      // fallo es que se agotó el presupuesto de llamadas, arrancar la misma
      // estructura completa en DeepSeek lo multiplicaría por dos.
      if (!esFalloDeProveedor(error)) throw error;
      console.warn("Fallo gemini, intentando fallback a deepseek...", error);
      try {
        diagnostico = await analizarConProveedor(imagenes, "deepseek", contexto);
        proveedorUsado = "deepseek";
      } catch (fallbackError) {
        console.error("Fallo también deepseek:", fallbackError);
        throw fallbackError;
      }
    }

    diagnostico.diagnostico.sintomas_observados = sanitizarSintomas(diagnostico.diagnostico.sintomas_observados);
    normalizarTextoPaciente(diagnostico);

    const notaCalidad = notaCalidadImagen(diagnostico);
    if (notaCalidad) {
      diagnostico.recomendacion = `${diagnostico.recomendacion.trim()} ${notaCalidad}`;
    }

    const validacion = validarCoherencia(diagnostico);
    if (!validacion.valido) {
      // El detalle técnico se queda en el log: al agricultor solo se le da
      // un aviso comprensible, sin jerga interna ni nombres de campos.
      console.warn("Validación de coherencia fallida:", validacion.errores);
      diagnostico.requiere_experto = true;
      diagnostico.recomendacion = `${diagnostico.recomendacion.trim()} La revisión automática detectó datos que no encajan del todo, por lo que conviene que un técnico confirme esta orientación.`;
    }

    if (requiereExpertoPorValidacion(diagnostico)) {
      diagnostico.requiere_experto = true;
    }

    // Guardado best-effort SIN la foto: la imagen no se almacena de forma
    // permanente. Solo se guardarán las fotos si el usuario solicita una
    // revisión (se adjuntan al lead, informándole antes de enviar).
    // Sin cookie de visitante el análisis se entrega igual, pero no se
    // atribuye a nadie: es preferible perder una métrica que inventar un
    // usuario compartido que falsee el embudo.
    let id: string | undefined;
    if (!usuarioId) {
      console.warn("Petición sin identificador de visitante; análisis no persistido");
    } else {
      try {
        await initDatabase();
        const saved = await guardarDiagnostico(
          usuarioId,
          "", // imagen no almacenada permanentemente
          diagnostico,
          nombrePlanta,
          undefined,
          contexto,
          proveedorUsado
        );
        id = saved.id;
      } catch (dbError) {
        console.warn("BD no disponible; se devuelve el análisis sin persistir:", dbError);
      }
    }

    return NextResponse.json({
      ...diagnostico,
      id,
      nombre_planta: nombrePlanta ?? null,
      contexto_usuario: contexto,
      created_at: new Date().toISOString(),
      proveedor_usado: proveedorUsado,
      validacion: {
        coherente: validacion.valido,
        errores: validacion.errores,
      },
      cuota: { restantes: cuota.restantes },
    }, { headers });
  } catch (error) {
    console.error("Error en diagnóstico:", error);

    const message = error instanceof Error ? error.message : "Error interno del servidor";

    if ((error as { name?: string })?.name === "PresupuestoAgotadoError") {
      return NextResponse.json(
        { error: "El análisis ha fallado varias veces seguidas. Inténtalo de nuevo en unos minutos." },
        { status: 503 }
      );
    }

    if (message.includes("Falta la foto principal") || message.startsWith("La foto")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes("JSON inválido") || message.includes("Respuesta vacía")) {
      return NextResponse.json(
        { error: "No hemos podido interpretar bien esta foto. Prueba a repetirla con más luz y el síntoma bien enfocado.", retry: true },
        { status: 502 }
      );
    }

    if (message.includes("API_KEY no configurada") || message.includes("Missing credentials")) {
      return NextResponse.json(
        { error: "El servicio de análisis no está disponible ahora mismo. Inténtalo de nuevo en unos minutos." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "No hemos podido completar el análisis. Comprueba tu conexión e inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
