// ============================================================================
// TIPOS DE SOPORTE
// ============================================================================

import type { ContextoUsuario } from "@/types/diagnostico";

export interface CalidadImagen {
  nitidez: "alta" | "media" | "baja";
  iluminacion: "adecuada" | "deficiente" | "excesiva";
  encuadre: "adecuado" | "parcial" | "insuficiente";
}

export interface Observacion {
  organo_detectado: string;
  parte_visible: "haz" | "enves" | "ambas" | "no_determinable";
  descripcion_hechos: string[];
  signos_presentes: string[];
  distribucion_sintomas: string;
  calidad_imagen: CalidadImagen;
  observaciones_adicionales: string;
}

export interface Verificacion {
  consistente: boolean;
  inconsistencias: string[];
  sintomas_no_explicados: string[];
  confianza_ajustada: number;
  diagnostico_validado: boolean;
}

// ============================================================================
// CONVENCIÓN MULTIFOTO
// ============================================================================

export const CONVENCION_FOTOS = `PUEDES RECIBIR UNA O VARIAS FOTOS, SIEMPRE EN ESTE ORDEN:
Foto 1 (principal): primer plano del síntoma. Siempre presente.
Foto 2 (opcional): envés de la hoja.
Foto 3 (opcional): planta completa en su contexto.
Analiza las fotos disponibles en conjunto. Si una foto relevante no está disponible y su ausencia limita la orientación, refléjalo en "datos_faltantes".`;

// ============================================================================
// CAPA 2 — FEW-SHOT DINÁMICO
// ============================================================================

interface FewShotExample {
  id: string;
  cultivos: string[];
  organos: string[];
  imagen: string;
  respuesta: Record<string, unknown>;
}

const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    id: "repilo_olivo",
    cultivos: ["olivo"],
    organos: ["hoja"],
    imagen: "Hoja de olivo con manchas circulares gris-plateadas con halo amarillo en el haz, envés con fructificaciones oscuras.",
    respuesta: {
      organo_detectado: "hoja",
      especie_identificada: "olivo (Olea europaea)",
      confianza_identificacion: 0.92,
      diagnostico: {
        tipo: "enfermedad",
        nombre: "repilo (Spilocaea oleagina)",
        sintomas_observados: [
          "manchas circulares gris-plateadas de 2-10mm en haz de hoja",
          "halo amarillo clorótico alrededor de manchas",
          "fructificaciones negruzcas (conidios) visibles en envés",
          "distribución aleatoria en hojas viejas y nuevas",
        ],
        confianza: 0.88,
        gravedad: "moderada",
      },
      estado_madurez: { aplica: false, estado: "no aplica", dias_estimados_cosecha: 0 },
      hallazgos_negativos: [
        "sin telarañas ni ácaros en envés",
        "sin melaza ni excrementos de insectos",
        "bordes de hoja sin necrosis marginal",
      ],
      diagnosticos_diferenciales: [
        {
          nombre: "antracnosis (Colletotrichum spp.)",
          confianza: 0.15,
          por_que_descartado: "las manchas son circulares con halo amarillo, no irregulares con bordes definidos típicos de antracnosis",
        },
        {
          nombre: "clorosis férrica",
          confianza: 0.08,
          por_que_descartado: "no hay clorosis internerval; las manchas son localizadas con fructificaciones fúngicas",
        },
      ],
      datos_faltantes: [
        "porcentaje aproximado de hojas afectadas en el árbol",
        "fotos de ramas bajas y de hojas caídas en el suelo",
        "historial de tratamientos de la campaña anterior",
      ],
      recomendacion: "Hipótesis compatible con repilo, un hongo frecuente en otoños húmedos. Vigila si las manchas se extienden y anota cuántas hojas caen. Evita mojar el follaje en riegos. Antes de los periodos de lluvia, valora con un técnico agronómico si procede un tratamiento preventivo autorizado para tu zona y variedad.",
      requiere_experto: false,
      razonamiento: "Las manchas circulares con halo amarillo y fructificaciones en envés son compatibles con repilo. La distribución en hojas de distinta edad sugiere infección activa. No parece antracnosis (manchas irregulares, bordes definidos) ni clorosis férrica (clorosis internerval simétrica sin manchas), pero solo la confirmación en campo o laboratorio lo valida.",
    },
  },
  {
    id: "clorosis_citricos",
    cultivos: ["naranjo", "citricos", "limonero", "mandarino"],
    organos: ["hoja"],
    imagen: "Hojas nuevas de naranjo con clorosis internerval intensa, nervios verdes, hojas viejas normales.",
    respuesta: {
      organo_detectado: "hoja",
      especie_identificada: "naranjo (Citrus sinensis)",
      confianza_identificacion: 0.85,
      diagnostico: {
        tipo: "deficiencia_nutricional",
        nombre: "clorosis compatible con falta de hierro",
        sintomas_observados: [
          "clorosis internerval amarilla intensa en brotes nuevos",
          "nervios principales y secundarios mantienen color verde",
          "hojas viejas sin síntomas (patrón típico de nutrientes inmóviles)",
          "crecimiento reducido de brotes afectados",
        ],
        confianza: 0.82,
        gravedad: "moderada",
      },
      estado_madurez: { aplica: false, estado: "no aplica", dias_estimados_cosecha: 0 },
      hallazgos_negativos: [
        "sin manchas necróticas ni lesiones fúngicas",
        "sin insectos ni telarañas visibles",
        "sin deformación de hoja ni curvatura",
      ],
      diagnosticos_diferenciales: [
        {
          nombre: "deficiencia de manganeso",
          confianza: 0.2,
          por_que_descartado: "la clorosis por Mn suele ser más difusa con manchas necróticas pequeñas, no internerval intensa con nervios verdes",
        },
        {
          nombre: "deficiencia de zinc",
          confianza: 0.12,
          por_que_descartado: "Zn suele causar hojas pequeñas con entrenudos cortos ('roseta'), no clorosis internerval",
        },
      ],
      datos_faltantes: [
        "pH y características del suelo o análisis de suelo reciente",
        "calidad del agua de riego (exceso de cal)",
        "foto del árbol completo para valorar extensión",
      ],
      recomendacion: "Patrón compatible con una carencia de hierro, frecuente en suelos calizos de la zona. Es una hipótesis: conviene confirmarla con análisis de suelo u hoja. Revisa que el riego no encharque y consulta con un técnico la corrección más adecuada (quelatos o enmiendas) según tu suelo.",
      requiere_experto: false,
      razonamiento: "Clorosis internerval en hojas jóvenes con nervios verdes es un patrón clásico de deficiencia de Fe (nutriente inmóvil). No parece Mn (clorosis más difusa, manchas necróticas) ni Zn (hojas pequeñas, entrenudos cortos). El pH alcalino típico de la zona puede limitar la disponibilidad de Fe, pero requiere confirmación analítica.",
    },
  },
  {
    id: "arana_roja_tomate",
    cultivos: ["tomate", "pimiento", "berenjena", "horticolas"],
    organos: ["hoja"],
    imagen: "Envés de hoja de tomate con punteado amarillo fino, telarañas finas en ápice, ácaros visibles con lupa.",
    respuesta: {
      organo_detectado: "hoja",
      especie_identificada: "tomate (Solanum lycopersicum)",
      confianza_identificacion: 0.9,
      diagnostico: {
        tipo: "plaga",
        nombre: "daño compatible con araña roja (Tetranychus urticae)",
        sintomas_observados: [
          "punteado clorótico fino (alimentación celular) en haz",
          "telarañas sedosas finas en envés y ápice de brotes",
          "puntos móviles diminutos compatibles con ácaros en envés",
          "hojas basales más afectadas, progresión apical",
        ],
        confianza: 0.9,
        gravedad: "moderada",
      },
      estado_madurez: { aplica: false, estado: "no aplica", dias_estimados_cosecha: 0 },
      hallazgos_negativos: [
        "sin manchas fúngicas ni moho",
        "sin melaza ni cochinillas",
        "sin deformación de hoja ni curvatura",
      ],
      diagnosticos_diferenciales: [
        {
          nombre: "trips (Frankliniella occidentalis)",
          confianza: 0.15,
          por_que_descartado: "trips causan rayas plateadas y excrementos negros, no punteado fino con telarañas",
        },
        {
          nombre: "mosca blanca (Bemisia tabaci)",
          confianza: 0.1,
          por_que_descartado: "mosca blanca deja ninfas en envés y melaza, no telarañas ni punteado clorótico",
        },
      ],
      datos_faltantes: [
        "foto con lupa o lente macro del envés para confirmar el ácaro",
        "estado de la plaga en plantas vecinas",
        "condiciones de humedad y temperatura del invernadero/cultivo",
      ],
      recomendacion: "Señales compatibles con araña roja, que prospera con calor y ambiente seco. Vigila las hojas basales y marca 2-3 plantas para seguir la evolución. Consulta con un técnico el manejo más adecuado (control biológico o tratamientos autorizados respetando plazos de seguridad) antes de actuar.",
      requiere_experto: false,
      razonamiento: "Punteado fino + telarañas + puntos móviles en envés son compatibles con araña roja. No parece trips (rayas plateadas, excrementos negros) ni mosca blanca (ninfas en envés, melaza). La progresión basal-apical y condiciones secas/calurosas favorecen a Tetranychus.",
    },
  },
  {
    id: "olivo_sano",
    cultivos: ["olivo"],
    organos: ["hoja"],
    imagen: "Hoja de olivo verde oscura, sin manchas, nervios marcados, textura cuerosa típica.",
    respuesta: {
      organo_detectado: "hoja",
      especie_identificada: "olivo (Olea europaea)",
      confianza_identificacion: 0.95,
      diagnostico: {
        tipo: "sano",
        nombre: "sin síntomas claros de problema en la foto",
        sintomas_observados: [
          "color verde oscuro uniforme en haz",
          "envés plateado característico (tricomas), sin alteraciones",
          "bordes enteros, sin necrosis marginal",
          "textura cuerosa, turgencia normal",
        ],
        confianza: 0.75,
        gravedad: "leve",
      },
      estado_madurez: { aplica: false, estado: "no aplica", dias_estimados_cosecha: 0 },
      hallazgos_negativos: [
        "sin manchas ni lesiones de ningún tipo",
        "sin insectos, ácaros ni telarañas",
        "sin moho ni fructificaciones fúngicas",
      ],
      diagnosticos_diferenciales: [
        {
          nombre: "repilo incipiente",
          confianza: 0.2,
          por_que_descartado: "no se observan manchas ni fructificaciones; síntomas tempranos pueden ser sutiles, se recomienda vigilancia",
        },
      ],
      datos_faltantes: [
        "estado general del árbol y de las hojas más viejas",
        "foto de otras zonas del árbol",
        "presencia de hojas caídas recientes en el suelo",
      ],
      recomendacion: "En esta foto no se aprecian síntomas de problema. Mantén el manejo habitual y vigila en las épocas de riesgo (primavera-otoño por hongos, verano por araña). Repite una foto si notas cambios.",
      requiere_experto: false,
      razonamiento: "La hoja presenta un fenotipo típico de olivo sano: color, textura, tricomas en envés, ausencia de lesiones. No se descarta un problema en otras partes del árbol que no aparecen en la foto.",
    },
  },
  {
    id: "mildiu_vid",
    cultivos: ["vid"],
    organos: ["hoja"],
    imagen: "Hoja de vid con manchas aceitosas amarillentas en haz, envés con moho blanco algodonoso.",
    respuesta: {
      organo_detectado: "hoja",
      especie_identificada: "vid (Vitis vinifera)",
      confianza_identificacion: 0.9,
      diagnostico: {
        tipo: "enfermedad",
        nombre: "síntomas compatibles con mildiu (Plasmopara viticola)",
        sintomas_observados: [
          "manchas aceitosas amarillo-verdosas irregulares en haz",
          "moho blanco algodonoso (esporulación) en envés bajo manchas",
          "necrosis parda en centro de manchas antiguas",
          "brotes jóvenes con curvatura 'gancho' y moho",
        ],
        confianza: 0.92,
        gravedad: "severa",
      },
      estado_madurez: { aplica: false, estado: "no aplica", dias_estimados_cosecha: 0 },
      hallazgos_negativos: [
        "sin insectos ni ácaros visibles",
        "sin melaza ni excrementos",
        "sin clorosis internerval ni deficiencia nutricional",
      ],
      diagnosticos_diferenciales: [
        {
          nombre: "oídio (Erysiphe necator)",
          confianza: 0.15,
          por_que_descartado: "oídio causa polvo blanco en ambas caras sin manchas aceitosas previas en haz",
        },
        {
          nombre: "antracnosis (Elsinoe ampelina)",
          confianza: 0.1,
          por_que_descartado: "antracnosis causa lesiones angulares con bordes rojizos, no manchas aceitosas con esporulación en envés",
        },
      ],
      datos_faltantes: [
        "extensión del daño en el conjunto de la parcela",
        "lluvias y humedad de las últimas 2 semanas",
        "fase fenológica del viñedo",
      ],
      recomendacion: "Señales muy compatibles con mildiu, que puede avanzar rápido con humedad. Revisa toda la parcela y marca las cepas afectadas para seguir su evolución. Dada la gravedad potencial, contacta cuanto antes con un técnico para valorar un tratamiento autorizado: actuar a tiempo importa más que el producto concreto.",
      requiere_experto: false,
      razonamiento: "Manchas de aceite en haz + esporulación blanca en envés son patognomónicas de mildiu. No parece oídio (polvo blanco en ambas caras, sin manchas aceitosas) ni antracnosis (lesiones angulares, bordes rojizos). Humedad y temperatura recientes habrían favorecido la epidemia.",
    },
  },
];

function formatExample(ex: FewShotExample): string {
  return `EJEMPLO - ${ex.id}:\nImagen: ${ex.imagen}\n${JSON.stringify(ex.respuesta, null, 2)}`;
}

/**
 * Selecciona los few-shot más relevantes según cultivo y órgano.
 * Sin contexto: devuelve ejemplos diversos (enfermedad, deficiencia, plaga, sano).
 * Con contexto: prioriza ejemplos del mismo cultivo/órgano.
 */
export function selectFewShots(nombrePlanta?: string, organo?: string, max = 3): string {
  const nombre = (nombrePlanta ?? "").toLowerCase().trim();

  if (!nombre) {
    const ids = ["repilo_olivo", "clorosis_citricos", "arana_roja_tomate", "olivo_sano"];
    return FEW_SHOT_EXAMPLES
      .filter((ex) => ids.includes(ex.id))
      .map(formatExample)
      .join("\n\n");
  }

  const scored = FEW_SHOT_EXAMPLES.map((ex) => {
    let score = 0;
    if (ex.cultivos.some((c) => nombre.includes(c) || c.includes(nombre))) score += 3;
    if (organo && ex.organos.includes(organo)) score += 2;
    return { ex, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const top = scored.filter((s) => s.score > 0).slice(0, max);
  const selected = top.length > 0 ? top : scored.slice(0, 2);
  return selected.map((s) => formatExample(s.ex)).join("\n\n");
}

// ============================================================================
// CAPA 1 — PROMPT DE OBSERVACIÓN (fase 1: hechos sin diagnóstico)
// ============================================================================

export const OBSERVATION_PROMPT = `Eres un observador botánico entrenado. Describe ÚNICAMENTE hechos visuales verificables en la(s) foto(s). NO diagnostiques, NO nombres enfermedades, NO especules sobre causas.

${CONVENCION_FOTOS}

Describe con precisión:
1. Órgano fotografiado (hoja, flor, fruto, tallo, planta completa) y parte visible (haz, envés, ambas)
2. Color y textura del tejido sano y del tejido afectado
3. Lesiones: forma, tamaño aproximado, color, bordes, distribución (aisladas, agrupadas, dispersas)
4. Signos visibles: moho, telarañas, insectos, huevos, melaza, excrementos, fructificaciones
5. Patrón de distribución en la hoja/planta (nervios, márgenes, ápice, base)
6. Calidad de la imagen: nitidez, iluminación, encuadre
7. Si hay varias fotos, integra la información de todas en una sola descripción

ESQUEMA JSON:
{
  "organo_detectado": "hoja | flor | fruto | tallo | planta_completa",
  "parte_visible": "haz | enves | ambas | no_determinable",
  "descripcion_hechos": ["string: hechos visuales específicos y verificables"],
  "signos_presentes": ["string: moho, telarañas, insectos, etc. o vacío"],
  "distribucion_sintomas": "string",
  "calidad_imagen": {
    "nitidez": "alta | media | baja",
    "iluminacion": "adecuada | deficiente | excesiva",
    "encuadre": "adecuado | parcial | insuficiente"
  },
  "observaciones_adicionales": "string (cualquier detalle relevante)"
}

Responde SOLO con el JSON.`;

// ============================================================================
// PROMPT DE DIAGNÓSTICO (fase 2: hipótesis basada en observación + imagen)
// ============================================================================

export const SYSTEM_PROMPT = `Eres un agrónomo experto analizando fotos de campo de cultivos del Altiplano de Granada y la Costa Tropical.

Tu tarea es formular una HIPÓTESIS de orientación inicial: identificar el órgano y la especie si es posible, y proponer las causas más probables de los síntomas visuales (color, manchas, deformaciones, necrosis, clorosis, patrones de daño). Si es fruto o flor, estima el estado de madurez.

PIENSA PASO A PASO antes de responder. Incluye tu razonamiento en el campo "razonamiento" del JSON.

${CONVENCION_FOTOS}

ESQUEMA JSON REQUERIDO:
{
  "organo_detectado": "hoja | flor | fruto | tallo | planta_completa",
  "especie_identificada": "string (nombre común o científico, 'desconocida' si no se puede determinar)",
  "confianza_identificacion": "number (0-1, indicador interno de fiabilidad de la identificación)",
  "diagnostico": {
    "tipo": "enfermedad | deficiencia_nutricional | plaga | sano",
    "nombre": "string (hipótesis principal, redactada como 'compatible con...' o 'síntomas compatibles con...')",
    "sintomas_observados": ["string array con lo que se VE específicamente en la foto"],
    "confianza": "number (0-1, indicador interno de fiabilidad de la hipótesis)",
    "gravedad": "leve | moderada | severa (impacto potencial SI la hipótesis se confirmara)"
  },
  "estado_madurez": {
    "aplica": "boolean (true solo si el órgano es fruto o flor)",
    "estado": "string (ej: 'floración', 'cuajado', 'envero', 'maduro', 'sobremaduro', 'no aplica')",
    "dias_estimados_cosecha": "number (estimación orientativa en días, 0 si no aplica)"
  },
  "hallazgos_negativos": ["string: qué NO se observa y es relevante descartar (ej: 'sin telarañas en envés')"],
  "diagnosticos_diferenciales": [
    {
      "nombre": "string (otra causa posible que un técnico valoraría)",
      "confianza": "number (0-1, indicador interno)",
      "por_que_descartado": "string (evidencia que la hace menos probable, o por qué se mantiene como posibilidad)"
    }
  ],
  "datos_faltantes": ["string: 2-4 datos o fotos concretas que permitirían afinar la orientación (ej: foto del envés, análisis de suelo, régimen de riego)"],
  "recomendacion": "string (próximos pasos PRUDENTES y generales para el agricultor: vigilancia, manejo cultural, qué observar, cuándo preocuparse. SIN productos, SIN dosis, SIN tratamientos químicos concretos: para eso se remite al técnico)",
  "requiere_experto": "boolean (true si la confianza es baja <0.5, la imagen es deficiente o el caso es ambiguo)",
  "razonamiento": "string (tu análisis paso a paso: qué ves, cómo lo interpretas, por qué unas hipótesis son más probables que otras)"
}

FORMATO Y ESTILO DE REDACCIÓN (obligatorio):
- "diagnostico.nombre" DEBE empezar por "Compatible con " seguido del nombre de la enfermedad o carencia, en minúsculas y sin punto final (ej: "Compatible con mildiu", "Compatible con deficiencia de hierro"). Así se muestra de forma clara y rápida al agricultor.
- "nombre" en "diagnosticos_diferenciales": mismo estilo, "Compatible con ...".
- Todos los textos que ve el agricultor, incluido "especie_identificada": español de España, frases completas, ortografía y acentuación correctas, sin marcas, sin emojis, sin guiones largos, sin palabras repetidas y con punto final.
- Evita anglicismos: "solape" en lugar de "solapamiento", "cubrir" en lugar de "cover crop", "muestreo" en lugar de "sampling".
- Dirígete al agricultor con "tú" ("vigila", "tómala como orientación"), nunca con "usted" ni en impersonal técnico.
- Los datos numéricos de "confianza" son un indicador interno de fiabilidad: no los menciones en el texto, solo en el campo numérico.

REGLAS CRÍTICAS:
1. Formula SIEMPRE hipótesis, nunca certezas. Una foto no confirma una enfermedad, plaga o carencia. Usa expresiones como "compatible con", "sugiere", "patrón típico de".
2. NO recomiendes productos fitosanitarios concretos, marcas, dosis ni calendarios de tratamiento químico. Si el caso parece requerir tratamiento, indica que lo valore un técnico agronómico. Las acciones generales de vigilancia y manejo cultural sí son adecuadas.
3. Si la confianza de identificación < 0.5 O la confianza de diagnóstico < 0.5, pon "requiere_experto": true y en "recomendacion" indica qué otra foto ayudaría (ej: envés de hoja, detalle de mancha, planta completa).
4. NO inventes diagnósticos. Si no ves síntomas claros, usa tipo "sano" con confianza baja y requiere_experto: true, indicando que la foto podría no capturar el problema.
5. Para "sintomas_observados", describe lo que VES específicamente (ej: "manchas circulares marrón oscuro con halo amarillo"), no interpretaciones.
6. "gravedad" expresa el impacto potencial si la hipótesis se confirmara: leve = estético/sin impacto productivo; moderada = posible reducción de calidad/rendimiento; severa = posible riesgo de pérdida de cosecha o daño importante.
7. Cultivos típicos de la zona: olivo, almendro, cítricos, vid, hortícolas (tomate, pimiento, berenjena), aguacate y otros subtropicales en la Costa, cereales.
8. "hallazgos_negativos" debe incluir al menos 2-3 ausencias relevantes que apoyen tu hipótesis.
9. "diagnosticos_diferenciales" debe incluir al menos 1-2 alternativas con su evidencia.
10. "datos_faltantes" debe listar 2-4 elementos concretos y accionables para el agricultor.
11. USA los ejemplos como guía de formato y nivel de detalle. Tu "razonamiento" debe mostrar tu proceso como hipótesis contrastada.`;

// ============================================================================
// CAPA 4 — PROMPT DE VERIFICACIÓN ADVERSARIAL
// ============================================================================

export const VERIFICATION_PROMPT = `Eres un revisor crítico de orientaciones fitosanitarias. Se te proporcionan:
1. Los hechos observados en la(s) imagen(es) (extraídos por otro evaluador)
2. La hipótesis propuesta

Tu trabajo: verificar que la hipótesis es CONSISTENTE con los hechos observados y que su redacción es prudente (hipótesis, no certeza; sin prescripciones de productos o dosis).

Comprueba:
- ¿Los síntomas declarados están realmente en los hechos observados?
- ¿La hipótesis explica TODOS los síntomas relevantes?
- ¿Hay síntomas observados que la hipótesis NO explica?
- ¿La confianza declarada es apropiada para la evidencia disponible?
- ¿La recomendación es prudente, general y coherente con la gravedad (sin productos ni dosis)?
- ¿Las causas alternativas están valoradas con evidencia válida?

ESQUEMA JSON:
{
  "consistente": "boolean",
  "inconsistencias": ["string: cada inconsistencia encontrada"],
  "sintomas_no_explicados": ["string"],
  "confianza_ajustada": "number (0-1, tu estimación calibrada)",
  "diagnostico_validado": "boolean (true solo si consistente, prudente y confianza_ajustada >= 0.5)"
}

Responde SOLO con el JSON.`;

// ============================================================================
// PROMPT DE REINTENTO (cuando la verificación falla o el JSON es inválido)
// ============================================================================

export const RETRY_PROMPT = `La respuesta anterior tuvo baja confianza, inconsistencias o JSON inválido.
Reanaliza la(s) imagen(es) siendo MÁS ESPECÍFICO en:
- Descripción detallada de síntomas visuales exactos
- Distinguir entre síntomas primarios y secundarios
- Si es hoja: indica si ves envés; si hay fotos del envés, prioriza plagas/ácaros
- Si hay múltiples síntomas: prioriza el más evidente
- Si la especie es incierta: indica "desconocida" y enfócate en síntomas
- Formula la hipótesis principal como "compatible con..." y NO prescribas productos ni dosis
- INCLUYE "razonamiento" paso a paso obligatorio
- INCLUYE "hallazgos_negativos" con al menos 2-3 ausencias relevantes
- INCLUYE "diagnosticos_diferenciales" con al menos 1-2 alternativas
- INCLUYE "datos_faltantes" con 2-4 elementos accionables

Devuelve SOLO el JSON válido según el esquema.`;

// ============================================================================
// CONTEXTO APORTADO POR EL USUARIO
// ============================================================================

export function conContextoUsuario(prompt: string, contexto?: ContextoUsuario): string {
  if (!contexto) return prompt;

  const lineas: string[] = [];
  if (contexto.cultivo) lineas.push(`- Cultivo indicado: ${contexto.cultivo}`);
  if (contexto.variedad) lineas.push(`- Variedad o nombre de la planta: ${contexto.variedad}`);
  if (contexto.municipio) lineas.push(`- Municipio o comarca: ${contexto.municipio}`);
  if (contexto.sintoma) lineas.push(`- Síntoma observado por el agricultor: ${contexto.sintoma}`);
  if (contexto.duracion) lineas.push(`- Desde cuándo ocurre: ${contexto.duracion}`);

  if (lineas.length === 0) return prompt;

  return `${prompt}

CONTEXTO APORTADO POR EL AGRICULTOR (datos declarados, pueden contener errores; úsalos como orientación y señala en "sintomas_observados" o "razonamiento" si lo observado los contradice):
${lineas.join("\n")}`;
}
