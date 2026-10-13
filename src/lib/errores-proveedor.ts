export class ErrorProveedorIA extends Error {
  readonly proveedor: string;

  constructor(proveedor: string, cause: unknown) {
    const detalle = cause instanceof Error ? cause.message : String(cause);
    super(`Fallo del proveedor ${proveedor}: ${detalle}`, { cause });
    this.name = "ErrorProveedorIA";
    this.proveedor = proveedor;
  }
}

export class DeadlineDiagnosticoError extends Error {
  constructor() {
    super("Se agotó el tiempo disponible para el análisis");
    this.name = "DeadlineDiagnosticoError";
  }
}

export function esErrorProveedorIA(error: unknown): error is ErrorProveedorIA {
  return error instanceof ErrorProveedorIA;
}
