import { defineConfig } from "vitest/config";

/**
 * Configuración de las pruebas.
 *
 * Dos clases de prueba, y la diferencia importa:
 *
 * - Puras (error-analisis, textos-lead). No necesitan nada externo y siempre se
 *   ejecutan.
 * - Con base de datos (cuota). Tocan Postgres de verdad, porque lo que prueban
 *   es el comportamiento del SQL —atomicidad del contador, renovación de la
 *   ventana—, y eso no se puede simular con un doble sin dejar de probar lo que
 *   importa. Se SALTAN salvo que exista TEST_DATABASE_URL, y además se niegan a
 *   correr si coincide con DATABASE_URL. Nunca tocan producción.
 *
 * El guard de esquema se prueba lanzando el script como proceso: lo que hay que
 * verificar es su código de salida, no una función interna.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30_000,
  },
});
