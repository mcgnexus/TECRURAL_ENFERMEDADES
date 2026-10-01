import { describe, it, expect } from "vitest";
import { parsearClaveCuotaIp, enmascararIp } from "./accesos-ip";

/**
 * Las claves de IP de `cuotas` son la única fuente de IPs de la app, y su
 * formato lo fija `consumirUsoPorClave` en cuota.ts. Si ese formato cambia, el
 * panel de accesos dejaría de extraer nada y fallaría en silencio; por eso se
 * fija aquí.
 */

describe("parsearClaveCuotaIp", () => {
  it("extrae la IP de una clave de eventos", () => {
    expect(parsearClaveCuotaIp("lead:ip:eventos:79.113.5.30:20261001")).toEqual({
      ip: "79.113.5.30",
      dia: "20261001",
    });
  });

  it("extrae la IP de una clave de lead (sin el prefijo eventos)", () => {
    expect(parsearClaveCuotaIp("lead:ip:79.117.81.217:20260930")).toEqual({
      ip: "79.117.81.217",
      dia: "20260930",
    });
  });

  it("extrae IPv6 con compresión ::", () => {
    expect(parsearClaveCuotaIp("lead:ip:eventos:2001:db8::1:20261001")).toEqual({
      ip: "2001:db8::1",
      dia: "20261001",
    });
  });

  it("ignora claves de visitante y globales", () => {
    expect(parsearClaveCuotaIp("diag:635c9bd6-d558-4030-8070-fa8876bf0246:20260929")).toBeNull();
    expect(parsearClaveCuotaIp("diag:global:20260929")).toBeNull();
  });

  it("ignora la IP sentinela 'desconocida'", () => {
    expect(parsearClaveCuotaIp("lead:ip:eventos:desconocida:20261001")).toBeNull();
  });
});

describe("enmascararIp", () => {
  it("enmascara el último octeto de una IPv4", () => {
    expect(enmascararIp("79.113.5.30")).toBe("79.113.5.xxx");
  });

  it("enmascara el último hexteto de una IPv6", () => {
    expect(enmascararIp("2001:db8::1")).toBe("2001:db8::xxxx");
  });

  it("deja intacto lo que no es una IP", () => {
    expect(enmascararIp("desconocida")).toBe("desconocida");
  });
});
