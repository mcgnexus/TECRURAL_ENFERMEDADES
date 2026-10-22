# Campaña de Facebook para captar leads con TecRural

> Estrategia alineada con el funnel actual de la app: **un análisis anónimo,
> luego contacto por correo para desbloquear el informe y ampliar la cuota;
> revisión técnica como opción aparte.**

---

## 1. Objetivo y embudo

- **Objetivo de la campaña:** "Potenciales clientes" (Lead Generation) o
  "Tráfico" si prefieres recoger correos fuera de Facebook antes de entrar a
  la app.
- **Mensaje central:** "Prueba gratis: sube una foto de tu planta y recibe una
  orientación inmediata. Si quieres el informe completo y ampliar a 6 análisis
  semanales, deja tu correo."
- **Beneficio principal en el anuncio:** "Conoce posibles causas y qué
  comprobar a continuación". El tratamiento con dosis existe en la app, pero
  no siempre procede proponerlo para una foto dada: no debe ser el gancho
  principal de la publicidad.

## 2. Formato y piezas creativas

### A. Anuncios estáticos o carrusel

| Formato | Cuándo usarlo | Copia principal |
|---------|---------------|-----------------|
| **Imagen única** | Si quieres algo rápido y barato. | "¿Problemas en tu cultivo? Sube una foto y recibe orientación experta en segundos." |
| **Carrusel (3-4 cards)** | Para mostrar el proceso paso a paso. | *Tarjeta 1:* "¿Tu planta tiene síntomas?" *Tarjeta 2:* "Haz una foto clara" *Tarjeta 3:* "Recibe orientación gratuita" *Tarjeta 4:* "Deja tu correo y obtén el informe completo + 6 análisis semanales" |

### B. Copy (texto del anuncio)

**Título (Headline):** hasta 90 caracteres

- Opción A: "Diagnóstico gratis para tu cultivo"
- Opción B: "¿Tu planta está sana? Haz un análisis ahora"

**Texto principal (Primary text):** hasta 125 caracteres (en móvil se
recorta). Enfatiza lo que obtienen al instante y la separación clara:

> "Sube una foto de tu planta y recibe una orientación inicial gratuita. No es
> un diagnóstico definitivo: es una herramienta para detectar problemas
> comunes. Si el caso lo requiere, desbloquea el informe completo con
> tratamiento y dosis, y amplía a 6 análisis semanales con tu correo. Sin
> compromiso, sin teléfono necesario al principio."

**Texto secundario (News description):** hasta 30 caracteres (opcional,
aparece en el feed)

- "Orientación fitosanitaria para el Altiplano de Granada."

### C. Imagen o video

- **Foto de una hoja con síntomas claros** (primer plano, buena luz).
- **GIF corto** (3-4 s) que simula: *foto → análisis → resultado en pantalla*.
  Texto superpuesto: "Sube tu foto → Obtén tu orientación."
- **Evitar:** imágenes de médicos o consultas médicas; el sector es
  agronómico. Tono cercano y de confianza, no clínico.

## 3. Segmentación

| Criterio | Recomendación |
|----------|---------------|
| **Ubicación** | Provincias con actividad agronómica: Granada, Málaga, Sevilla, Cádiz. Con presupuesto estrecho, limita al Altiplano y la Costa Tropical de Granada. |
| **Edad** | 30-65 años (el agricultor con tierras de responsabilidad propia; el más joven suele consultar por WhatsApp). |
| **Género** | Ambos; en el sector primario no hay sesgo fuerte. |
| **Intereses** | "Agricultura", "Jardinería", "Fitopatología", "Cuidado de plantas", "Huerta ecológica". |
| **Comportamiento** | "Compra equipos agrícolas", "Sigue páginas de jardinería". |
| **Personalización** | Audiencia similar (Lookalike) a la base de leads existentes (aunque sean pocos al principio). |

## 4. Landing page (dentro de la app)

El anuncio debe llevar directo a la **portada** (`/`). El embudo ya está
optimizado:

1. **Portada** → "Analizar mi planta" → captura.
2. **1 análisis gratis** → orientación completa en pantalla.
3. **Pantalla de resultado** → tarjeta "Llévate el informe completo" con
   formulario de correo (solo correo, sin teléfono obligatorio).
4. **Después:** si deja correo → informe desbloqueado + límite ampliado a
   6/semana (cuota basada en correo).

**No envíes el tráfico directo al formulario de "contacto directo"**
(`/contacto`): ese flujo tiene otro objetivo (revisión técnica con teléfono).
Mantén el embudo: *foto → orientación → correo*.

## 5. Variantes de anuncio por intención

Crea **3 anuncios en el mismo conjunto** para medir qué copia conviene más:

| Anuncio | Enfoque | CTA esperada |
|---------|---------|--------------|
| **A** | "Prueba gratis, sin teléfono" | Registro de correo en la app |
| **B** | "¿Problemas con tu cultivo?" | Mismo, con gancho de dolor |
| **C** | "Informe completo con dosis y tratamiento" | Quien ya sabe qué quiere; conduce directo al resultado donde ve el valor del informe |

## 6. Presupuesto y cronograma

- **Presupuesto diario:** empieza con **5-10 €/día** (mercado de nicho).
- **Duración inicial:** 7 días, suficiente para ~50-80 leads y para medir la
  tasa de conversión clave: *leads → informes desbloqueados*.
- **Optimización:** a los 3-5 días, duplica el presupuesto del anuncio con
  mejor "coste por lead cualificado" (define lead cualificado: quien dejó
  correo y vio el informe).

## 7. Eventos y seguimiento

El Meta Pixel (solo producción, sin banner de consentimiento: pendiente legal
documentado) registra `PageView` y, desde el formulario del informe, estas
conversiones, sin datos personales en los parámetros:

- **`Lead`** (estándar): envío correcto del formulario con el contacto. Es la
  conversión de las campañas.
- **`RevisionTecnica`** (personalizado): marcó la revisión técnica. No vale lo
  mismo que un correo suelto: exige respuesta en 48 h.
- **`SuscripcionCorreo`** (personalizado): aceptó novedades por correo. Es la
  base de lista, sin urgencia comercial.

En analítica interna, el embudo first-party sigue en `/api/eventos`
(`lead_enviado`, `informe_desbloqueado`, …). No confundir: los eventos internos
no llegan a Meta; la conversión se dispara aparte desde el cliente. Asigna
valor estimado al `Lead` (p. ej. 8 €) y mayor a `RevisionTecnica`.

## 8. Retargeting

Crea audiencias personalizadas:

| Audiencia | Anuncio de seguimiento |
|-----------|------------------------|
| **Visitantes que vieron pero no enviaron** | "¿Aún no lo has probado? Tu planta te está esperando. Sube una foto y recibe orientación gratis." |
| **Leads obtenidos (solo correo)** | "Gracias por probar TecRural. Si quieres, un técnico puede revisar tu caso: solicita la revisión técnica en la app." |
| **Usuarios que ampliaron cuota** | "Ya tienes 6 análisis semanales. ¿Necesitas más? Programa una revisión con un técnico." |

## 9. Cumplimiento y consideraciones legales

- **Privacidad:** el anuncio no debe prometer "diagnóstico médico". Usa
  "orientación fitosanitaria", "sugerencias de tratamiento", "confirmar el
  registro del producto".
- **Consentimiento:** el formulario de la app ya separa la autorización de
  informe + límite semanal de la solicitud de revisión técnica. En el anuncio,
  enlaza a la política de privacidad.
- **Sin llamada obligatoria:** el anuncio no debe decir "llámanos ahora". Usa
  "deja tu correo" u "obtén el informe".

## 10. KPIs de éxito

| Métrica | Objetivo inicial |
|---------|-----------------|
| **Coste por lead (CPL)** | < 3-5 € |
| **Lead → informe desbloqueado** | > 40 % |
| **Informe → revisión técnica solicitada** | ~10-15 % |
| **Coste por cuota ampliada** | < 2 € |

## Resumen rápido del creativo

> **Título:** Diagnóstico gratis para tu cultivo
> **Texto:** Sube una foto de tu planta y recibe orientación inicial gratuita.
> Conoce posibles causas y qué comprobar a continuación. Deja tu correo y
> amplía a 6 análisis semanales. Sin teléfono, sin registro.
> **Imagen:** foto de una hoja con síntomas claros, buena luz, fondo sencillo.
> **Segmentación:** agricultores de Granada, Málaga, Sevilla; 30-65 años;
> intereses: agricultura, jardinería.
> **Objetivo:** Lead Generation (recogida de correos dentro de la app).
> **Follow-up:** retargeting a quienes dejaron correo, ofreciendo la revisión
> técnica opcional.

Con este enfoque se respeta la estructura de la app (correo primero, teléfono
solo para revisión), se obtienen leads cualificados (personas que ya vieron la
orientación y están dispuestas a dejar contacto) y se deja la puerta abierta a
la revisión técnica solo para quien realmente la necesita.
