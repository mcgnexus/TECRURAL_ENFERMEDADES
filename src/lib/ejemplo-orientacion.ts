/**
 * Contenido del ejemplo de orientación que se muestra en la portada.
 *
 * POR QUÉ ESTÁ AQUÍ
 *
 * Un visitante debe entender qué recibe antes de hacer una foto. El ejemplo no
 * llama a la API ni crea diagnósticos: es contenido estático, revisable y
 * probado. Al vivir fuera del componente se puede comprobar que están las cinco
 * partes exigidas y que no se cuelan credenciales que no podamos demostrar.
 *
 * VALIDACIÓN PENDIENTE (requisito «contenido revisado»)
 *
 * Este texto es una propuesta. No debe desplegarse sin el visto bueno del
 * responsable de las revisiones. Al aprobarse, sustituir la línea siguiente:
 *   Validado por: —   Fecha: —
 *
 * La foto es `/aguacate.jpg`, propia y ya publicada en la portada. El texto
 * describe una orientación orientativa, NO una salida literal de la IA: por eso
 * se etiqueta como ejemplo y se dice expresamente que no es un caso de cliente.
 */

export interface CausaEjemplo {
  nombre: string;
  indicio: string;
  certeza: string;
}

export interface EjemploOrientacion {
  etiqueta: string;
  avisoNoCliente: string;
  foto: { src: string; alt: string };
  cultivo: string;
  posiblesCausas: CausaEjemplo[];
  queComprobar: string[];
  limitaciones: string[];
  cuandoPedirAyuda: string;
}

export const EJEMPLO_ORIENTACION: EjemploOrientacion = {
  etiqueta: "Ejemplo",
  avisoNoCliente:
    "Ejemplo elaborado por TecRural con una foto propia. No es el caso de un cliente ni un análisis real: sirve para que veas qué información recibirías.",
  foto: {
    src: "/aguacate.jpg",
    alt: "Hoja de aguacate con lesiones y punteado oscuro por chinches del aguacate.",
  },
  cultivo: "Aguacate",
  posiblesCausas: [
    {
      nombre: "Chinches del aguacate",
      indicio:
        "Punteado oscuro y pequeñas lesiones compatibles con picaduras en la hoja.",
      certeza: "Indicios moderados",
    },
    {
      nombre: "Ácaros (araña roja)",
      indicio:
        "También producen punteado fino y amarilleo; suelen empezar por el envés.",
      certeza: "Posible alternativa",
    },
    {
      nombre: "Daño por ambiente o polvo",
      indicio:
        "Manchas sin insectos visibles ni progresión clara en hojas nuevas.",
      certeza: "Menos probable con esta imagen",
    },
  ],
  queComprobar: [
    "Sacude suavemente una rama sobre una hoja blanca al amanecer: si caen insectos, apunta cuántos y cómo son.",
    "Mira el envés de varias hojas de la misma planta: ahí se ven ácaros, huevos o melaza.",
    "Compara hojas nuevas y viejas: si el daño solo está en las viejas, puede ser antiguo y no estar avanzando.",
  ],
  limitaciones: [
    "Una sola foto no permite confirmar la causa: no se ve el insecto y faltan el envés y la planta completa.",
    "El nivel de certeza describe cuánto encajan los síntomas de la foto, no la probabilidad de acertar.",
    "No es un diagnóstico definitivo ni una prescripción: cualquier tratamiento debe usar un producto autorizado para aguacate y respetar la etiqueta y el plazo de seguridad.",
  ],
  cuandoPedirAyuda:
    "Si al sacudir la rama aparecen chinches, el daño avanza o afecta al fruto, pide la revisión de un técnico (opcional y sin coste, respuesta en un máximo de 48 horas) o consúltalo con un técnico con competencia en fitosanitarios antes de tratar.",
};
