# Pipeline Reference — Content Forge

## Los 3 pipelines del sistema

Content Forge tiene tres pipelines independientes que comparten la misma capa de composición final:

| Pipeline | Script | Caso de uso |
|----------|--------|-------------|
| **A — IA generativa** | `generate-social.mjs` | Fondos fotográficos con personaje (o sin) |
| **B — Tipográfico** | `typographic-carousel.mjs` | Carrusel de diseño puro, sin fotografía |
| **C — Clonado viral** | `clone-from-url.mjs` | Recrear estructura de carrusel existente |

Todos los pipelines desembocan en el mismo compositor (`compose-overlay.mjs`) y el mismo editor visual (`localhost:4321`).

---

## Pipeline A — Generación IA completa

### Diagrama de flujo

```
  Prompt / Brief
       │
       ▼
 [brand-system.mjs]
  Carga paleta + voz
       │
       ▼
 [wavespeed-client.mjs]  ←── WAVESPEED_API_KEY
  Fase A: fondo premium         │
  flux-dev (1024×1280)          │  fallback si no hay key
  + prefix calidad premium      ▼
                          [openai gpt-image-2]
       │
       ▼
 [logo-compositor.mjs]  ←── detección de plataformas
  Incrusta logos reales          del prompt (opcional)
  en franja 13% inferior
       │
       ▼
 [generate-social.mjs — Fase B]  ←── GEMINI_API_KEY
  Gemini 2.5 Flash Image               (solo si useChar=true)
  Character swap con refs
  Respeta composición + luz
       │
       ▼
 [sharp] — Resize Lanczos3
  → target final (1080×1350 etc.)
       │
       ▼
 output/social/YYYYMMDD-slug/
  ├ slide-01.png  (imagen base limpia)
  ├ manifest.json
  └ overlay-copy.json
       │
       ▼
 [compose-overlay.mjs]
  Texto + logo + signature
  Respeta logoZone
       │
       ▼
  slide-01-final.png ✓
```

### Parámetros de generación (WaveSpeed flux-dev)

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| `prompt` | Brief + PREMIUM_PREFIX | Prefix añadido automáticamente |
| `size` | `"1024*1280"` | Ratio 4:5 para ig-carousel |
| `num_inference_steps` | 30 | Más pasos = más detalle |
| `guidance_scale` | 3.5 | Valor oficial recomendado flux-dev |
| `num_images` | 1 | Siempre 1 por llamada |
| `seed` | -1 | Aleatorio para variación |

### Plataformas soportadas

| ID | Resolución | Ratio | Uso |
|----|-----------|-------|-----|
| `ig-carousel` | 1080×1350 | 4:5 | Instagram carrusel (principal) |
| `ig-feed` | 1080×1350 | 4:5 | Post individual |
| `ig-square` | 1080×1080 | 1:1 | Feed cuadrado |
| `reel` | 1080×1920 | 9:16 | Instagram Reel |
| `story` | 1080×1920 | 9:16 | Stories |
| `tiktok` | 1080×1920 | 9:16 | TikTok |
| `youtube-short` | 1080×1920 | 9:16 | YT Shorts |
| `youtube-thumb` | 1280×720 | 16:9 | Thumbnail YouTube |
| `linkedin` | 1200×628 | 16:9 | Imagen LinkedIn |
| `linkedin-pdf` | 1080×1350 | 4:5 | PDF carrusel LinkedIn |
| `whatsapp` | 1080×1080 | 1:1 | WhatsApp Status |
| `x-post` | 1200×675 | 16:9 | Post en X/Twitter |
| `newsletter` | 1200×600 | 2:1 | Email header |

### Validación de texto (opcional)

Cuando `TEXT_VALIDATION=true`, después de la Fase B se ejecuta:
1. Gemini Vision extrae texto visible en la imagen generada
2. Compara con `expectedTexts` (del brief) con similarity ≥ 0.95
3. Si falla → regenera con prompt reforzado (máx 3 reintentos)
4. Si persiste → `textFallbackToOverlay: true` → compose-overlay lo rasteriza

---

## Pipeline B — Carrusel tipográfico

### Cuándo usarlo

- No tienes personaje o no quieres fotografía
- Contenido de data/stats con gráficas tipográficas
- Velocidad: genera en segundos sin llamada a API de IA
- Estética minimalista editorial

### Flujo

```
brief (overlay-copy.json manual)
       │
       ▼
 css-backgrounds.mjs
  → SVG 2160×2160 parametrizado
       │
       ▼
 sharp (upscale Lanczos3)
  → PNG nativo
       │
       ▼
 compose-overlay.mjs
  → Tipografía Anton/Inter
  → Logo monograma top-right
  → slide-XX-final.png
```

### Estilos de fondo disponibles

Ver tabla completa en [architecture.md](./architecture.md#css-backgroundsmjs).

Los parámetros `base`, `accent`, `intensity` se configuran slide por slide en `overlay-copy.json` bajo la key `bg`.

---

## Pipeline C — Clonado viral

### Flujo (requiere APIFY_API_TOKEN)

```
URL de Instagram / TikTok / LinkedIn
       │
       ▼
 clone-from-url.mjs
  → Apify scraper extrae slides
  → Descarga imágenes originales
  → Guarda en output/clones/<run>/
       │
       ▼
 content-forge-clone-analyzer (agente)
  → Claude Vision analiza layout
  → Identifica: posición texto, paleta, ratio texto/imagen
  → Genera brief JSON con TU marca/voz
       │
       ▼
 Pipeline A o B normal
```

---

## Compositor de overlays (compose-overlay.mjs)

### Capas de renderizado (orden)

```
Imagen base PNG
    │
    ▼
[CAPA 1] Scrim cinematográfico
  → Gradiente negro 4 stops
  → Cubre 46% inferior (ajustable)
    │
    ▼
[CAPA 2] Custom elements[]
  → chips (label-pill con borde)
  → accent-bars (línea decorativa)
  → dividers (línea horizontal)
  → text (texto custom posicionado)
    │
    ▼
[CAPA 3] Texto semántico legacy
  → eyebrow → headline → body
  → Posicionamiento automático (bottom/top/center)
  → Auto-token según wordCount
    │
    ▼
[CAPA 4] Signature @handle
  → Accent bar decorativa
  → Color: gold (palette.dark)
    │
    ▼
[CAPA 5] Micro-copy
  → Texto pequeño de soporte
    │
    ▼
[POST] applyLogo()
  → Logo de marca (PNG desde brand-assets/)
  → Posición: bottom-right / top-right / etc.
    │
    ▼
[POST] applyToolChips()
  → Chips de herramientas pre-renderizados
  → Posición libre por ratio x/y
```

### Sistema de tokens tipográficos

| Token | Escala (÷ ancho) | Fuente | Peso | Uso |
|-------|-----------------|--------|------|-----|
| `display` | 9.8% | Anton | 400 | Headlines cortos (≤3 palabras) |
| `display-sm` | 8.2% | Anton | 400 | Headlines medios (4-5 palabras) |
| `display-xs` | 6.8% | Anton | 400 | Headlines largos (6-8 palabras) |
| `heading` | 5.5% | Inter | 700 | Subtítulos principales |
| `subheading` | 4.2% | Inter | 600 | Subtítulos secundarios |
| `label` | 2.4% | Inter | 700 | Eyebrows / chips (uppercase) |
| `body` | 3.18% | Inter | 400 | Texto corrido |
| `caption` | 2.4% | Inter | 500 | Notas al pie |
| `micro` | 1.9% | Inter | 500 | Meta-info (wide tracking) |
| `signature` | 2.4% | Inter | 600 | @handle (gold + accent bar) |

### Anti-solapamiento

El compositor respeta automáticamente las zonas reservadas:

- **Márgenes seguros:** 8% lados, 7% top, 8.2% bottom (fijos)
- **logoZone:** Si `slide.logoZone = { y: 0.87, h: 0.13 }`, el margen efectivo inferior aumenta al 15% — ningún texto invade la franja de logos

---

## Overlay Editor (localhost:4321)

### Arquitectura del servidor

```
tools/overlay-editor/server.mjs
  │
  ├─ GET  /api/*           → Lee archivos / llama scripts
  ├─ POST /api/save        → Escribe overlay-copy.json + layout-plan.json
  ├─ POST /api/compose     → Ejecuta compose-overlay.mjs como child process
  └─ POST /api/ai-generate → WaveSpeed (primario) / OpenAI (fallback)
```

Ver referencia completa de endpoints en [api-server-reference.md](./api-server-reference.md).

### Estado del frontend (app.js)

```js
state = {
  slug:          string,          // carrusel activo
  manifest:      ManifestJSON,    // metadata + results[]
  overlayCopy:   OverlayCopyJSON, // texto editable por slide
  layoutPlan:    LayoutPlanJSON,  // decisiones de layout por slide
  currentSlideId: string,         // "slide-01" etc.
  selected:      ElementRef,      // elemento seleccionado en canvas
  history:       OverlayCopy[],   // undo stack (máx 50)
  _showPreview:  boolean,         // ver -final.png en lugar del fondo
}
```

### Tabs del editor

| Tab | Función |
|-----|---------|
| **Slides** | Lista de slides con thumbnails; click para seleccionar |
| **Layers** | Elementos del slide activo; reordenar / eliminar |
| **Assets** | Brand assets locales (logos, refs, uploads) |
| **Lib** | SimpleIcons (3000+ logos) + Iconify (200k+ iconos) |
| **AI** | Generación con WaveSpeed; detección automática de plataformas |
| **Fonts** | Librería tipográfica con preview en vivo |
