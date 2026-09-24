# API Server Reference — Overlay Editor (localhost:4321)

## Arranque

```bash
npm run editor
# o directamente:
node tools/overlay-editor/server.mjs
node tools/overlay-editor/server.mjs --port=5000
```

El servidor es HTTP puro (sin Express, sin dependencias). Sirve la SPA del editor y expone una API REST para leer/escribir el estado del carrusel.

---

## Endpoints

### Carruseles

#### `GET /api/carousels`

Lista todos los carruseles disponibles en `output/social/`.

**Response:**
```json
["20260507-no-dejes-tu-trabajo", "20260510-automatizacion-n8n"]
```

---

#### `GET /api/load?slug=<slug>`

Carga el estado completo de un carrusel para el editor.

**Params:** `slug` — nombre del directorio en output/social/

**Response:**
```json
{
  "manifest":    { "results": [...], "resolution": "1080x1350" },
  "overlayCopy": { "slides": { "slide-01": { "overlay": {}, "bg": {} } } },
  "layoutPlan":  { "slide-01": { "recommendedPosition": "bottom" } }
}
```

---

#### `POST /api/save`

Persiste el estado editado del carrusel.

**Body:**
```json
{
  "slug": "20260507-no-dejes-tu-trabajo",
  "overlayCopy": { ... },
  "layoutPlan":  { ... }
}
```

**Response:** `{ "ok": true }`

---

#### `POST /api/compose`

Ejecuta `compose-overlay.mjs` para el carrusel indicado.
Genera los archivos `slide-XX-final.png`.

**Body:** `{ "slug": "20260507-no-dejes-tu-trabajo" }`

**Response:** `{ "ok": true, "count": 8 }`

---

### Fondos CSS

#### `GET /api/bg-defaults`

Devuelve los parámetros default de los 8 estilos de fondo.

**Response:**
```json
[
  { "id": "dark-shaft",  "base": "#110e09", "accent": "#D4AF37", "intensity": 0.65 },
  { "id": "light-wall",  "base": "#F5F0EB", "accent": "#C9A84C", "intensity": 0.40 },
  ...
]
```

---

#### `GET /api/bg-svg?slug=<slug>&id=<slideId>&base=<hex>&accent=<hex>&intensity=<0-1>`

Devuelve el SVG del fondo con los parámetros actuales (live preview).

**Params:**
- `slug` — carrusel
- `id` — "slide-01" etc.
- `base`, `accent`, `intensity` — overrides opcionales

**Response:** `image/svg+xml`

Usado por el canvas del editor para preview en tiempo real sin guardar.

---

### Brand

#### `GET /api/brand-config`

Devuelve el `brand.config.json` completo.

**Response:** JSON con toda la configuración de marca.

---

#### `GET /api/brand-assets`

Lista todos los assets en `brand-assets/` con estructura:

**Response:**
```json
{
  "logos":    [{ "name": "logo-dark", "url": "/assets/logos/logo-dark.png" }],
  "mascots":  [...],
  "tools":    [...],
  "character": [...],
  "uploads":  [...]
}
```

---

### Imágenes estáticas

#### `GET /slides/<slug>/<file>.png`

Sirve imágenes del carrusel (fondos limpios y finales).

#### `GET /assets/<sub>/<file>`

Sirve brand assets (`logos/`, `mascots/`, `uploads/`, etc.).

#### `GET /fonts/<file>`

Sirve fuentes locales (Anton, Inter, Montserrat en woff2/ttf).

---

### Iconografía

#### `GET /api/simple-icons?slug=<slug>&color=<hex>`

Proxy a `cdn.simpleicons.org`. Devuelve SVG del icono con el color indicado.

**Params:**
- `slug` — nombre de la marca en SimpleIcons (ej: "n8n", "supabase")
- `color` — hex sin # (ej: "FFFFFF")

**Response:** `image/svg+xml`

---

#### `GET /api/simple-icons/search?q=<query>`

Busca iconos en SimpleIcons (búsqueda local).

**Response:** `{ "results": [{ "slug": "n8n", "title": "n8n" }] }`

---

#### `GET /api/iconify/search?q=<query>&limit=<n>`

Busca iconos en Iconify API (200k+ iconos).

**Response:** `{ "icons": ["mdi:account", "ph:house-bold"] }`

---

#### `GET /api/iconify/icon?name=<iconName>`

Devuelve SVG de un icono Iconify.

**Params:** `name` — ej: "mdi:account" (prefijo:nombre)

**Response:** `image/svg+xml`

---

### Generación IA

#### `POST /api/ai-generate`

Genera una imagen con WaveSpeed AI (primario) u OpenAI gpt-image-2 (fallback).

**Body:**
```json
{
  "prompt":  "carrusel premium sobre automatización...",
  "size":    "1024x1280",
  "quality": "high",
  "logos":   ["n8n", "supabase"]
}
```

**Campos:**
| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `prompt` | string | — | **Requerido** |
| `size` | string | `"1024x1280"` | Formato OpenAI (se convierte a `*` internamente para WaveSpeed) |
| `quality` | string | `"high"` | Solo aplica al fallback OpenAI |
| `logos` | string[] | `[]` | Slugs de SimpleIcons para incrustar en franja inferior |

**Response:**
```json
{
  "file":      "ai-1715098123456.png",
  "sub":       "uploads",
  "url":       "/assets/uploads/ai-1715098123456.png",
  "name":      "ai-1715098123456",
  "size":      "1024x1280",
  "logoZone":  { "y": 0.87, "h": 0.13 }
}
```

`logoZone` es `null` si no se solicitaron logos.

**Lógica de selección de proveedor:**
1. Si `WAVESPEED_API_KEY` en env → WaveSpeed flux-dev
2. Si no → OpenAI gpt-image-2 (requiere `OPENAI_API_KEY`)

---

#### `GET /api/detect-platforms?text=<prompt>`

Detecta plataformas/herramientas mencionadas en un texto libre.

**Response:**
```json
{
  "platforms": [
    { "name": "N8n",      "slug": "n8n",      "iconUrl": "https://cdn.simpleicons.org/n8n/FFFFFF" },
    { "name": "Supabase", "slug": "supabase",  "iconUrl": "https://cdn.simpleicons.org/supabase/FFFFFF" }
  ]
}
```

Usado por el editor para mostrar badges automáticos mientras el usuario escribe el prompt.

---

### Upload

#### `POST /api/upload` (multipart/form-data)

Sube archivos (PNG, JPG, SVG) a `brand-assets/uploads/`.

**Response:**
```json
{
  "uploaded": [
    { "file": "mi-imagen.png", "sub": "uploads", "url": "/assets/uploads/mi-imagen.png" }
  ]
}
```

---

#### `POST /api/import-library`

Importa un asset desde URL externa (ej: Clearbit logo, SimpleIcons CDN).

**Body:**
```json
{
  "url":  "https://logo.clearbit.com/stripe.com",
  "name": "stripe-logo",
  "sub":  "logos"
}
```

**Response:** `{ "file": "stripe-logo.png", "sub": "logos", "url": "/assets/logos/stripe-logo.png" }`

---

## Códigos de error

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 400 | Parámetro requerido faltante (ej: prompt vacío) |
| 404 | Recurso no encontrado (slug, archivo) |
| 502 | Error en proveedor externo (WaveSpeed, OpenAI, Clearbit) |
| 500 | Error interno del servidor |

---

## Variables de entorno requeridas por el servidor

| Variable | Requerida para | Prioridad |
|----------|---------------|-----------|
| `WAVESPEED_API_KEY` | `/api/ai-generate` | 1 (primaria) |
| `OPENAI_API_KEY` | `/api/ai-generate` (fallback) | 2 (secundaria) |
| `GEMINI_API_KEY` | Fase B (solo en generate-social.mjs) | — |
| `APIFY_API_TOKEN` | clone-from-url.mjs | Opcional |

El servidor lee `.env.local` primero, luego `.env`. No se reinicia automáticamente al cambiar `.env.local` — hay que reiniciarlo manualmente.
