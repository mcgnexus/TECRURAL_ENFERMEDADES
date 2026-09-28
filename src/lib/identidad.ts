import { cookies } from "next/headers";

/**
 * Lectura del identificador de visitante en el servidor.
 *
 * El identificador lo emite `src/proxy.ts` en la cookie httpOnly `tr_uid` a
 * partir de la primera petición. Aquí solo se lee: nunca se acepta uno
 * enviado por el cliente en el cuerpo de la petición, porque eso permitiría
 * atribuir diagnósticos o leads al visitante equivocado.
 *
 * Si la cookie no existe o no tiene forma de UUID se devuelve null. Cada
 * llamador decide qué hacer: el historial muestra estado vacío, y las rutas
 * que guardan datos rechazan la petición en vez de inventarse un usuario.
 */

const COOKIE = "tr_uid";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Para páginas de servidor, donde no se puede exigir nada más. */
export async function uidDeVisitante(): Promise<string | null> {
  try {
    const valor = (await cookies()).get(COOKIE)?.value;
    return valor && UUID_RE.test(valor) ? valor : null;
  } catch {
    return null;
  }
}

/** Para route handlers. Exige identificador: sin él no se guarda nada. */
export async function uidObligatorio(): Promise<string | null> {
  return uidDeVisitante();
}
