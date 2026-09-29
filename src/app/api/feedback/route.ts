import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initDatabase, actualizarFeedback } from "@/lib/database";
import { uidDeVisitante } from "@/lib/identidad";

/**
 * Valoración del agricultor sobre una orientación.
 *
 * Este endpoint se revisó porque permitía escrituras públicas sin validar nada:
 * actualizaba el diagnóstico solo por su identificador, así que cualquiera que
 * conociera un id podía sobrescribir la valoración de otra persona. Tampoco
 * había tope de longitud para el comentario.
 *
 * Ahora se comprueban las tres cosas que faltaban:
 *
 * 1. FORMATO: el id tiene que ser un UUID, no cualquier cadena.
 * 2. TAMAÑO: el comentario se acota a 1000 caracteres, como el resto de textos
 *    libres de la app. Sin tope, un comentario de megabytes engordaría la fila.
 * 3. PROPIEDAD: la actualización filtra por `usuario_id`, tomado de la cookie
 *    httpOnly que emite el proxy. Solo se puede valorar un diagnóstico propio.
 *
 * Un diagnóstico ajeno y un diagnóstico inexistente responden lo mismo (404).
 * Distinguirlos permitiría averiguar qué identificadores existen.
 */

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const feedbackSchema = z.object({
  id: z.string().regex(UUID_RE, "id no válido"),
  feedback: z
    .string()
    .trim()
    .min(1, "El comentario no puede estar vacío")
    .max(1000, "El comentario es demasiado largo"),
});

export async function PATCH(request: NextRequest) {
  try {
    // Sin cookie no hay a quién atribuir el diagnóstico, así que no se puede
    // comprobar la propiedad. Se rechaza en vez de actualizar a ciegas.
    const usuarioId = await uidDeVisitante();
    if (!usuarioId) {
      return NextResponse.json({ error: "No disponible" }, { status: 404 });
    }

    // El cuerpo se parsea con su propio try: un JSON malformado es un error
    // DEL CLIENTE (400), no del servidor. Sin esto, `request.json()` lanzaba un
    // SyntaxError que caía en el catch general y devolvía un 500, ensuciando el
    // registro con un fallo que no lo era.
    let cuerpo: unknown;
    try {
      cuerpo = await request.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo de la petición no válido" }, { status: 400 });
    }

    const parsed = feedbackSchema.safeParse(cuerpo);
    if (!parsed.success) {
      const primero = parsed.error.issues[0];
      return NextResponse.json(
        { error: primero?.message ?? "Datos no válidos" },
        { status: 400 }
      );
    }

    await initDatabase();
    const actualizado = await actualizarFeedback(
      parsed.data.id,
      parsed.data.feedback,
      usuarioId
    );

    if (!actualizado) {
      // No existe o es de otro visitante: mismo mensaje para no delatar cuál.
      return NextResponse.json({ error: "Diagnóstico no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error guardando feedback.");
    return NextResponse.json(
      { error: "Error guardando feedback" },
      { status: 500 }
    );
  }
}
