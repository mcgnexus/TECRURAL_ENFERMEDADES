import { isIP } from "node:net";
import type { NextRequest } from "next/server";

/**
 * Vercel sobrescribe x-forwarded-for con la IP pública del cliente para evitar
 * spoofing. Se prefiere su alias de plataforma cuando está presente. Solo se
 * usa la primera IP de la lista y se valida antes de emplearla en cuotas.
 */
export function ipCliente(request: NextRequest): string {
  const encabezado =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "";
  const candidata = encabezado.split(",")[0]?.trim() ?? "";
  return isIP(candidata) ? candidata : "desconocida";
}
