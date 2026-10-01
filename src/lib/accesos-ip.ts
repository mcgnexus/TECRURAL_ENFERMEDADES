/**
 * Utilidades puras sobre las claves de IP de la tabla `cuotas`.
 *
 * Viven aparte de `database.ts` para poder probarlas sin arrastrar el cliente de
 * Neon ni los alias `@/` que el runner de pruebas no resuelve. `database.ts` las
 * importa y las usa en `obtenerAccesos`.
 */

const CLAVE_IP_RE = /^lead:ip:(?:eventos:)?([0-9a-fA-F.:]+):(\d{8})$/;

/**
 * Extrae la IP y el día de una clave de cuota de rate-limit.
 *
 * Los leads y los lotes de eventos se limitan por IP (`consumirUsoPorClave`) y
 * eso deja en `cuotas.clave` la IP en claro. Es la ÚNICA fuente de IPs de la
 * app: la tabla `eventos` no guarda ni IP ni user-agent a propósito. Devuelve
 * null para cualquier clave que no sea de IP (p. ej. las de visitante).
 */
export function parsearClaveCuotaIp(clave: string): { ip: string; dia: string } | null {
  const m = CLAVE_IP_RE.exec(clave);
  if (!m) return null;
  return { ip: m[1], dia: m[2] };
}

/**
 * Enmascara el último octeto (IPv4) o hexteto (IPv6) de una IP.
 *
 * El panel es interno, pero una IP completa es un dato identificativo: basta
 * con ver la red de origen para distinguir un agricultor de un crawler, así que
 * se reduce la exposición sin perder capacidad de diagnóstico.
 */
export function enmascararIp(ip: string): string {
  if (ip.includes(":")) {
    const partes = ip.split(":");
    if (partes.length < 2) return ip;
    partes[partes.length - 1] = "xxxx";
    return partes.join(":");
  }
  const partes = ip.split(".");
  if (partes.length !== 4) return ip;
  partes[3] = "xxx";
  return partes.join(".");
}
