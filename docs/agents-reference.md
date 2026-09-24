# Agentes Claude — Reference

Content Forge incluye 10 agentes Claude Sonnet 4.6 especializados. Cada uno vive en `.claude/agents/` como un archivo Markdown con frontmatter YAML. Se invocan desde Claude Code con `/agent:nombre` o mediante el skill `content-forge`.

---

## Mapa de agentes por fase del workflow

```
FASE 1 — Research & Brief
  content-forge-researcher          → datos verificados + fuentes
  content-forge-brief-architect     → brief JSON estructurado

FASE 2 — Dirección visual
  content-forge-character-director  → decisiones de personaje por slide
  content-forge-layout-architect    → layout-plan.json (análisis de imagen real)

FASE 3 — Copy
  content-forge-copy-overlay        → headlines, body, eyebrows

FASE 4 — QA
  content-forge-visual-qa           → valida PNGs contra brand.config.json
  content-forge-text-validator      → verifica texto renderizado vs brief

FASE 5 — Publicación
  content-forge-caption-writer      → caption final IG/LinkedIn
  content-forge-calendar-publisher  → entry en calendario editorial

ESPECIALES
  content-forge-clone-analyzer      → reinterpreta carrusel viral ajeno
```

---

## Fichas de cada agente

### content-forge-brief-architect

**Propósito:** Convierte un topic en lenguaje natural en un brief JSON estructurado completo.

**Inputs:**
- Topic libre (ej: "5 errores al usar ChatGPT en marketing")
- `brand.config.json` (voz, paleta, handle, cadencia)

**Outputs:** Brief JSON con:
```json
{
  "pilar": "TOFU | MOFU | BOFU",
  "hook": "Primera línea de atención",
  "firma": "@handle",
  "sceneSeed": "Descripción visual compartida entre slides",
  "slides": [
    {
      "id": "slide-01",
      "narrativeBeat": "Hook",
      "headline": "...",
      "body": "...",
      "visualPrompt": "Prompt específico para este slide"
    }
    // ... hasta 10 slides
  ]
}
```

**Cuándo invocarlo:** Siempre antes de generar imágenes. Es el punto de entrada del workflow completo.

**Invoca automáticamente:** `content-forge-researcher` si el topic requiere datos verificables.

---

### content-forge-researcher

**Propósito:** Investigación factual previa al brief. Realiza 3-6 búsquedas web reales.

**Inputs:** Topic o área temática

**Outputs:** `research-notes.md` con:
- Estadísticas con fuentes citadas
- Quotes de referentes del sector
- Casos reales de marcas
- Fechas y datos verificados
- Marcas/herramientas relevantes (alimenta logo detection)

**Cuándo invocarlo:** Automáticamente desde brief-architect cuando el topic tiene datos factuales. También manualmente para investigación previa.

**Tools disponibles:** WebSearch, WebFetch, Read, Write, Grep

---

### content-forge-layout-architect

**Propósito:** Análisis de imagen real → decisiones de layout precisas.

**Inputs:** PNGs generados (acceso de lectura)

**Outputs:** `layout-plan.json` con decisiones per-slide:
```json
{
  "slide-01": {
    "recommendedPosition": "bottom | top | center",
    "textColor": "#FFFFFF | #1A1A1A",
    "scrim": { "position": "bottom", "height": 0.46 },
    "textShadow": { "blur": 9, "offsetY": 2, "opacity": 0.72 },
    "textGlow": null,
    "logo": { "position": "bottom-right" },
    "colorScheme": "dark | light",
    "sizes": { "headline": 1.0, "body": 0.9 }
  }
}
```

**Análisis que realiza:**
- Luminancia promedio por cuadrante → determina posición del texto
- Saturación → decide si necesita scrim más opaco
- Detección de sujeto → donde está el personaje/objeto principal
- Espacios negativos → zonas libres para texto

**Crítico:** Este agente lee CADA PNG real antes de decidir. No usa heurísticas fijas.

---

### content-forge-character-director

**Propósito:** Decide per-slide si el personaje debe aparecer y cómo.

**Inputs:** Brief JSON, fotos en `brand-assets/character/`

**Outputs:** Anotaciones al brief:
```json
{
  "slide-03": {
    "showCharacter": true,
    "refs": ["foto-sonriendo.jpg", "foto-hablando.jpg"],
    "poseHint": "De frente, gesto explicativo con mano derecha",
    "expression": "Energético y directo"
  }
}
```

**Criterios de decisión:**
- Slides de hook/CTA → personaje presente
- Slides de datos/listas → solo tipografía (personaje ausente)
- Slides de cierre → personaje siempre

---

### content-forge-copy-overlay

**Propósito:** Redacta el copy final de cada slide respetando voz y safe zones.

**Inputs:** Brief JSON, `brand.config.json` (voice), `layout-plan.json` (safe zones)

**Outputs:** Overlay copy por slide:
```json
{
  "headline": "TUS HERRAMIENTAS TRABAJAN. TÚ COBRAS.",
  "body": "Así funciona cuando automatizas bien.",
  "eyebrow": "AUTOMATIZACIÓN",
  "signature": "@infiny"
}
```

**Reglas que respeta:**
- Claridad nivel niño de 10 años (sin jerga)
- Español LATAM puro (sin anglicismos sin traducir)
- Handle único: `brand.handle` del config (nunca hardcodeado)
- Longitud de headline calibrada al token tipográfico del layout-plan
- Sin eyebrows tipo "SLIDE 3 DE 8" (prohibido por feedback)

---

### content-forge-visual-qa

**Propósito:** Valida que los PNGs finales cumplan las reglas de marca.

**Inputs:** PNGs en `output/social/`, `brand.config.json`

**Outputs:** `qa-report.json`:
```json
{
  "slide-01": {
    "pass": true,
    "issues": []
  },
  "slide-03": {
    "pass": false,
    "issues": [
      "Texto solapado con logo",
      "Drift de personaje detectado (rasgos caucásicos, ref es latinoamericano)"
    ]
  }
}
```

**Qué verifica:**
- Texto espurio o ilegible
- Concepto visual fallido (no refleja el brief)
- Colores fuera de paleta del brand
- Consistencia facial con refs del personaje
- Logo de marca correcto y posicionado
- Overlays no solapan rostros ni logos

---

### content-forge-text-validator

**Propósito:** Verificación carácter-a-carácter de texto renderizado en PNGs.

**Inputs:** PNGs finales, `overlay-copy.json` (texto esperado)

**Proceso:**
1. Gemini Vision extrae TODO el texto visible en el PNG
2. Compara con el texto del brief (fuzzy similarity)
3. Detecta: typos, palabras duplicadas, letras faltantes, texto espurio

**Outputs:** `text-qa-report.json` con similarity score por slide. Slides con score < 0.95 se marcan para re-generación.

**Cuándo es crítico:** Después de compose-overlay en slides con mucho texto, y siempre antes de publicar.

---

### content-forge-caption-writer

**Propósito:** Genera el caption final listo para copy-paste.

**Inputs:** Brief, voz del brand.config, investigación de researcher

**Outputs:** `caption.md` con:
- Primer párrafo: hook (retoma el headline del slide-01)
- Desarrollo: valor real del carrusel
- CTA: claro y accionable
- Hashtags: 5 branded + 10 temáticos + 5 de nicho (≤ 30 total)
- Handle único: solo `brand.handle`
- Máximo: 1800 caracteres (límite Instagram)
- Idioma: Español LATAM (sin anglicismos)

---

### content-forge-calendar-publisher

**Propósito:** Agenda el carrusel en el calendario editorial.

**Inputs:** Carrusel completado, `brand.config.cadence` (frecuencia preferida)

**Outputs:** `output/calendar/YYYY-MM/YYYYMMDD-slug.md` con:
- Fecha/hora óptima según cadencia y timezone del brand
- Links a assets finales
- Caption preview
- Notas de publicación

**Criterios para la hora:**
- Instagram: martes-jueves 18:00-20:00 (hora local brand)
- LinkedIn: martes-miércoles 08:00-10:00
- TikTok: lunes-viernes 19:00-21:00

---

### content-forge-clone-analyzer

**Propósito:** Reinterpreta la estructura de un carrusel viral ajeno con tu marca.

**Inputs:** Directorio `output/clones/<run>/` generado por `clone-from-url.mjs`

**Proceso:**
1. Claude Vision analiza cada slide del carrusel original
2. Identifica: layout, ratio texto/imagen, narrativa, paleta, mood
3. Reinterpreta en el idioma y tono del user
4. **NO copia texto verbatim** — recrea la estructura con contenido original

**Outputs:** Brief JSON listo para Pipeline A o B

---

## Cómo invocar agentes

### Desde Claude Code (terminal)

```bash
# Workflow completo con un topic
/content-forge crear un carrusel sobre automatización con n8n

# Investigar primero
/content-forge-researcher automatización de ventas en LATAM 2025

# Solo generar brief
/content-forge-brief-architect 5 errores al delegar en equipos remotos

# Validar carrusel ya generado
/content-forge-visual-qa output/social/20260507-automatizacion/
```

### Parámetros de un agente (YAML frontmatter)

```yaml
---
name: content-forge-brief-architect
description: >
  Convierte un topic en lenguaje natural en brief JSON...
model: claude-sonnet-4-6
tools: [Read, Write, Grep, Glob]
---
```

---

## Guía de debugging de agentes

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| Brief con datos inventados | Researcher no se invocó | Agregar topic factual explícitamente |
| Texto solapado con logo | layout-plan.json sin safe zones | Re-correr layout-architect con PNG real |
| Drift de personaje | Refs de mala calidad o pocas refs | Añadir 2+ fotos de frente bien iluminadas |
| Caption > 1800 chars | Context largo | Indicar "máximo 1800 chars" en el prompt |
| Slide con eyebrow tipo "SLIDE X" | copy-overlay no tiene el feedback | Ver feedback_no_eyebrows_in_slides.md |
