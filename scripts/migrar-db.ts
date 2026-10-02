import { initDatabase } from "../src/lib/database";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL. No se ha ejecutado ninguna migración.");
    process.exit(1);
  }

  try {
    await initDatabase();
    console.log("Esquema de TecRural actualizado correctamente.");
  } catch (error) {
    console.error("Falló la migración del esquema.");
    console.error(error instanceof Error ? error.message : "Error desconocido");
    process.exit(1);
  }
}

void main();
