import OpenAI from "openai";
import { writeFile } from "node:fs/promises";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

const openai = new OpenAI({ apiKey });
const response = await openai.images.generate({
  model: "gpt-image-1",
  prompt: `Fotografía agrícola fotorrealista, documental y de alta calidad para la portada de un servicio de orientación de cultivos de Granada, España. Primer plano de una rama auténtica de olivo con hojas verdes naturales; una hoja muestra unas pocas manchas pequeñas marrón grisáceas, sutiles y realistas, sin aspecto dramático. Al fondo, desenfocado, se percibe un olivar mediterráneo bajo luz natural suave de mañana. Texturas botánicas precisas, profundidad de campo óptica, colores sobrios y fieles, encuadre horizontal 4:3. Debe parecer una fotografía tomada por un fotógrafo de campo, no una ilustración ni un render. Sin personas, herramientas, texto, letras, logotipos, marcas de agua ni bordes.`,
  size: "1536x1024",
  quality: "high",
});

const imagen = response.data?.[0]?.b64_json;
if (!imagen) throw new Error("GPT no devolvió una imagen válida");

const destino = new URL("../public/foto-cultivo-granada.png", import.meta.url);
await writeFile(destino, Buffer.from(imagen, "base64"));
console.log(`Imagen creada: ${destino.pathname}`);
