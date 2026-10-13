import { describe, expect, it } from "vitest";
import { evaluarCalidadFoto } from "./calidad-foto";

describe("evaluarCalidadFoto", () => {
  it("no bloquea ni marca mala calidad cuando createImageBitmap no está disponible", async () => {
    expect(await evaluarCalidadFoto(new Blob(["foto"]))).toEqual({
      nitidezBaja: false,
      exposicionDeficiente: false,
    });
  });
});
