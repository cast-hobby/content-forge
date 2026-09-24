# Arquitectura — Content Forge

## Visión general

Content Forge es un **estudio editorial en terminal** que produce carruseles y reels con calidad de agencia. Su arquitectura es modular, orientada a pipelines, sin servidor externo y sin estado persistente fuera de archivos locales.

```
┌─────────────────────────────────────────────────────────────┐
│                      CONTENT FORGE                          │
│                                                             │
│  ┌──────────┐   ┌────────────┐   ┌────────────────────┐    │
│  │  Agentes │   │  Scripts   │   │  Overlay Editor    │    │
│  │  Claude  │──▶│  Node.js   │──▶│  localhost:4321    │    │
│  │  (10)    │   │  (ESM)     │   │  (browser UI)      │    │
│  └──────────┘   └─────┬──────┘   └────────────────────┘    │
│                        │                                     │
│               ┌────────▼────────┐                           │
│               │  output/social/ │                           │
│               │  YYYYMMDD-slug/ │                           │
│               │  ├ manifest.json│                           │
│               │  ├ overlay-copy │                           │
│               │  ├ slide-XX.png │                           │
│               │  └ slide-XX-fin │                           │
│               └─────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Stack tecnológico

| Capa | Tecnología | Versión | Rol |
|------|-----------|---------|-----|
| Runtime | Node.js ESM | ≥ 20.0 | Motor de ejecución |
| Generación IA | WaveSpeed AI (flux-dev) | REST v3 | Fondos premium (**primario**) |
| Generación IA | OpenAI gpt-image-2 | SDK 6.34 | Fallback de generación |
| Character swap | Gemini 2.5 Flash Image | @google/genai 1.0 | Fase B del pipeline |
| Render SVG | @resvg/resvg-js | 2.6.2 | SVG → PNG rasterización |
| Procesado imágenes | sharp | 0.33 | Resize, composite, Lanczos3 |
| Tipografías | Anton · Inter · Montserrat | Fontsource 5.x | Embedded en SVG |
| Config | dotenv | 16.4.5 | Variables de entorno |
| CLI interactivo | prompts + picocolors | 2.4 / 1.0 | Setup wizard |
| Servidor local | Node.js http nativo | — | Overlay Editor |
| Agentes IA | Claude Sonnet 4.6 | — | Orquestación editorial |

---

## Árbol de directorios

```
content-forge/
├── brand.config.json          # Fuente de verdad de la marca (generado en setup)
├── .env.local                 # API keys (nunca en git)
├── .env.example               # Template de variables
├── package.json
│
├── scripts/                   # Pipeline de generación
│   ├── brand-system.mjs       # Loader de brand.config.json + helpers
│   ├── generate-social.mjs    # Pipeline Fase A + B (generación completa)
│   ├── typographic-carousel.mjs  # Carrusel tipográfico sin personaje
│   ├── css-backgrounds.mjs    # 8 estilos SVG parametrizables
│   ├── compose-overlay.mjs    # Compositor texto+logo sobre imagen base
│   ├── brand-overlay.mjs      # Logos Clearbit sobre imagen
│   ├── wavespeed-client.mjs   # Cliente REST WaveSpeed AI
│   ├── logo-compositor.mjs    # Logos SimpleIcons en franja inferior
│   ├── platforms-registry.mjs # Detección de plataformas en texto
│   ├── clone-from-url.mjs     # Clona carrusel desde URL (Apify)
│   ├── analyze-character.mjs  # Gemini Vision: analiza refs de personaje
│   ├── ship-content.mjs       # Orquestador de publicación
│   ├── setup.mjs              # Wizard de configuración inicial
│   └── fonts/                 # Fuentes locales (woff2, ttf)
│
├── tools/
│   └── overlay-editor/        # Editor visual local
│       ├── server.mjs         # HTTP server (puerto 4321)
│       ├── index.html         # SPA editor
│       ├── app.js             # Lógica frontend (~1400 líneas, vanilla JS)
│       └── styles.css         # UI styles
│
├── .claude/
│   └── agents/                # 10 agentes Claude especializados
│       ├── content-forge-brief-architect.md
│       ├── content-forge-researcher.md
│       ├── content-forge-layout-architect.md
│       ├── content-forge-character-director.md
│       ├── content-forge-copy-overlay.md
│       ├── content-forge-visual-qa.md
│       ├── content-forge-text-validator.md
│       ├── content-forge-caption-writer.md
│       ├── content-forge-calendar-publisher.md
│       └── content-forge-clone-analyzer.md
│
├── brand-assets/
│   ├── logos/                 # Variantes del logo (dark, light, monograma)
│   ├── mascots/               # Mascota de marca
│   ├── tools/                 # Tool chips (PNG pre-renderizados)
│   ├── character/             # Fotos ref del personaje + character.md
│   └── uploads/              # Imágenes generadas por IA (Editor)
│
├── output/
│   └── social/
│       └── YYYYMMDD-slug/     # Un directorio por carrusel
│           ├── manifest.json
│           ├── overlay-copy.json
│           ├── layout-plan.json
│           ├── slide-01.png … slide-10.png
│           ├── slide-01-final.png … slide-10-final.png
│           └── raw/
│
└── docs/                      # Esta documentación
```

---

## Módulos clave

### brand-system.mjs

Módulo central de identidad de marca. Lee `brand.config.json` y expone helpers que usan todos los scripts.

```
loadConfig()       → brand.config.json validado + defaults
buildBrandBase()   → Prefijo de prompt con paleta/mood/voz
buildPrompt()      → Prompt completo para generación IA
resolveLogo()      → Ruta al PNG del logo (dark/light/monograma)
brandPalette()     → { primary, dark, white, grayLight, grayDark }
brandFonts()       → { display, heading, body }
```

### css-backgrounds.mjs

Generador de 8 estilos de fondo SVG. Todos los fondos son 2160×2160 nativo, parametrizables en tiempo real desde el editor.

| Estilo | Descripción |
|--------|-------------|
| `dark-shaft` | Fondo oscuro con rayo dorado diagonal |
| `light-wall` | Pared blanca con textura arquitectónica |
| `cream-bokeh` | Crema cálido con bokeh suave |
| `concrete` | Textura hormigón + vigneta |
| `dark-galaxy` | Negro profundo, constelaciones |
| `bw-split` | Mitad blanco / mitad negro |
| `ivory-grad` | Gradiente marfil a blanco |
| `amber-glow` | Ámbar cálido con glow central |

**Params por slide:**
- `base` — Color primario del fondo (hex)
- `base2` — Color secundario (hex)
- `accent` — Color de acento (hex)
- `intensity` — Opacidad de efectos `[0.0 – 1.0]`

### compose-overlay.mjs

Compositor profesional de texto e imagen. Renderiza SVG con el design system sobre cualquier PNG base.

**Design System:**
- Márgenes seguros: 8% lados · 7% top · 8.2% bottom
- 10 tokens tipográficos: `display → display-sm → display-xs → heading → subheading → label → body → caption → micro → signature`
- Fuentes: Anton (display), Inter (todo lo demás)
- 4 capas: scrim cinematográfico → elements[] → texto semántico → signature + micro-copy
- Respeta `logoZone` cuando hay logos de plataformas incrustados

### wavespeed-client.mjs

Cliente REST nativo (sin SDK) para WaveSpeed AI.

```
POST /api/v3/wavespeed-ai/flux-dev
  body: { prompt, size, num_images, guidance_scale, num_inference_steps, seed }
  → { data: { id, status } }

GET /api/v3/predictions/{id}/result
  → { data: { status, outputs: ["https://cdn.wavespeed.ai/..."] } }
```

- Size: formato `"W*H"` (asterisco, no "x")
- Polling cada 2s, máximo 50 intentos (~100s)
- Prefix automático de calidad premium en cada prompt

### logo-compositor.mjs

Post-procesa imágenes generadas para incrustar logos reales de plataformas.

```
compositePlatformLogos(imageBuffer, slugs[])
  → { buffer: PNG, logoZone: { y: 0.87, h: 0.13 } }
```

- Logos: SimpleIcons CDN (SVG) → rasterizados 52×52px con resvg-js
- Franja: 13% inferior, fondo `#0A0A0A` 88% opacidad
- `logoZone` se propaga a `overlay-copy.json` para que el texto la respete

---

## Flujo de datos entre módulos

```
brand.config.json
       │
       ▼
brand-system.mjs ──────────────────────────────────────────┐
       │                                                    │
       ▼                                                    ▼
generate-social.mjs          compose-overlay.mjs    overlay-editor/
  ├─ Fase A: wavespeed-client.mjs (imagen base)       server.mjs
  │    └─ logo-compositor.mjs (logos incrustados)         │
  ├─ Fase B: Gemini (character swap)              ┌────────┘
  └─ manifest.json + overlay-copy.json            │
                │                                 ▼
                └──────────────────────────► app.js (browser)
                                                  │
                                                  ▼
                                            slide-XX-final.png
```

---

## Convenciones del proyecto

### Variables de entorno (`.env.local`)
```
WAVESPEED_API_KEY=ws_...     # Proveedor primario de imágenes
OPENAI_API_KEY=sk-...        # Fallback de imágenes
GEMINI_API_KEY=AIzaSy...     # Character swap + Vision QA
APIFY_API_TOKEN=apify_api_... # Clone-from-URL (opcional)
```

### Formatos de archivo invariantes

**`manifest.json` — results[]:**
```json
{
  "id": "slide-01",
  "ok": true,
  "path": "/ruta/absoluta/slide-01.png",
  "narrativeBeat": "Hook"
}
```

**`overlay-copy.json` — slides[id]:**
```json
{
  "overlay": {
    "headline": "", "body": "", "eyebrow": "",
    "signature": "", "colorScheme": "dark",
    "showLogo": true, "logoPosition": "bottom-right",
    "elements": []
  },
  "bg": { "base": "#110e09", "accent": "#D4AF37", "intensity": 0.65 },
  "logoZone": { "y": 0.87, "h": 0.13 }
}
```

> **Crítico:** El editor y compose-overlay.mjs dependen de estos formatos exactos. No modificar las keys sin actualizar ambos consumidores.

### Módulos ESM

Todo el proyecto usa `"type": "module"` (ESM puro). No hay CommonJS, no hay bundler. Las importaciones entre scripts deben usar rutas relativas con extensión `.mjs`.
