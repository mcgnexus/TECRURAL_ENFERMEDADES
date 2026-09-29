import fs from "node:fs";
import path from "node:path";

/**
 * Carga de .env.local para las pruebas.
 *
 * El proyecto no usa dotenv: en Next las variables las inyecta el propio
 * framework. Fuera de Next, y las pruebas corren fuera, hay que leerlas a mano.
 *
 * Solo se rellenan las que falten, para no pisar lo que venga del entorno: en
 * un despliegue o en CI las variables ya están puestas y el fichero no existe.
 */
const ruta = path.resolve(process.cwd(), ".env.local");

if (fs.existsSync(ruta)) {
  for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim();
    }
  }
}
