import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Identificador de visitante.
 *
 * Antes toda la app usaba el literal "usuario_demo", así que todos los
 * diagnósticos y todos los historiales vivían en el mismo cubo: las métricas
 * de captación no se podían atribuir a nadie y un solo usuario que repetía
 * análisis machacaba la tasa de conversión.
 *
 * Aquí se garantiza que cada visitante tenga un identificador propio desde la
 * primera petición. Se hace en el proxy (antes de renderizar) porque así el
 * identificador ya está disponible tanto en las páginas de servidor como en
 * los route handlers, sin esperar a que JavaScript se ejecute.
 *
 * Es httpOnly a propósito: el cliente no lo necesita, solo el servidor. Los
 * route handlers lo leen de la cookie, de modo que un usuario no puede
 * suplantar el identificador de otro enviando otro en el formulario.
 */

const COOKIE = "tr_uid";
const DIAS = 180;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUidValido(valor: string | undefined | null): boolean {
  return Boolean(valor) && UUID_RE.test(valor as string);
}

export function proxy(request: NextRequest) {
  const existente = request.cookies.get(COOKIE)?.value;

  if (esUidValido(existente)) {
    return NextResponse.next();
  }

  const uid = crypto.randomUUID();
  const respuesta = NextResponse.next();

  respuesta.cookies.set(COOKIE, uid, {
    maxAge: DIAS * 24 * 60 * 60,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return respuesta;
}

export const config = {
  // Solo las rutas que renderizan o reciben datos. Excluir estáticos, assets y
  // el service worker del PWA: se piden mucho y no necesitan la cookie.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|robots\\.txt|sitemap\\.xml|sw.js|.*\\.svg$|.*\\.png$|.*\\.ico$).*)",
  ],
};
