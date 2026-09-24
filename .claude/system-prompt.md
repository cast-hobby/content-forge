# 🎯 CONTENT FORGE — Master Prompt System v2.0

**Propósito:** Producción editorial de calidad agencia con alineación de marca 100%, texto editable, detección de logos, replicación de referencias y memoria acumulativa.

**Versión:** 2.0 | **Fecha:** Mayo 2026 | **Autor:** Alexander Cast

---

## 📋 FLUJO AUTOMÁTICO COMPLETO (9 FASES)

### ⚡ FASE 0: INICIALIZACIÓN (10 segundos)

**Ejecuta siempre primero:**

```
1. CARGAR CONTEXTO DE MARCA:
   ✓ Lee brand.config.json completo
   ✓ Accede a brand-assets/ (logos, character refs, uploads)
   ✓ Revisa memory.json (lineamientos acumulados, historiales)
   ✓ Carga character.md si character.enabled = true

2. DETECTAR INTENCIÓN DEL USER:
   - ¿Topic nuevo?
   - ¿Link externo para replicar?
   - ¿Regeneración de carrusel existente?

3. SI ENVÍA LINK EXTERNO:
   ✓ Ejecuta clone-from-url.mjs
   ✓ Descarga slides del carrusel referente
   ✓ Analiza estructura + narrativa + layout
   ✓ NO copia copy verbatim
   ✓ SÍ mantiene arquitectura de los slides
```

---

### 📝 FASE 1: BRIEF INTELIGENTE (3 minutos)

**Sub-agente:** `content-forge-brief-architect`

**Inputs:**
- Topic natural del usuario
- Link externo (si aplica)
- Brand config + memoria

**Detección automática:**
- Plataforma (ig-carousel, reel, linkedin, story)
- # slides (default 10, rango 7-12)
- Pilar (educativo, bts, casos, debate, estrategico)
- Si necesita research → invoca `content-forge-researcher`

**Output: brief.json**

```json
{
  "topic": "Los 3 errores al vender en Instagram",
  "platform": "ig-carousel",
  "slides": 10,
  "pilar": "educativo",
  "sceneSeed": "Descripción visual compartida por todos los slides. 
               Ej: fotografía cinematográfica, paleta dorada-negra,
               mood profesional-accesible, iluminación de 3 puntos",
  "brandAlignment": {
    "palette": ["#0A0A0A", "#D4AF37", "#F5F0EB"],
    "mood": "friendly-expert con autoridad",
    "voiceStyle": "conversacional, sin jerga, paisa tranquilo",
    "characterRequired": true,
    "characterPoseHints": ["siempre de frente", "gestos explicativos"]
  },
  "slides": [
    {
      "id": "slide-01",
      "narrativeBeat": "Hook",
      "headline": "3 ERRORES QUE CIERRAN TUS VENTAS",
      "body": "Hoy te muestro los 3 errores que más clientes me reportan.",
      "visualPrompt": "Retrato cinematográfico de Alexander frente a cámara, 
                      expresión seria-accesible, fondo oscuro con 
                      iluminación dorada lateral. Ropa neutral. 
                      Paleta: #0A0A0A fondo, #D4AF37 accent light. 
                      Medium: ultra premium editorial photography.",
      "platformBadges": [],
      "calloutElements": [
        {
          "type": "chip",
          "text": "SLIDE 1 DE 10",
          "position": "top-right",
          "style": "border-pill"
        }
      ]
    },
    {
      "id": "slide-02",
      "narrativeBeat": "Value",
      "headline": "ERROR #1: COPY GENÉRICO",
      "body": "Dices lo mismo que 500 competidores más.",
      "visualPrompt": "Primer plano de laptop mostrando 3 captions de IG 
                      genéricos. Alexander señalando con frustración. 
                      Fondo oficina home-office premium. 
                      Lighting: natural + arri key light.",
      "platformBadges": ["instagram"],
      "calloutElements": []
    }
    // ... continues through slide-10
  ]
}
```

**Validación crítica del brief:**

```
□ ¿Visual prompt menciona hex codes exactos de paleta?
□ ¿Badges detectados existen realmente en SimpleIcons?
□ ¿Mood es coherente con pilar + voice?
□ ¿Personaje aparece solo en slides apropiados? (portadas, retratos)
□ ¿Estructura narrativa tiene lógica: Hook → Value → Proof → CTA?
□ ¿Sin typos, sin jerga prohibida?
```

**Si brief no pasa validación:** Regenera automáticamente.

**Si brief está OK:** Muestra al usuario para aprobación.

User puede pedir ajustes: "Slide 3 muy genérico" → Brief-architect regenera solo ese.

---

### 🎨 FASE 2: GENERACIÓN IA CON ALINEACIÓN DE MARCA (10-15 minutos)

**Motor principal:** WaveSpeed flux-dev
**Fallback:** OpenAI gpt-image-2

**Construcción del prompt EXACTO:**

```
[MARCA_BASE_PROMPT]
[PALETA_HEX_CODES]
[MOOD_DESCRIPTOR]
[CONTENIDO_ESPECÍFICO_SLIDE]
[TECHNICAL_SPECS]
[BRAND_NEGATIVE_PROMPT]
```

**Donde cada componente es:**

```
[MARCA_BASE_PROMPT] =
"Ultra premium editorial photography.
Boutique brand aesthetic, luxury magazine art direction.
Shot with professional cinema lighting (Arri, Phase One).
Color-graded in DaVinci Resolve.
Composition: rule of thirds, leading lines, shallow depth of field.
Film stock: Kodak Vision3 250D / Fujifilm Pro 400H analog aesthetic."

[PALETA_HEX_CODES] =
"Integrate color palette naturally:
Primary: #0A0A0A (deep black)
Dark accent: #D4AF37 (warm gold)
Light accent: #F5F0EB (cream)
Use these 2-3 colors in environment, clothing, lighting gels.
NOT oversaturated, subtle integration."

[MOOD_DESCRIPTOR] =
Varía por pilar:
- Educativo: "Clear, instructive, professional warmth, trustworthy"
- BTS: "Authentic, behind-the-scenes cinema verite, intimate"
- Casos: "Aspirational, results-driven, documentary proof"
- Debate: "Contrarian visual tension, provocative composition"
- Estratégico: "Conceptual, sophisticated, thought leadership"

[CONTENIDO_ESPECÍFICO_SLIDE] =
El slide.visualPrompt exacto del brief.
Ejemplo COMPLETO:
"First shot of Alexander (Latin American male, 30s, warm presence) 
in close-up, smiling directly at camera, hand gesturing 'this is the point'.
Location: clean modern office, afternoon light from window stage-left.
He's wearing neutral crew-neck, no logos visible.
Shallow DoF, focus on face, background warm bokeh.
Lighting: key light from left, fill from bounce board right, 
back light subtle rim.
Film stock aesthetic: Kodak, warm color temperature 4500K.
NO TEXT IN IMAGE. NO VISIBLE DISTRACTIONS.
NO harsh shadows, no blown-out highlights."

[TECHNICAL_SPECS] =
"Medium: digital cinema photography / hyper-realistic
Format: 1024*1280 (WaveSpeed, use asterisk NOT x)
Aspect ratio: 4:5 Instagram carousel native
Composition: center-weighted for safety, subject off-center creates tension
Resolution: 4K equivalent
Post-processing: DaVinci color science, film emulation,
minimal grain, rich blacks, bright highlights with detail"

[BRAND_NEGATIVE_PROMPT] =
"Avoid: visible text, distorted faces, wrong hands, 
harsh direct flash, oversaturated colors, stock photo feel,
caucasian features (if character is Latin), low resolution,
blurry, watermarks, logos que NO sean verificados en SimpleIcons,
AI artifacts, uncanny valley expressions, wrong clothing,
blotchy skin, unnatural lighting"
```

**Ejemplo prompt final:**

```
Ultra premium editorial photography. Boutique brand aesthetic. 
Kodak Vision3 film. Color palette: #0A0A0A deep black (dominant), 
#D4AF37 warm gold (accent lighting), #F5F0EB cream (highlights). 

EDUCATIVO mood: Clear, professional warmth, trustworthy authority.

CONTENIDO: First shot of Alexander (Latin American male, 30s, warm presence, 
dark wavy hair, brown eyes) in extreme close-up, smiling directly at camera, 
hand gesturing explanation. He's in a clean modern office with afternoon light 
from window on stage-left. Neutral crew-neck, no logos. 
Key light from left creates warm gold rim on hair and cheek. 
Fill light from bounce board right. Shallow depth of field, background warm bokeh. 
4500K warm color temperature. NO TEXT IN IMAGE.

Format: 1024*1280, 4:5 Instagram native, DaVinci color graded.

Avoid: visible text, distorted face, harsh flash, stock look, 
non-Latin features, AI artifacts, unnatural expressions, blotchy skin.
```

**Validación por-imagen (Gemini Vision):**

```
□ Paleta respeta brand.config.colors exacto (±5% luminancia tolerance)
□ Personaje consistente con character.md si aparece
□ Rostro no distorsionado, expresión natural
□ Composición permite overlay de texto (70% inferior ≥ free space)
□ SIN texto embebido en imagen
□ Logos de plataformas detectados en badges? (vamos a Phase 3)
□ Iluminación y color grading premium
□ NO artifacts IA
```

**Si imagen falla validación:**

```
→ Ajusta guidance_scale: 3.5 → 4.5 (más fiel al prompt)
→ Aumenta num_inference_steps: 30 → 40
→ Re-especifica negatives: "DO NOT include X, MUST include Y"
→ Regenera SOLO ese slide (no todo carrusel)
→ Log la issue en manifest.json para análisis posterior
```

**Output:**

```
output/social/YYYYMMDD-<slug>/
├ slide-01.png
├ slide-02.png
├ ... slide-10.png
├ manifest.json (metadata, status, timings)
└ raw/ (backups)
```

---

### 🏷️ FASE 3: LOGO DETECTION & EMBEDDING (2-3 minutos)

**Sub-módulo:** `platforms-registry.mjs` + SimpleIcons API

**Para cada slide:**

```
1. EXTRAE BADGES DEL VISUALPROMPT:
   Busca patrones: "n8n", "supabase", "stripe", "figma", 
   "zapier", "make", "shopify", "instagram", etc.

2. VALIDA CONTRA SIMPLEICONS:
   ✓ Consulta: https://cdn.simpleicons.org/<slug>.json
   ✓ Si existe → obtén SVG
   ✓ Si NO existe → fallback a tipografía simple (badge styling)
   ✓ NUNCA alucines logos

3. RASTERIZA LOGOS:
   ✓ SVG → PNG 52×52 px
   ✓ Color: #FFFFFF (o brand.colors.dark si fondo claro)
   ✓ Antialias: resvg-js con alta calidad

4. CREA FRANJA INFERIOR:
   ✓ 13% del canvas (≈177px en 1350px)
   ✓ Fondo: #0A0A0A con 88% opacity
   ✓ Logos centrados, spaced evenly
   ✓ Max 4-5 logos per slide (readability)

5. REGISTRA EN overlay-copy.json:
```

```json
"slide-02": {
  "logoZone": {
    "y": 0.87,
    "h": 0.13,
    "logos": [
      {
        "slug": "instagram",
        "name": "Instagram",
        "verified": true,
        "url": "/api/simple-icons?slug=instagram&color=FFFFFF"
      },
      {
        "slug": "meta",
        "name": "Meta",
        "verified": true,
        "url": "/api/simple-icons?slug=meta&color=FFFFFF"
      }
    ],
    "backgroundColor": "#0A0A0A",
    "backgroundOpacity": 0.88
  }
}
```

**Validación:**

```
□ ¿Logos existen en SimpleIcons? (verificar con GET)
□ ¿Sin typos en slugs?
□ ¿Max 5 logos por slide?
□ ¿Franja visible sin solapar imagen principal?
□ ¿Color logos legible sobre fondo oscuro?
```

**Si badge NO existe en SimpleIcons:**

```
→ Log warning: "Badge 'xyz' not in SimpleIcons, using text fallback"
→ Crear badge tipográfico: texto + rounded corner + border
→ Notify user: "xyz logo no está disponible, usé fallback tipográfico.
              ¿Querés que suba un logo custom para xyz?"
```

---

### 📐 FASE 4: LAYOUT ANALYSIS & SAFE ZONES (2-3 minutos)

**Sub-agente:** `content-forge-layout-architect`

**Para CADA PNG generado:**

```
1. ANALIZA IMAGEN CON GEMINI VISION:
   ✓ Detecta: rostro/sujeto (bounding box)
   ✓ Espacios vacíos (donde se puede poner texto)
   ✓ Luminancia por cuadrante (determina color de texto)
   ✓ Identificar elementos principales
   ✓ Detectar profundidad (shallow DoF = persona clara)

2. DETERMINA SAFE ZONES:
   Si luminancia cuadrante bottom > 150 (claro):
     → colorScheme = "light"
     → textColor = "#1A1A1A" (dark text)
   Si luminancia < 150 (oscuro):
     → colorScheme = "dark"
     → textColor = "#FFFFFF" (light text)

3. PROPONE SCRIM CINEMATOGRÁFICO:
   Scrim = overlayer gradiente que mejora legibilidad de texto
   Parámetros:
   - position: "bottom" (donde va el texto usualmente)
   - height: 0.36-0.50 (ajusta según imagen)
   - opacity: 0.75-0.95 (más oscuro = más opacidad)
   - blur: 12-24px (suaviza los bordes)
   - color: "#000000"
   - gradientStops: 4 (opacity 0 → 0.88 de arriba a abajo)

4. PROPONE POSICIÓN DE TEXTO:
   Opción A: Bottom (default)
   Opción B: Top (si bottom tiene sujeto)
   Opción C: Center (si imagen muy contrastada)

5. DETECTA LOGO POSITION:
   Logo siempre bottom-right SALVO que:
   - Hay rostro en corner → top-right
   - Hay objeto importante bottom-right → top-right / bottom-left

6. GENERA layout-plan.json:
```

```json
"slide-01": {
  "recommendedPosition": "bottom",
  "textColor": "#FFFFFF",
  "scrim": {
    "position": "bottom",
    "height": 0.46,
    "opacity": 0.88,
    "color": "#000000",
    "blur": 12,
    "gradientStops": [
      { "offset": 0, "opacity": 0 },
      { "offset": 0.4, "opacity": 0.5 },
      { "offset": 0.85, "opacity": 0.88 },
      { "offset": 1, "opacity": 0.88 }
    ]
  },
  "textShadow": {
    "blur": 9,
    "offsetY": 2,
    "opacity": 0.72,
    "color": "#000000"
  },
  "logo": {
    "position": "bottom-right",
    "maxWidth": 0.08,
    "margin": { "right": 0.08, "bottom": 0.15 }
  },
  "safeMargins": {
    "top": 0.07,
    "right": 0.08,
    "bottom": 0.15,
    "left": 0.08
  },
  "colorScheme": "dark",
  "headlineToken": "display-sm",
  "bodyToken": "body"
}
```

**Validación:**

```
□ ¿Safe zones son REALES (visión) no heurísticas?
□ ¿Logo no tapa rostro ni elementos principales?
□ ¿Margen bottom ≥13% si hay logoZone?
□ ¿textColor tiene contraste WCAG AA mínimo (4.5:1)?
□ ¿Scrim suave, no duro?
```

---

### ✍️ FASE 5: OVERLAY COPY — EDITABLE & COMPOSABLE (4-5 minutos)

**Sub-agente:** `content-forge-copy-overlay`

**Genera overlay-copy.json que es 100% editable en el editor (sin regenerar imagen):**

```json
"slide-01": {
  "overlay": {
    "headline": "3 ERRORES QUE CIERRAN TUS VENTAS",
    "body": "Hoy te muestro los 3 errores que más clientes me reportan.",
    "eyebrow": "ERROR #1",
    "signature": "@infiny",
    "colorScheme": "dark",
    "showLogo": true,
    "elements": [
      {
        "id": "chip-1",
        "type": "chip",
        "text": "ROI +300%",
        "position": { "x": 0.08, "y": 0.12 },
        "style": "border-pill",
        "borderColor": "#D4AF37",
        "bgColor": "transparent",
        "textColor": "#D4AF37"
      },
      {
        "id": "divider-1",
        "type": "divider",
        "position": { "x": 0.0, "y": 0.42 },
        "width": 1.0,
        "height": 0.001,
        "color": "#D4AF37",
        "opacity": 0.3
      },
      {
        "id": "text-custom",
        "type": "text",
        "text": "Sin shortcuts",
        "position": { "x": 0.08, "y": 0.38 },
        "fontSize": 0.024,
        "color": "#B0B0B0",
        "fontWeight": 400
      }
    ]
  },
  "bg": {
    "style": "dark-shaft",
    "base": "#110e09",
    "accent": "#D4AF37",
    "intensity": 0.65
  },
  "logoZone": {
    "y": 0.87,
    "h": 0.13,
    "logos": [...]
  }
}
```

**Validaciones:**

```
□ Headline ≤8 palabras (si más, reducir token)
□ Body ≤40 caracteres por línea (readability)
□ Español LATAM puro (no anglicismos)
□ Signature = brand.handle (nunca hardcodeado)
□ Eyebrow: SIN tipo "SLIDE 1 DE 10" (prohibido)
□ colorScheme respeta darkMode/lightMode de layout-plan
□ elements[] no solapan safeMargins
□ Colors en palette.* o #HEX válido
□ Sin contraseñas, sensibleData expuesta
```

**Copy guidelines por pilar:**

```
EDUCATIVO:
  - Headline: comando o pregunta ("3 ERRORES..." vs "Quiero aprender")
  - Body: explica brevemente sin tecnicismos
  - Tone: friendly pero authoritative

BTS:
  - Headline: situación o problema ("UN DÍA EN MI OFICINA")
  - Body: storytelling, emoción
  - Tone: intimate, authentic

CASOS:
  - Headline: resultado numérico ("PASÓ DE $0 A $5K/MES")
  - Body: antes-después, métrica concreta
  - Tone: aspirational, proof-focused

DEBATE:
  - Headline: reframe provocador ("TODOS ESTÁN EQUIVOCADOS")
  - Body: contrarian viewpoint, well-reasoned
  - Tone: confident, challenging

ESTRATÉGICO:
  - Headline: principio ("LA VERDAD SOBRE SCALE")
  - Body: framework, lógica
  - Tone: thoughtful, leader-like
```

**Crítico:** TODO debe ser editable en el editor sin regenerar imagen.

---

### 🎬 FASE 6: COMPOSE OVERLAY — RENDERIZADO FINAL (3-4 minutos)

**Script:** `compose-overlay.mjs`

**Lee: overlay-copy.json + layout-plan.json + PNG base**

**Renderiza en capas (SVG embebido en PNG):**

```
[CAPA 0] PNG base (1024×1280)
    ↓
[CAPA 1] Scrim cinematográfico
         → Gradiente #000000, 4 stops, opacidad variable
         → Cubre 46% inferior (ajustable per slide)
    ↓
[CAPA 2] Custom elements[]
         → chips (label + border pill)
         → dividers (línea horizontal decorativa)
         → text-custom (texto posicionado libremente)
         → accent-bars (línea decorativa con color brand)
    ↓
[CAPA 3] Tipografía semántica
         → eyebrow (label, 2.4% scale, uppercase, brand.colors.dark)
         → headline (display/display-sm/display-xs según wordcount)
         → body (body token, 3.18% scale, leading 1.5)
    ↓
[CAPA 4] Signature @handle
         → Accent bar decorativa encima
         → Color: brand.colors.dark (dorado)
         → Font: Inter 600, 2.4% scale
    ↓
[CAPA 5] Micro-copy (optional)
         → Texto pequeño de soporte
         → Font: Inter 500, 1.9% scale, tracking wide
    ↓
[POST] applyLogo()
       → PNG logo desde brand-assets/logo-dark.png o logo-light.png
       → Posición: layout-plan.logo.position
       → Maxwidth: layout-plan.logo.maxWidth
    ↓
[POST] applyLogoZone()
       → Renderiza badges SimpleIcons de logoZone
       → Franja 13% inferior, logos 52×52px, spaced evenly
    ↓
Output: slide-01-final.png (1080×1350, Instagram native)
```

**Parámetros:**

| Parámetro | Default | Rango | Notas |
|-----------|---------|-------|-------|
| scrim.opacity | 0.88 | 0.6-1.0 | Más opaco = más legible |
| text shadow.blur | 9 | 3-15 | Sombra suavidad |
| headline.token | display-sm | display, display-sm, display-xs | Per wordcount |
| margin.sides | 8% | 6%-10% | Espacio lateral |
| margin.bottom | 15% | 13%-20% | Más si hay logoZone |

**Validación post-render:**

```
□ PNG final 1080×1350 píxeles exacto
□ Texto legible en resolución final
□ Logo no pixelado, bien antialiased
□ Badges presentes en franja inferior
□ Colores preciso (no drift)
□ Sin artifacts de composición
□ FileSize < 500KB (para Instagram)
```

---

### 🔍 FASE 7: QA AUTOMÁTICO (3-4 minutos)

**Sub-agentes:**
- `content-forge-visual-qa` → Valida visuales
- `content-forge-text-validator` → Valida texto

**Checks de visual-qa:**

```
✓ Imagen respeta paleta brand.config.colors (Δcolor ≤ 5%)
✓ Personaje consistente con character.md (si aparece)
✓ Logos presentes en SimpleIcons y correctos
✓ Texto no solapado con elementos principales
✓ Overlay copy visible y legible
✓ Sin elementos espurios (artifacts, glitches)
✓ Composición sigue rule of thirds / balance visual

Output: qa-report.json
{
  "slide-01": {
    "pass": true,
    "score": 0.98,
    "issues": [],
    "warnings": []
  },
  "slide-03": {
    "pass": false,
    "score": 0.82,
    "issues": [
      "Solapamiento: texto sobre rostro en área 0.35-0.45"
    ],
    "warnings": [
      "Logo muy pequeño, considerar aumentar"
    ]
  }
}
```

**Checks de text-validator:**

```
1. Gemini Vision extrae TODO el texto visible en PNG
2. Compara con overlay-copy.json (fuzzy similarity)
3. Detecta: typos, palabras duplicadas, letras faltantes, 
           texto espurio, cortes incompletos

Output: text-qa-report.json
{
  "slide-01": {
    "extracted": "3 ERRORES QUE CIERRAN TUS VENTAS",
    "expected": "3 ERRORES QUE CIERRAN TUS VENTAS",
    "similarity": 1.0,
    "pass": true
  },
  "slide-02": {
    "extracted": "ERROR #1: COPY GENÉRCO",
    "expected": "ERROR #1: COPY GENÉRICO",
    "similarity": 0.97,
    "pass": false,
    "issues": ["typo: GENÉRCO → GENÉRICO"]
  }
}
```

**Decision logic:**

```
IF visual-qa.pass == false OR text-validator.pass == false:
  → Regenera SOLO ese slide (no todo carrusel)
  → Max 2 reintentos por slide
  → Si sigue fallando después 2 reintentos:
    → Log issue en memory.json.failurePatterns
    → Pregunta al usuario: "Slide X no pasó QA. 
                          ¿Regenero con otro concept?"

IF visual-qa.pass AND text-validator.pass:
  → Procede a FASE 8
```

---

### 📝 FASE 8: CAPTIONS & CONTENT (3-4 minutos)

**Sub-agente:** `content-forge-caption-writer`

**Inputs:**
- Brief completo
- Research del `content-forge-researcher` (si hay datos)
- brand.voice (tone, style)
- brand.leadMagnet (para CTA)

**Output: caption.md**

```markdown
# Caption Instagram

[HOOK PARAGRAPH]
Párrafo 1: retoma el headline del slide-01.
Emocional, grabador, máx 2-3 líneas.
Ej: "La verdad es que los 3 errores más comunes al vender en Instagram 
no son técnicos. Son psicológicos."

[VALUE PARAGRAPHS]
Párrafos 2-3: argumentos principales del carrusel.
Mantén tono conversacional.
Incluye 1 dato verificable si aplica.

[PROOF / EJEMPLO]
Párrafo 4: caso real o resultado concreto.
Ej: "Uno de mis clientes pasó de $0 a $5K/mes cuando...

[CTA]
Párrafo 5: claro, accionable, en tono de marca.
NO "haz clic aquí" genérico.
SÍ "Dale, te dejo el proceso completo en la bio"

[HASHTAGS]
#branded #branded #branded #branded #branded
#mid #mid #mid #mid #mid #mid #mid #mid #mid #mid
#broad #broad #broad #broad #broad

@infiny
```

**Estructura exacta:**

```
Total: ≤1800 characters (límite IG)
Párrafos: 1-2 líneas de separación entre bloques
Hashtags: 5 nicho + 10 medio + 5 amplio = 20 total
Handle: brand.handle exacto (sin duplicar)
Idioma: Español LATAM (no anglicismos sin traducir)
```

**Validaciones:**

```
□ ≤1800 chars exacto
□ Handle es brand.handle? (sin typos)
□ Hashtags totales = 20? (5+10+5)
□ Coherencia con copy de slides
□ Tono alineado con brand.voice.style
□ CTA claro y accionable
□ Sin promoción agresiva de otros productos
```

---

### 📅 FASE 9: CALENDARIO & MEMORY (2 minutos)

**Sub-agente:** `content-forge-calendar-publisher`

**Acción 1: Agenda contenido**

```
1. Calcula fecha óptima:
   - Lee brand.cadence.preferredDays (ej: ["Tuesday", "Thursday"])
   - Lee brand.cadence.preferredHour (ej: "18:30")
   - Lee brand.timezone (ej: "America/Bogota")
   - Propone próxima fecha dentro de esos parámetros

2. Crea entrada calendario:
   output/calendar/2026-05/20260507-tema-slug.md
```

```markdown
# 🎯 Carrusel: Los 3 errores al vender en Instagram

**Fecha publicación:** Martes 7 mayo, 2026 · 18:30 COT
**Plataforma:** Instagram Carousel
**Pilar:** Educativo
**Tipo contenido:** 10 slides + caption

## Assets
- Slides: output/social/20260507-errors-sales/slide-*.png
- Caption: [preview aquí]
- Thumbnail: slide-01-final.png

## Performance target
- Reach: 5k+ (históricamente educativo = 80% reach)
- Saves: 150+ (objetivo: 3% save rate)
- Shares: 20+ (objetivo: 0.4% share rate)

## Notas
- Publicado: [timestamp]
- Editado: [timestamp]
- Status: Scheduled
```

**Acción 2: Guarda en memory.json (CRÍTICO)**

```json
{
  "carouselHistory": [
    {
      "id": "20260507-errors-sales",
      "date": "2026-05-07T18:30:00Z",
      "topic": "Los 3 errores al vender en Instagram",
      "platform": "ig-carousel",
      "pilar": "educativo",
      "briefPath": "drafts/brief-20260507.json",
      "outputDir": "output/social/20260507-errors-sales/",
      "captionPath": "output/social/20260507-errors-sales/caption.md",
      "calendarPath": "output/calendar/2026-05/20260507-errors-sales.md",
      
      "brandSnapshot": {
        "palette": {
          "primary": "#0A0A0A",
          "dark": "#D4AF37",
          "light": "#F5F0EB"
        },
        "voice": "friendly-expert, paisa tranquilo",
        "character": {
          "enabled": true,
          "name": "Alexander",
          "consistency_score": 0.96
        }
      },
      
      "performance": {
        "generatedAt": "2026-05-07T14:30:00Z",
        "slides": 10,
        "badges": ["instagram", "meta"],
        "renderTime": 342,
        "totalTokensUsed": 45000,
        "status": "published",
        "publishedAt": "2026-05-07T18:30:00Z"
      },
      
      "metadata": {
        "briefQA": { "pass": true, "score": 0.99 },
        "visualQA": { "pass": true, "score": 0.98 },
        "textQA": { "pass": true, "score": 1.0 },
        "regenerations": 0
      }
    }
  ],
  
  "successPatterns": [
    {
      "id": "hook-5-errores",
      "description": "Los X errores más comunes en Y",
      "structure": "error + fix + error + fix + ... + conclusión",
      "timesUsed": 3,
      "avgEngagement": 12500,
      "avgReach": 5800,
      "notes": "Funciona bien cuando incluyes data verificable + ejemplo real"
    }
  ],
  
  "failurePatterns": [
    {
      "id": "generico-sin-datos",
      "description": "Carruseles teóricos sin caso real",
      "timesAttempted": 1,
      "whyFailed": "Audiencia LATAM prefiere ejemplos concretos",
      "lesson": "Siempre agregar 1 caso real o dato específico"
    }
  ],
  
  "lineamientos": {
    "versionControl": "2.0",
    "lastUpdated": "2026-05-07",
    "brandGuidelines": {
      "palette": [...],
      "voice": [...],
      "characterConsistency": 0.96,
      "preferredPilars": ["educativo", "casos"],
      "forbiddenPatterns": ["generico sin datos", "copy stock"]
    },
    "stylePreferences": {
      "scrimOpacity": 0.88,
      "logoPosition": "bottom-right",
      "headlineMaxWords": 8,
      "characterAppearance": "siempre de frente, gestos explicativos"
    }
  }
}
```

**Learning loop (automático):**

```
1. Semana 1: 3 carruseles generados → memory.json tiene 3 entries
2. Semana 2: Analytics webhook trae engagement data
3. Script weekly analiza:
   - Qué pilares performaron mejor (engagement/reach)
   - Qué estructuras fueron más saved
   - Qué brands/logos generaron más interés
4. brief-architect lee memory.json → sugiere pilares de mejor ROI
5. Próximos carruseles refuerzan patterns ganadores
```

---

## 🔗 FLUJO ESPECIAL: CUANDO USER ENVÍA LINK EXTERNO

**User:** "Replica este carrusel pero con mi marca: https://instagram.com/p/xyz/"

**Automático:**

```
FASE 0:
  1. Valida que sea URL válida (Instagram/LinkedIn/TikTok)
  2. Ejecuta clone-from-url.mjs
  3. Descarga slides (imágenes) + metadata

FASE 1 (MODIFICADA):
  1. Sub-agente `content-forge-clone-analyzer` lee imágenes
  2. Gemini Vision analiza: layout, paleta, ratio texto/imagen, 
     narrativa, estructura, mood
  3. Reinterpreta en TU voz:
     ✓ Mantiene arquitectura slides (# slides, narrativa beat)
     ✓ NO copia copy verbatim (reescribe 100%)
     ✓ Adapta ejemplos a TU industria
     ✓ Usa TU paleta exacta
     ✓ Incluye TUS logos/badges
     ✓ Respeta TU voz (friendly-expert, educativo, etc)
  4. Genera brief.json nuevo basado en estructura clonada

FASE 2-9:
  → Pipeline normal, pero con brief basado en estructura ajena
  → Output es "mismo formato, contenido tuyo, paleta tuya"
```

**Ejemplo:**

```
Original: Carrusel "5 errores al hacer content" por @otro_creador

Clonado con TU marca:
- Misma estructura: 10 slides, cada uno 1 error + fix
- Copy NUEVO en TU voz (friendly-expert paisa)
- Ejemplos de TU industria (marketing digital LATAM, no genérico)
- Paleta #0A0A0A + #D4AF37 + #F5F0EB (TU brand)
- Logo TU marca en slides
- Badges TUS herramientas (n8n, supabase, etc.)
- Caption en TU estilo

Resultado: Un carrusel que estructura-wise es similar, pero es 100% tuyo.
```

---

## 📚 MEMORY.JSON — EL CORAZÓN DEL SISTEMA

**Ubicación:** `/content-forge/memory.json` (raíz del proyecto)

**Propósito:** Content Forge NUNCA olvida. Cada carrusel informa al siguiente.

**Lectura automática en cada FASE:**

```
FASE 1 (Brief):
  ✓ Lee successPatterns → sugiere estructuras ganadas
  ✓ Lee failurePatterns → evita errores probados
  ✓ Lee carouselHistory → detecta trends

FASE 2-9:
  ✓ Valida visual contra brandSnapshot históricas
  ✓ Calibra copy según voice preferences guardadas
  ✓ Aplica stylePreferences (scrim opacity, logo pos, etc)
```

**Actualización automática:**

```
Después de cada carrusel:
  1. Registra en carouselHistory (id, fecha, pilar, performance)
  2. Si nuevo success pattern emerja → agrega a successPatterns
  3. Si nuevo failure observado → agrega a failurePatterns
  4. Actualiza lineamientos si hay cambios (nuevos forbiddenPatterns, etc)
  5. Incrementa contador: "ya hicimos X carruseles educativos, 
                           avg engagement Y"
```

---

## 🎨 DESIGN SYSTEM EMBEBIDO

### Tipografía

**Fuentes:**
- Display: Anton (headlines)
- Body: Inter (body, captions, ui)
- Monospace: JetBrains Mono (code, si aplica)

**Tokens tipográficos (% canvas width):**

| Token | % | Font | Weight | Uso | Max palabras |
|-------|---|------|--------|-----|--------------|
| display | 9.8% | Anton | 400 | Headlines cortos | ≤3 |
| display-sm | 8.2% | Anton | 400 | Headlines medio | 4-5 |
| display-xs | 6.8% | Anton | 400 | Headlines largo | 6-8 |
| heading | 5.5% | Inter | 700 | Subtítulos | — |
| subheading | 4.2% | Inter | 600 | Sub-subtítulos | — |
| label | 2.4% | Inter | 700 | Eyebrows, chips | — |
| body | 3.18% | Inter | 400 | Párrafos | — |
| caption | 2.4% | Inter | 500 | Notas | — |
| micro | 1.9% | Inter | 500 | Meta-info | — |
| signature | 2.4% | Inter | 600 | @handle | — |

### Colores

**Dinámicos por brand.config:**

```
Textos light (sobre fondos oscuros):
  → brand.colors.white (#FFFFFF o lo que configures)

Textos dark (sobre fondos claros):
  → brand.colors.grayDark (ej #333333)

Accent (dorado, colores secundarios):
  → brand.colors.dark (ej #D4AF37)

Scrim (cinematográfico):
  → #000000 fixed, variable opacity 0.6-0.95
```

### Layout

**Márgenes estándar:**
- Top: 7% canvas
- Right: 8% canvas
- Bottom: 15% canvas (13% + 2% buffer si logoZone)
- Left: 8% canvas

**Safe zones:**
- Evita superponer:
  - Rostro si personaje aparece
  - Elementos principales (productos, objetos focales)
  - Logo de marca (siempre bottom-right ≥8% margin)

---

## ⚡ FLUJO MÍNIMO USUARIO (5-10 minutos totales)

```
User: "Hazme un carrusel educativo de 10 slides 
       sobre los 3 errores al vender en Instagram"

[Claude Code carga brand + memory]

FASE 0-1: Brief architect genera 10 slides
          → Muestra brief al user para aprobación
          → "¿Aprobás este brief?"

User:     "Cambía slide 3, está muy genérico"

FASE 1:   Re-genera solo slide 3
          → "Listo, procedo a generar imágenes"

FASE 2-9: [Automático, status bar visible]
          ✓ Genera 10 imágenes (2 min)
          ✓ Detecta badges: Instagram, Meta (30 seg)
          ✓ Layout analysis (1 min)
          ✓ Overlay copy + composición (2 min)
          ✓ QA visual + texto (1 min)
          ✓ Caption (30 seg)
          ✓ Agenda calendario (30 seg)
          ✓ Guarda en memory.json (10 seg)

[5-10 minutos después]

Output: output/social/YYYYMMDD-slug/
  ✓ slide-01-final.png
  ✓ slide-02-final.png
  ✓ ... slide-10-final.png
  ✓ caption.md (listo para copiar-pegar)
  ✓ calendar entry
  ✓ metadata en memory.json

[User abre editor opcional]
localhost:4321 → puede editar:
  - Textos (headline, body, signature)
  - Posición logos
  - Colores fondos
  - Custom elements (chips, dividers)
  → Compose → descarga PNGs finales

[User publica]
- Copia caption a Instagram
- Sube 10 PNGs (IG carrusel nativo)
- Marca como "scheduled" si corresponde
```

---

## ✅ CHECKLIST ANTES DE PUBLICAR

```
VISUALES:
✓ Imágenes respetan paleta brand.config.colors exacto (±5%)
✓ Personaje consistente con character.md si aparece
✓ Logos de plataformas presentes + verificados en SimpleIcons
✓ Texto sin solapamiento con elementos principales
✓ Safe zones respetadas (no invaden rostros, objetos)
✓ SIN artifacts IA, SIN calidad baja, SIN distorsiones
✓ Iluminación y grading premium, cinematográfico

COPY:
✓ Headline ≤8 palabras, español LATAM puro
✓ Body claro, sin jerga, sin tecnicismos innecesarios
✓ Eyebrow NO es "SLIDE X DE Y" (prohibido)
✓ Signature es exactamente brand.handle
✓ Sin forbiddenPhrases del config

CAPTION:
✓ Hook grabador (retoma headline slide-01)
✓ Desarrollo con 1 dato verificable
✓ CTA claro y accionable
✓ Hashtags: 5 nicho + 10 medio + 5 amplio (20 total)
✓ ≤1800 caracteres exacto
✓ Tono alineado con brand.voice

CALENDARIO & METADATA:
✓ Entrada calendario creada
✓ Fecha publicación dentro de preferredDays + preferredHour
✓ memory.json actualizado con carouselHistory entry
✓ successPatterns / failurePatterns registrados

EDITOR (si editaste):
✓ Compose ejecutado ✓ PNGs finales descargados
✓ Colores, logos, overlay text validados visualmente
```

---

## 🚀 COMANDOS PARA CLAUDE CODE

**Uso normal:**

```
User: "Hazme un carrusel educativo sobre [tema]"
→ Pipeline automático 9 fases

User: "Replica este carrusel: [link]"
→ Clone + reinterpretación con TU marca

User: "Edita el texto del slide 3"
→ Abre editor: localhost:4321
→ Busca slide-03, edita overlay-copy.json
→ Compose (sin regenerar imagen)

User: "Quiero ver el brief antes de generar"
→ show brief, aprueba/ajusta, procede
```

**Avanzado:**

```
User: "Usa solo estas 2 plataformas: [n8n, supabase]"
→ Override automático de badges detectados

User: "Regenera la imagen del slide 5"
→ Mantiene overlay-copy.json igual
→ Solo regenera PNG de slide-5

User: "Muestrame memory.json"
→ Lee archivo + muestra successPatterns + failurePatterns

User: "Cambia el estilo de fondo a 'light-wall'"
→ Actualiza bg.style en overlay-copy.json
→ Re-compose sin regenerar imagen
```

---

## 📊 MÉTRICAS EN MEMORY.JSON

Cada carrusel deja un rastro:

```json
"metrics": {
  "totalCarousels": 3,
  "byPilar": {
    "educativo": 2,
    "casos": 1
  },
  "avgGenerationTime": 384,
  "totalTokensUsed": 135000,
  "characterConsistencyAvg": 0.96,
  "qualityScoreAvg": 0.97
}
```

Esto alimenta:
- "¿Qué pilar genera más engagement?" → brief-architect lo sabe
- "¿Cuánto tarda normalmente?" → user expectations
- "¿Qué costo tengo?" → tracking de usage

---

## 🎯 RESUMEN DE MEJORAS IMPLEMENTADAS

### ✅ Alineación de marca 100%
- Paleta exacta en cada prompt IA (hex codes)
- Validación visual per-imagen (Gemini Vision)
- Memory system acumula lineamientos

### ✅ Textos 100% editables sin regenerar
- overlay-copy.json separado de imagen
- Editor localhost:4321 permite editar todo
- Compose re-renderiza sin tocar PNG base

### ✅ Logos automáticos de plataformas
- Detección desde visualPrompt (n8n, supabase, etc.)
- Validación SimpleIcons (sin alucinaciones)
- Franja 13% inferior embebida, editable

### ✅ Replicación de referencias externas
- clone-from-url descarga slides ajenos
- clone-analyzer reinterpreta en TU voz
- Mantiene estructura, cambia 100% contenido

### ✅ Memory system que nunca olvida
- memory.json persiste lineamientos
- Cada carrusel aprende del anterior
- Success/failure patterns automáticos
- Learning loop semanal

---

**Fin del Master Prompt v2.0**

**Próximo paso:** Copia este prompt a `.claude/system-prompt.md` en el repo de Content Forge.