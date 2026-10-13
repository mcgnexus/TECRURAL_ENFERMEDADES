export const PRESUPUESTO_LLAMADAS = 6;

export class Presupuesto {
  private usadas = 0;
  constructor(private readonly maximo = PRESUPUESTO_LLAMADAS) {}
  disponible(): boolean { return this.usadas < this.maximo; }
  restantes(): number { return Math.max(0, this.maximo - this.usadas); }
  consumir(): void { this.usadas++; }
}

export class PresupuestoAgotadoError extends Error {
  constructor() {
    super("Presupuesto de llamadas agotado");
    this.name = "PresupuestoAgotadoError";
  }
}
