# brand.config.json — Referencia completa

## Qué es

`brand.config.json` es la **fuente de verdad de la marca** en Content Forge. Todo el sistema — generación de imágenes, tipografía, overlays, captions, calendario — lee este archivo. Se genera en el setup inicial (`npm run setup`) y puede editarse manualmente.

Nunca debe estar en `.gitignore` si el proyecto es personal. Si es un proyecto compartido en repo público, añadirlo.

---

## Esquema completo

```json
{
  "brand": {
    "name":         "string  — Nombre de la marca (ej: 'KREOON')",
    "handle":       "string  — @handle sin @ ni espacios (ej: '@infiny')",
    "tagline":      "string  — Tagline corto (ej: 'Automatiza. Crea. Escala.')",
    "industry":     "string  — Sector (ej: 'Marketing digital')",
    "market":       "string  — Mercado objetivo (ej: 'LATAM')"
  },

  "colors": {
    "primary":    "#HEX  — Color principal de la marca",
    "dark":       "#HEX  — Dorado / acento oscuro (en textos de acento, accent bars)",
    "light":      "#HEX  — Acento claro (variante del dark)",
    "white":      "#HEX  — Blanco de marca (casi siempre #FFFFFF o #F5F0EB)",
    "grayLight":  "#HEX  — Gris claro (texto body en fondos oscuros)",
    "grayDark":   "#HEX  — Gris oscuro (texto body en fondos claros)"
  },

  "logo": {
    "dark":        "string  — Ruta relativa al logo dark (sobre fondos claros)",
    "light":       "string  — Ruta relativa al logo light (sobre fondos oscuros)",
    "monogram":    "string  — Ruta al monograma (versión compacta)",
    "clearspaceRatio": 0.022,  "— Padding relativo al ancho del canvas"
  },

  "typography": {
    "display":  "string  — Fuente para headlines (ej: 'Anton')",
    "heading":  "string  — Fuente para subtítulos (ej: 'Inter')",
    "body":     "string  — Fuente para texto corrido (ej: 'Inter')"
  },

  "voice": {
    "tone":        "string  — Tono general (ej: 'directo, cercano, sin tecnicismos')",
    "style":       "string  — Estilo de escritura (ej: 'conversacional con autoridad')",
    "audience":    "string  — A quién le hablas (ej: 'emprendedores digitales 25-40 años')",
    "avoid":       ["string  — Palabras o frases a evitar"],
    "use":         ["string  — Palabras o frases preferidas"]
  },

  "character": {
    "enabled":     "boolean  — true si usas personaje en los carruseles",
    "name":        "string   — Nombre del personaje (ej: 'Alexander')",
    "description": "string   — Descripción física para prompts (ej: 'hombre latinoamericano, 30s...')",
    "refsDir":     "string   — Directorio con fotos ref (ej: 'brand-assets/character/')",
    "poseHints":   ["string  — Hints de pose para Gemini (ej: 'siempre de frente')"]
  },

  "cadence": {
    "postsPerWeek": "number  — Frecuencia de publicación (ej: 3)",
    "bestDays":     ["string  — Días preferidos (ej: ['tuesday', 'thursday'])"],
    "bestTime":     "string   — Hora preferida en formato HH:MM",
    "timezone":     "string   — Timezone IANA (ej: 'America/Bogota')"
  },

  "hashtags": {
    "branded":  ["string  — 5 hashtags de marca siempre presentes"],
    "thematic": ["string  — Pool de hashtags temáticos (rotar)"],
    "niche":    ["string  — Hashtags de nicho específico"]
  },

  "platforms": {
    "primary":   "string  — Plataforma principal (ej: 'instagram')",
    "secondary": ["string  — Plataformas secundarias (ej: ['linkedin', 'tiktok'])"]
  },

  "output": {
    "showFooter":  "boolean  — Mostrar pie de página con créditos",
    "footerText":  "string   — Texto del footer (ej: 'by Alexander Cast')",
    "watermark":   "boolean  — Añadir watermark en preview"
  }
}
```

---

## Ejemplo mínimo funcional

```json
{
  "brand": {
    "name":    "KREOON",
    "handle":  "@infiny",
    "tagline": "Automatiza. Crea. Escala.",
    "industry": "Marketing digital",
    "market":   "LATAM"
  },
  "colors": {
    "primary":   "#0A0A0A",
    "dark":      "#D4AF37",
    "light":     "#C9A84C",
    "white":     "#FFFFFF",
    "grayLight": "#B0B0B0",
    "grayDark":  "#333333"
  },
  "logo": {
    "dark":     "brand-assets/logos/logo-dark.png",
    "light":    "brand-assets/logos/logo-light.png",
    "monogram": "brand-assets/logos/logo-monogram.png",
    "clearspaceRatio": 0.022
  },
  "typography": {
    "display": "Anton",
    "heading": "Inter",
    "body":    "Inter"
  },
  "voice": {
    "tone":     "directo, cercano, sin tecnicismos",
    "style":    "conversacional con autoridad",
    "audience": "emprendedores digitales latinoamericanos 25-45 años",
    "avoid":    ["jargon", "pasivo", "quizás"],
    "use":      ["tú", "ya", "directo", "concreto"]
  },
  "character": {
    "enabled":     true,
    "name":        "Alexander",
    "description": "Hombre latinoamericano, 30 años, tez morena clara, pelo oscuro corto, expresión segura y accesible",
    "refsDir":     "brand-assets/character/",
    "poseHints":   ["siempre de frente a cámara", "gestos de mano al hablar"]
  },
  "cadence": {
    "postsPerWeek": 3,
    "bestDays":     ["tuesday", "thursday", "saturday"],
    "bestTime":     "18:30",
    "timezone":     "America/Bogota"
  },
  "hashtags": {
    "branded":  ["#kreoon", "#infiny", "#ugccolombia"],
    "thematic": ["#marketing", "#automatizacion", "#contenido", "#emprendimiento"],
    "niche":    ["#ugclatam", "#creadordecontenido", "#marketingdigital"]
  },
  "platforms": {
    "primary":   "instagram",
    "secondary": ["linkedin", "tiktok"]
  },
  "output": {
    "showFooter": false,
    "footerText": "by Alexander Cast",
    "watermark":  false
  }
}
```

---

## Cómo afecta cada campo al sistema

### `colors.dark` — Color de acento

Usado en:
- Accent bars decorativas encima del @handle
- Border de chips (eyebrow pills)
- Texto de `signature`
- `colorScheme: "dark"` en fondos oscuros → texto principal en `colors.white`
- `colorScheme: "light"` en fondos claros → texto principal en `#1A1A1A`

### `character.enabled`

- `true` → Pipeline 2 fases (Fase A imagen base + Fase B Gemini character swap)
- `false` → Solo Fase A (sin personaje, imagen editorial pura)

### `logo.clearspaceRatio`

Multiplica × 2 para obtener el padding del logo respecto al borde del canvas. A 1080px de ancho: `0.022 × 2 × 1080 = 47px` de padding.

### `voice`

Alimenta directamente a `copy-overlay` y `caption-writer`. Los agentes leen `tone`, `style` y `avoid` para calibrar el registro de escritura.

### `cadence`

Usado por `calendar-publisher` para proponer fecha/hora óptima. `bestDays` y `bestTime` definen la ventana preferida.

---

## Edición segura del archivo

1. Nunca editar `brand.config.json` mientras el editor está corriendo
2. Reiniciar `npm run editor` después de cambios en colores o logo
3. Los agentes leen el archivo en cada invocación (no hace falta reiniciarlos)
4. Las fuentes (`typography.*`) deben corresponder a fuentes disponibles en `scripts/fonts/`

---

## Fuentes soportadas actualmente

| Nombre | Archivo | Tokens |
|--------|---------|--------|
| `Anton` | `Anton-Regular.ttf` | display, display-sm, display-xs |
| `Inter` | `Inter-*.ttf` (Regular, Bold, SemiBold) | heading, body, label, caption, micro, signature |
| `Montserrat` | `Montserrat-*.woff2` (Black, Bold, Regular, LightItalic) | alternativo para display |

Para añadir una fuente nueva, colocar el archivo `.ttf` o `.woff2` en `scripts/fonts/` y referenciarlo en `brand.config.typography`.
