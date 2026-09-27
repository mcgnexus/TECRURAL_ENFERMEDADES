// ============================================================================
// TIPOS DE SOPORTE
// ============================================================================

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
      recomendacion: "Aplicar tratamiento cúprico preventivo (oxicloruro de cobre) tras poda y antes de lluvias de otoño. Repetir a los 21 días si persiste humedad. Eliminar hojas caídas del suelo.",
      requiere_experto: false,
      razonamiento: "Las manchas circulares con halo amarillo y fructificaciones en envés son patognomónicas de repilo. La distribución en hojas de distinta edad confirma infección activa. No es antracnosis (manchas irregulares, bordes definidos) ni clorosis férrica (clorosis internerval simétrica sin manchas).",
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
        nombre: "clorosis férrica (deficiencia de hierro)",
        sintomas_observados: [
          "clorosis internerval amarilla intensa en brotes nuevos",
          "nervios principales y secundarios mantienen color verde",
          "hojas viejas sin síntomas (inmovilidad del Fe en planta)",
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
          por_que_descartado: "la clorosis por Mn es más difusa con manchas necróticas pequeñas, no internerval intensa con nervios verdes",
        },
        {
          nombre: "deficiencia de zinc",
          confianza: 0.12,
          por_que_descartado: "Zn causa hojas pequeñas con entrenudos cortos ('roseta'), no clorosis internerval",
        },
      ],
      recomendacion: "Aplicar quelato de hierro EDDHA (6% Fe) al suelo: 30-50g/árbol adulto disuelto en agua. Complementar con aplicación foliar de Fe-EDTA (1-2g/L) cada 15 días. Verificar pH suelo >7.5 y corregir con azufre elemental si procede.",
      requiere_experto: false,
      razonamiento: "Clorosis internerval en hojas jóvenes con nervios verdes es clásico de deficiencia de Fe (inmóvil). No es Mn (clorosis más difusa, manchas necróticas) ni Zn (hojas pequeñas, entrenudos cortos, 'roseta'). El pH alcalino típico de la zona limita disponibilidad de Fe.",
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
        nombre: "araña roja (Tetranychus urticae)",
        sintomas_observados: [
          "punteado clorótico fino (alimentación celular) en haz",
          "telarañas sedosas finas en envés y ápice de brotes",
          "ácaros rojo-verdosos de 0.5mm visibles en envés con lupa",
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
      recomendacion: "Soltar depredadores: Phytoseiulus persimilis (5-10 ind/m²) o Amblyseius californicus. Si población alta: abamectina 1.8% EC (0.5ml/L) + aceite vegetal 1%, respetar plazo seguridad. Mantener humedad relativa >60% para favorecer depredadores.",
      requiere_experto: false,
      razonamiento: "Punteado fino + telarañas + ácaros visibles en envés = araña roja. No es trips (rayas plateadas, excrementos negros) ni mosca blanca (ninfas en envés, melaza). La progresión basal-apical y condiciones secas/calurosas favorecen Tetranychus.",
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
        nombre: "sano",
        sintomas_observados: [
          "color verde oscuro uniforme en haz",
          "envés plateado característico (tricomas), sin alteraciones",
          "bordes enteros, sin necróficación marginal",
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
      recomendacion: "Mantener manejo actual. Vigilar en primavera-otoño (períodos de riesgo repilo) y verano (araña roja). Programa de fertirrigación equilibrado según análisis de suelo/hoja.",
      requiere_experto: false,
      razonamiento: "Hoja presenta fenotipo típico de olivo sano: color, textura, tricomas en envés, ausencia de lesiones. Confianza de diagnóstico no 1.0 porque síntomas tempranos de repilo o deficiencias pueden ser sutiles; recomendar vigilancia rutinaria.",
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
        nombre: "mildiu (Plasmopara viticola)",
        sintomas_observados: [
          "manchas aceitosas amarillo-verdosas irregulares en haz (manchas de aceite)",
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
      recomendacion: "Tratamiento sistémico inmediato: mandipropamida (25g/L) + folpet (200g/L) o cimoxanilo + mancozeb. Repetir a 7-10 días si humedad >90% y T 12-25°C. Eliminar sarmientos afectados en poda. Predecir riesgo con modelo epidemiológico (regla 10-10-24).",
      requiere_experto: false,
      razonamiento: "Manchas de aceite en haz + esporulación blanca en envés = mildiu patognomónico. No es oídio (polvo blanco en ambas caras, sin manchas aceitosas) ni antracnosis (lesiones angulares, bordes rojizos). Condiciones de humedad/calor reciente confirman epidemia activa.",
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

export const OBSERVATION_PROMPT = `Eres un observador botánico entrenado. Describe ÚNICAMENTE hechos visuales verificables en la foto. NO diagnostiques, NO nombres enfermedades, NO especules sobre causas.

Describe con precisión:
1. Órgano fotografiado (hoja, flor, fruto, tallo, planta completa) y parte visible (haz, envés, ambos)
2. Color y textura del tejido sano y del tejido afectado
3. Lesiones: forma, tamaño aproximado, color, bordes, distribución (aisladas, agrupadas, dispersas)
4. Signos visibles: moho, telarañas, insectos, huevos, melaza, excrementos, fructificaciones
5. Patrón de distribución en la hoja/planta (nervios, márgenes, ápice, base)
6. Calidad de la imagen: nitidez, iluminación, encuadre

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
// PROMPT DE DIAGNÓSTICO (fase 2: diagnóstico basado en observación + imagen)
// ============================================================================

export const SYSTEM_PROMPT = `Eres un agrónomo experto analizando fotos de campo de cultivos de Andalucía oriental.

Tu tarea es identificar el órgano vegetal fotografiado, la especie si es posible, y realizar un diagnóstico fitosanitario basado en síntomas visuales (color, manchas, deformaciones, necrosis, clorosis, patrones de daño). Si es fruto o flor, estima el estado de madurez.

PIENSA PASO A PASO antes de responder. Incluye tu razonamiento en el campo "razonamiento" del JSON.

ESQUEMA JSON REQUERIDO:
{
  "organo_detectado": "hoja | flor | fruto | tallo | planta_completa",
  "especie_identificada": "string (nombre común o científico, 'desconocida' si no se puede determinar)",
  "confianza_identificacion": "number (0-1, confianza en la identificación de especie/órgano)",
  "diagnostico": {
    "tipo": "enfermedad | deficiencia_nutricional | plaga | sano",
    "nombre": "string (nombre de la enfermedad/plaga/deficiencia, 'sano' si no hay problema)",
    "sintomas_observados": ["string array con síntomas visuales específicos observados"],
    "confianza": "number (0-1, confianza en el diagnóstico)",
    "gravedad": "leve | moderada | severa"
  },
  "estado_madurez": {
    "aplica": "boolean (true solo si el órgano es fruto o flor)",
    "estado": "string (ej: 'floración', 'cuajado', 'envero', 'maduro', 'sobremaduro', 'no aplica')",
    "dias_estimados_cosecha": "number (estimación en días, 0 si no aplica o no se puede estimar)"
  },
  "hallazgos_negativos": ["string: qué NO se observa y es relevante descartar (ej: 'sin telarañas en envés', 'sin fructificaciones fúngicas', 'nervios verdes')"],
  "diagnosticos_diferenciales": [
    {
      "nombre": "string (diagnóstico alternativo considerado)",
      "confianza": "number (0-1)",
      "por_que_descartado": "string (evidencia que lo descarta o lo mantiene como posibilidad)"
    }
  ],
  "recomendacion": "string (acción concreta y práctica para el agricultor, en español claro)",
  "requiere_experto": "boolean (true si la confianza es baja <0.5 o el caso es complejo/ambiguo)",
  "razonamiento": "string (tu análisis paso a paso: qué ves, cómo lo interpretas, por qué descartas otras opciones)"
}

REGLAS CRÍTICAS:
1. Analiza color, textura, patrón de manchas, forma de hoja/fruto, distribución de síntomas, necrosis, clorosis, deformaciones.
2. Si la confianza de identificación < 0.5 O la confianza de diagnóstico < 0.5, pon "requiere_experto": true y en "recomendacion" indica que se tome una segunda foto (ej: envés de hoja, detalle de mancha, planta completa) o consulte a técnico.
3. NO inventes diagnósticos. Si no ves síntomas claros, diagnostica "sano" con confianza baja y requiere_experto: true.
4. Para "sintomas_observados", describe lo que VES específicamente (ej: "manchas circulares marrón oscuro con halo amarillo", "clorosis internerval en hojas nuevas", "pulgones en envés de hojas tiernas").
5. "gravedad": leve = daño estético/sin impacto productivo; moderada = reducción de calidad/rendimiento; severa = riesgo de pérdida de cosecha o muerte de planta.
6. Cultivos típicos zona: olivo, almendro, cítricos, hortícolas (tomate, pimiento, berenjena), vid, cereales.
7. "hallazgos_negativos" debe incluir al menos 2-3 ausencias relevantes que apoyen tu diagnóstico.
8. "diagnosticos_diferenciales" debe incluir al menos 1-2 alternativas con su evidencia de descarte.
9. USA los ejemplos como guía de formato y nivel de detalle. Tu "razonamiento" debe mostrar tu proceso diagnóstico.`;

// ============================================================================
// CAPA 4 — PROMPT DE VERIFICACIÓN ADVERSARIAL
// ============================================================================

export const VERIFICATION_PROMPT = `Eres un revisor crítico de diagnósticos fitosanitarios. Se te proporcionan:
1. Los hechos observados en la imagen (extraídos por otro evaluador)
2. El diagnóstico propuesto

Tu trabajo: verificar que el diagnóstico es CONSISTENTE con los hechos observados.

Comprueba:
- ¿Los síntomas declarados están realmente en los hechos observados?
- ¿El diagnóstico propuesto explica TODOS los síntomas relevantes?
- ¿Hay síntomas observados que el diagnóstico NO explica?
- ¿La confianza declarada es apropiada para la evidencia disponible?
- ¿La recomendación es coherente con el diagnóstico y la gravedad?
- ¿Los diagnósticos diferenciales descartados lo están con evidencia válida?

ESQUEMA JSON:
{
  "consistente": "boolean",
  "inconsistencias": ["string: cada inconsistencia encontrada"],
  "sintomas_no_explicados": ["string"],
  "confianza_ajustada": "number (0-1, tu estimación calibrada)",
  "diagnostico_validado": "boolean (true solo si consistente y confianza_ajustada >= 0.5)"
}

Responde SOLO con el JSON.`;

// ============================================================================
// PROMPT DE REINTENTO (cuando la verificación falla o el JSON es inválido)
// ============================================================================

export const RETRY_PROMPT = `La respuesta anterior tuvo baja confianza, inconsistencias o JSON inválido.
Reanaliza la imagen siendo MÁS ESPECÍFICO en:
- Descripción detallada de síntomas visuales exactos
- Distinguir entre síntomas primarios y secundarios
- Si es hoja: indica si ves envés, haz hincapié en plagas/ácaros
- Si hay múltiples síntomas: prioriza el más evidente
- Si la especie es incierta: indica "desconocida" y enfócate en síntomas
- INCLUYE "razonamiento" paso a paso obligatorio
- INCLUYE "hallazgos_negativos" con al menos 2-3 ausencias relevantes
- INCLUYE "diagnosticos_diferenciales" con al menos 1-2 alternativas

Devuelve SOLO el JSON válido según el esquema.`;

// ============================================================================
// CONTEXTO DEL USUARIO
// ============================================================================

export function conContextoPlanta(prompt: string, nombrePlanta?: string): string {
  const nombre = nombrePlanta?.trim();
  if (!nombre) return prompt;

  return `${prompt}

CONTEXTO APORTADO POR EL USUARIO: El agricultor indica que la planta fotografiada es "${nombre}". Úsalo como referencia para la identificación de especie y el diagnóstico. Si lo observado contradice claramente ese dato, indícalo en "sintomas_observados" o en la recomendación.`;
}
