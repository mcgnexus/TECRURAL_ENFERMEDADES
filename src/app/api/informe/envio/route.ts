import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uidDeVisitante } from "@/lib/identidad";
import {
  crearEnlaceInforme,
  datosEnvioInforme,
  revocarEnlace,
  revocarEnlacesAnteriores,
} from "@/lib/database";
import {
  contactoCuota,
  consumirUsoPorClave,
  hashContactoCuota,
} from "@/lib/cuota";
import { ipCliente } from "@/lib/ip-request";
import { enviarEnlaceInforme, envioInformeHabilitado } from "@/lib/email-envio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Envío y reenvío del enlace de recuperación del informe.
 *
 * El cuerpo solo lleva `diagnosticoId`: el destinatario NO lo elige el cliente.
 * Se lee del último lead con correo de ese diagnóstico y solo si la cookie de
 * visitante es la dueña del diagnóstico. Así este endpoint no puede usarse como
 * rebotador de correo arbitrario.
 *
 * Respuestas:
 * - `{ estado: "aceptado" }` solo con 2xx e id de Resend.
 * - `{ estado: "fallido", motivo }` si Resend no acepta, la cuota está topada
 *   o la base de datos no responde (503).
 * - `{ estado: "no_disponible" }` sin cookie, sin id, sin lead con correo, sin
 *   RESEND_API_KEY o si el diagnóstico no pertenece al visitante.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const envioSchema = z.object({
  diagnosticoId: z.string().regex(UUID_RE, "diagnosticoId no válido"),
}).strip();

const DIA_MS = 24 * 60 * 60 * 1000;
const SEMANA_MS = 7 * DIA_MS;

export async function GET() {
  return NextResponse.json(
    { disponible: envioInformeHabilitado() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!envioInformeHabilitado()) {
      return NextResponse.json({ estado: "no_disponible" });
    }

    const usuarioId = await uidDeVisitante();
    if (!usuarioId) {
      return NextResponse.json({ estado: "no_disponible" });
    }

    let cuerpo: unknown;
    try {
      cuerpo = await request.json();
    } catch {
      return NextResponse.json(
        { estado: "fallido", motivo: "Petición no válida." },
        { status: 400 }
      );
    }

    const parsed = envioSchema.safeParse(cuerpo);
    if (!parsed.success) {
      return NextResponse.json({ estado: "no_disponible" });
    }

    const datos = await datosEnvioInforme(parsed.data.diagnosticoId, usuarioId);
    if (!datos) {
      return NextResponse.json({ estado: "no_disponible" });
    }

    const ip = ipCliente(request);
    const contacto = contactoCuota(datos.email);
    if (!contacto) {
      return NextResponse.json({ estado: "no_disponible" });
    }

    let hashEmail: string;
    try {
      hashEmail = hashContactoCuota(contacto);
    } catch {
      return NextResponse.json(
        {
          estado: "fallido",
          motivo: "El envío por correo no está disponible ahora mismo.",
        },
        { status: 503 }
      );
    }

    const limiteDiag = await consumirUsoPorClave(
      "lead",
      `envio_diag:${datos.diagnosticoId}`,
      3,
      DIA_MS,
      ip
    );
    if (!limiteDiag.permitido) {
      return limiteDiag.motivo === "database"
        ? NextResponse.json(
            {
              estado: "fallido",
              motivo: "No podemos comprobar el límite de envíos ahora mismo.",
            },
            { status: 503 }
          )
        : NextResponse.json(
            {
              estado: "fallido",
              motivo: "Has pedido el enlace varias veces en poco tiempo. Inténtalo más tarde.",
            },
            { status: 429 }
          );
    }

    const limiteEmail = await consumirUsoPorClave(
      "lead",
      `envio_email:${hashEmail}`,
      10,
      SEMANA_MS,
      ip
    );
    if (!limiteEmail.permitido) {
      return limiteEmail.motivo === "database"
        ? NextResponse.json(
            {
              estado: "fallido",
              motivo: "No podemos comprobar el límite de envíos ahora mismo.",
            },
            { status: 503 }
          )
        : NextResponse.json(
            {
              estado: "fallido",
              motivo: "Se han pedido demasiados enlaces para este correo. Inténtalo más tarde.",
            },
            { status: 429 }
          );
    }

    const limiteIp = await consumirUsoPorClave("lead", `envio_ip:${ip}`, 30, DIA_MS, ip);
    if (!limiteIp.permitido) {
      return limiteIp.motivo === "database"
        ? NextResponse.json(
            {
              estado: "fallido",
              motivo: "No podemos comprobar el límite de envíos ahora mismo.",
            },
            { status: 503 }
          )
        : NextResponse.json(
            {
              estado: "fallido",
              motivo: "Se han pedido demasiados enlaces desde esta conexión. Inténtalo más tarde.",
            },
            { status: 429 }
          );
    }

    const { token, intento, enlaceId } = await crearEnlaceInforme(
      datos.diagnosticoId
    );
    const envio = await enviarEnlaceInforme({
      to: datos.email,
      token,
      diagnosticoId: datos.diagnosticoId,
      intento,
    });

    if (!envio.aceptado) {
      // El token no se entregó: se revoca para no dejar dos credenciales
      // válidas, pero el enlace anterior sigue intacto.
      try {
        await revocarEnlace(enlaceId);
      } catch {
        console.warn("No se pudo revocar el enlace no entregado.");
      }
      return NextResponse.json(
        {
          estado: "fallido",
          motivo: "No hemos podido enviar el correo. El informe sigue disponible en pantalla.",
        },
        { status: 502 }
      );
    }

    // Solo ahora se invalida el token anterior. Si esta limpieza falla, el
    // correo ya está aceptado y no se puede deshacer: se registra sin fallar.
    try {
      await revocarEnlacesAnteriores(datos.diagnosticoId, enlaceId);
    } catch {
      console.warn("No se pudieron revocar los enlaces anteriores del informe.");
    }

    return NextResponse.json({ estado: "aceptado" });
  } catch {
    console.warn("No se pudo procesar el envío del informe.");
    return NextResponse.json(
      {
        estado: "fallido",
        motivo: "No hemos podido enviar el correo. El informe sigue disponible en pantalla.",
      },
      { status: 503 }
    );
  }
}
