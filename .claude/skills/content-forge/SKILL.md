---
name: content-forge
description: Pipeline editorial end-to-end para generar carruseles IG, reels, stories, posts LinkedIn, thumbnails YouTube y shorts. Combina Nanobanana (Gemini 2.5 Flash Image) + sub-agentes Claude + sharp/resvg. Personalizado a la marca del usuario vía brand.config.json. Si el user es marca personal, mantiene consistencia de rostro usando fotos de referencia. Activar siempre que el usuario pida crear una pieza de contenido para redes sociales.
model: claude-sonnet-4-6
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Bash
---

# Content Forge — Skill principal

Pipeline editorial en tu terminal + Claude Code. El mismo sistema que usa UGC Colombia en producción, liberado como regalo para la comunidad.

## Cuándo activarse

El usuario escribe algo como:
- *"hazme un carrusel sobre X"*
- *"necesito un reel para TikTok"*
- *"post de LinkedIn"*
- *"carrusel educativo de 10 slides"*
- *"una story con..."*

O menciona las palabras: carrusel · carousel · reel · tiktok · post · story · thumbnail · broadcast.

## Pre-check obligatorio

Antes de hacer cualquier cosa:

1. **Lee `brand.config.json`** en la raíz del proyecto.
   - Si NO existe → *"Necesitas correr `npm run setup` primero. Te pedirá ~10 datos de tu marca."*
   - Si existe → úsalo como fuente de verdad.

2. **Si el user menciona al personaje** y `character.enabled === false` → confirma si quiere activarlo (requiere fotos + setup).

3. **Si `content.hashtags` está vacío** en el config → avisa al final del caption que son genéricos.

## Workflow de 9 etapas

Cada etapa es un sub-agente o script. Orden estricto:

| # | Etapa | Quién ejecuta | Output |
|---|---|---|---|
| 0.5 | **Research** (solo si el topic requiere datos factuales) | sub-agente `content-forge-researcher` | `drafts/YYYYMMDD-<slug>-research.md` |
| 1 | Brief architect (con research opcional + sceneSeed + narrativa) | sub-agente `content-forge-brief-architect` | `drafts/YYYYMMDD-<slug>-brief.json` |
| 2 | Generate PNGs (gpt-image-2 + Gemini swap + refs compartidas) | `scripts/generate-social.mjs` | `slide-XX.png` + `manifest.json` |
| 2.5 | **Brand overlay** (Clearbit logos sobre slides con marcas) | `scripts/brand-overlay.mjs` | `slide-XX-branded.png` + `brand-overlay-manifest.json` |
| 3 | Visual QA | sub-agente `content-forge-visual-qa` | `qa-report.json` |
| 3.5 | Layout analysis (image-aware) | sub-agente `content-forge-layout-architect` | `layout-plan.json` |
| 4 | Copy overlay (consume dataPoints con cita de fuente) | sub-agente `content-forge-copy-overlay` | `overlay-copy.json` |
| 5 | Compose overlay + logo propio | `scripts/compose-overlay.mjs` | `slide-XX-final.png` |
| 6 | Caption writer (cita fuentes si aplica) | sub-agente `content-forge-caption-writer` | `caption.md` |
| 7 | Calendar publisher | sub-agente `content-forge-calendar-publisher` | `output/calendar/...` |

### Etapas condicionales

- **0.5 Research** corre solo si el topic tiene señales de data factual (cifras, marcas, comparativas, historia). brief-architect lo decide.
- **2.5 Brand overlay** corre solo si algún slide tiene `brandsReferenced[]` no vacío. Si todos los slides vienen sin marca externa, se salta.

Tú coordinas los agentes. El usuario da el topic inicial y confirma milestones clave.

## Comando maestro

```bash
npm run ship -- --topic="<tema>"
```

O granular:

```bash
npm run generate -- --concept=<slug> --platform=<x> --brief=drafts/...
# opciones del validador de texto:
#   --max-retries=2        (default 1; hasta 3)
#   --skip-validation=true (desactiva QA)
npm run brand-overlay -- --dir=output/social/<folder>
npm run compose -- --dir=output/social/<folder>
```

## Clone desde URL (viral reinterpretation)

Cuando el usuario pasa un link de un post/carrusel ajeno y pide "hazme lo mismo
con mi imagen":

```bash
npm run clone -- --url=https://www.instagram.com/p/XYZ/
# → descarga slides + caption a output/clones/<run>/source/
# → luego invoca al agente content-forge-clone-analyzer sobre ese directorio
# → produce drafts/<run>-brief.json con tu character + tu voz + tu handle
# → continúa con npm run generate → brand-overlay → compose normal
```

Requisitos: `APIFY_API_TOKEN` en `.env.local`. Si no lo tiene, el script falla
con instrucciones de cómo obtenerlo. El clone NUNCA copia texto literal —
reinterpreta con tu voz en tu idioma.

## Sub-agentes disponibles

Viven en `.claude/agents/`:

1. `content-forge-researcher` — investiga topics factuales con WebSearch y produce research-notes.md con datos citados (se invoca desde brief-architect cuando aplica)
2. `content-forge-brief-architect` — diseña briefs desde topic libre, invoca al researcher, genera sceneSeed + narrativa continua
3. `content-forge-character-director` — (opcional) refina casting del personaje por slide
4. `content-forge-visual-qa` — valida PNGs con Claude vision (mood, compliance de marca)
5. `content-forge-text-validator` — valida con Gemini Vision que el texto renderizado coincide con el brief carácter por carácter, detecta typos/drift, sugiere re-generación
6. `content-forge-layout-architect` — analiza imágenes y decide layout
7. `content-forge-copy-overlay` — redacta micro-copy de overlay + QA del texto integrado en imagen
8. `content-forge-caption-writer` — caption IG + hashtags
9. `content-forge-calendar-publisher` — agenda en calendario editorial
10. `content-forge-clone-analyzer` — analiza un carrusel ajeno descargado por `clone-from-url.mjs` y produce un brief con TU branding, character, voz y handle (nunca copia literal)

## Reglas duras (NO negociables)

### 1. Un solo handle público
El único `@` en contenido público es `brand.config.json.brand.handle`. **Nunca** handles personales diferentes.

### 2. Paleta del user exclusivamente
Solo colores de `brand.config.json.colors`. Si detectas un hex fuera de paleta en un prompt, corrígelo automáticamente.

### 3. Tipografía oficial
`brand.config.json.fonts` — default Anton (display) + Inter (sans). Si el user configuró otras, respeta.

### 4. Logo
Usa las variantes de `brand.config.json.logo` según el fondo (dark variant sobre oscuros/fotos, light variant sobre crema/claros).

### 5. Character consistency
Si `character.enabled === true`, respeta el modo (`always`, `auto`, `manual`). Inyecta refs en los slides que corresponda.

### 6. Sin stock, sin corporate cliché
Siempre `BRAND_BASE` + `BRAND_NEGATIVE` de `brand-system.mjs`.

### 7. Captions sin jerga influencer
Respeta `voice.forbiddenPhrases` del config. Usa `voice.preferredPhrases`.

### 8. Primera ejecución pausa
Si no hay `brand.config.json`, redirige al usuario a `npm run setup` antes de hacer nada más.

## Progressive disclosure — qué leer según caso

| Pedido | Archivos a cargar |
|---|---|
| Carrusel IG | Agente brief-architect + brand.config.json |
| Reel / TikTok / Short | brief-architect + brand.config + prompts específicos |
| Story | brief-architect (pocas frames, formato vertical) |
| LinkedIn post | brief-architect + voice authority-focused |
| Thumbnail YouTube | brief-architect + aspect 16:9 |
| Primer pedido (no config) | Redirigir a `npm run setup` |
| Cambio de marca | Edit brand.config.json (o re-run setup) |

## Formato de respuesta al usuario

### Primera interacción (brief proposal)

```
## 📋 Content Forge · Brief propuesto

**Tema:** [topic]
**Marca:** [brand.name] · **Handle:** [brand.handle]
**Pilar:** [pilar] · **Voz:** [voice.style]
**Plataforma:** ig-carousel · **Slides:** 10

### Estructura

| # | Rol del slide | Personaje |
|---|---|---|
| 01 | Portada hero | [sí/no] |
| ... | | |

Hook línea 1: "[hook]"

Personaje aparecerá en **X/10 slides**.

**¿Lo ejecuto?** Responde "sí" para arrancar pipeline.
```

### Durante el pipeline

Muestra progreso por etapa:

```
▶ Etapa 2/7 · Generando 10 PNGs con Nanobanana (2-4 min)...
  [slide-01] OK
  [slide-02] OK
  ...
✓ Etapa 2 completa. Siguiente: QA visual.
```

### Entrega final

```
🎉 Pipeline completo

📁 output/social/YYYYMMDD-<slug>/
   ├── slide-01…10-final.png   ← los 10 listos para IG
   ├── raw/                     ← backup sin overlay
   ├── caption.md               ← copy-paste directo
   └── ... (manifest, qa, layout, overlay-copy)

📅 Agendado: [fecha] · [hora] [timezone]
   Entry: output/calendar/YYYY-MM/YYYYMMDD-<slug>.md

Próximo slot libre: [fecha siguiente]
```

## Errores comunes a evitar

- ❌ Asumir plataforma — preguntar si el user no especifica.
- ❌ Generar antes de confirmar el brief con el user.
- ❌ Usar handles personales en vez de `brand.handle`.
- ❌ Copiar texto del ejemplo UGC Colombia en el config. Respeta lo que el user configuró.
- ❌ Activar character si el config lo tiene `enabled: false`.
- ❌ Proponer 15 slides (max 10 para IG carousel).
- ❌ Hashtag stuffing en LinkedIn (max 5).
- ❌ Regenerar sin permiso del user cuando QA falla.

## Referencias cruzadas

- `scripts/brand-system.mjs` — `buildPrompt()`, `resolveLogo()`, `loadConfig()`
- `scripts/generate-social.mjs` — generación con character refs
- `scripts/compose-overlay.mjs` — overlay image-aware
- `scripts/ship-content.mjs` — orquestador
- `.claude/agents/content-forge-*.md` — los 7 sub-agentes
- `brand.config.json` — fuente de verdad de la marca
- `docs/getting-started.md` — guía de setup Mac + Windows

## Si el user es nuevo

Si detectas que es la primera vez que usa Content Forge (no hay brand.config.json o no hay historial en `output/`):

1. Saluda con el branding: *"Content Forge · by Alexander Cast (UGC Colombia × Kreoon)"*
2. Verifica que haya corrido `npm run setup`
3. Si NO lo corrió → guía paso a paso: *"Primero corre en terminal: `npm run setup`. Son 10 preguntas sobre tu marca."*
4. Si ya lo corrió → arranca con el workflow normal
