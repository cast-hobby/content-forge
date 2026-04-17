# Configurando tu marca

> `brand.config.json` es la fuente de verdad de Content Forge. Todo el pipeline lee de aquí.

---

## Cómo se crea

Normalmente por el wizard (`npm run setup`). Pero puedes editarlo manualmente cuando quieras.

---

## Estructura del archivo

### `brand` — identidad básica

```json
"brand": {
  "name": "Laura Méndez",
  "tagline": "Acompaño a emprendedoras a construir marcas personales que venden",
  "type": "personal",
  "industry": "coaching",
  "handle": "@lauramendezco",
  "website": "https://lauramendez.co",
  "country": "Colombia",
  "timezone": "America/Bogota",
  "primaryLanguage": "es"
}
```

| Campo | Valores válidos | Uso |
|---|---|---|
| `type` | `personal` · `agency` · `product` · `saas` · `other` | Afecta sugerencias de pilar mix |
| `industry` | `coaching` · `ecommerce` · `saas` · `health` · etc. | Hashtags genéricos + sugerencias |
| `handle` | `@algo` (con o sin @) | El único @ en todo el contenido |
| `timezone` | `America/Bogota`, `America/Mexico_City`, `Europe/Madrid`, etc. | Agenda en calendar |
| `primaryLanguage` | `es` · `en` · `pt` | Idioma de captions y prompts |

### `colors` — paleta

```json
"colors": {
  "primary": "#C27B3E",
  "dark": "#1A1A1A",
  "light": "#F7F3EC",
  "grayDark": "#3D3D3C",
  "grayLight": "#BDBCBC",
  "white": "#FFFFFF"
}
```

- **`primary`** = color de acento. Aparece en eyebrows, signatures, accents de luz en las imágenes generadas.
- **`dark`** = fondo primario editorial (usualmente negro o casi-negro).
- **`light`** = fondo claro boutique (crema, off-white).
- **`grayDark` / `grayLight`** = textos secundarios, separadores.
- **`white`** = tipografía sobre fondos oscuros.

⚠ **Contraste WCAG**: asegúrate de que `dark` y `light` tengan ratio ≥ 7:1 para titulares. El wizard valida esto.

### `fonts` — tipografía

```json
"fonts": {
  "display": "Anton",
  "sans": "Inter"
}
```

Por default Anton + Inter (incluidos en el repo). Si quieres cambiar:

1. Descarga los WOFF2 de la fuente que quieras
2. Colócalos en `scripts/fonts/` con el nombre `<Family>-Regular.woff2`, `<Family>-Bold.woff2`, etc.
3. Edita `fonts.display` o `fonts.sans` al nombre de familia

### `logo` — variantes oficiales

```json
"logo": {
  "darkVariant": "brand-assets/logo-dark.png",
  "lightVariant": "brand-assets/logo-light.png",
  "clearspaceRatio": 0.022
}
```

- **`darkVariant`** = logo que se ve bien sobre fondos oscuros/fotos (generalmente logo blanco PNG transparente)
- **`lightVariant`** = logo que se ve bien sobre fondos crema/claros (generalmente logo en color PNG)
- **`clearspaceRatio`** = espacio libre mínimo alrededor del logo como fracción del canvas (default 2.2% = 24px en canvas 1080)

Deben ser **PNG con fondo transparente**.

### `voice` — voz de marca

```json
"voice": {
  "style": "friendly-expert",
  "styleDescription": "Amiga que sabe. Directa pero cálida.",
  "forbiddenPhrases": ["hola familia", "te va a cambiar la vida"],
  "preferredPhrases": ["La verdad es que...", "Esto funciona porque..."]
}
```

4 estilos pre-configurados:

| Estilo | Cuándo usarlo |
|---|---|
| `friendly-expert` | Amiga que sabe. Balance entre cercanía y autoridad. Default para educación y coaching. |
| `authority` | Autoridad sin arrogancia. Thought leadership, B2B, LinkedIn serio. |
| `provocateur` | Reframe punzante. Debates, contrarian takes, atención inmediata. |
| `educator-calm` | Claridad paso a paso. Tutoriales, explicaciones técnicas. |

Puedes editar manualmente `forbiddenPhrases` y `preferredPhrases` para afinar más.

### `character` — consistencia de personaje

```json
"character": {
  "enabled": true,
  "mode": "personal",
  "name": "Laura",
  "referenceImages": [
    "brand-assets/character/01-frontal-neutral.jpg"
  ],
  "descriptionFile": "brand-assets/character/character.md",
  "useInSlides": "auto",
  "maxRefsPerCall": 4
}
```

Ver guía completa: [`character-consistency.md`](./character-consistency.md)

### `content` — defaults de generación

```json
"content": {
  "defaultPlatform": "ig-carousel",
  "defaultSlideCount": 10,
  "pillarMix": {
    "educativo": 0.35,
    "bts": 0.20,
    "casos": 0.15,
    "debate": 0.15,
    "estrategico": 0.15
  },
  "cadence": {
    "ig-carousel": { "preferredDays": ["Tue", "Thu", "Sat"], "preferredHour": "19:00" }
  }
}
```

- **`pillarMix`** — balance ideal semanal/mensual (sumar 1.0). Claude sugiere pilares según este balance para mantener tu mix sano.
- **`cadence`** — días y horas óptimas por plataforma. Usadas por el calendar publisher.

### `output` — preferencias de output

```json
"output": {
  "baseDir": "output/social",
  "keepRawBackup": true,
  "showFooter": false,
  "footerText": "made with content-forge",
  "calendarDir": "output/calendar"
}
```

- **`showFooter: true`** activa un pequeño crédito "made with content-forge" en esquina inferior. Discreto. Ayuda a que el proyecto crezca orgánicamente. Off por default — tú decides.

### `hashtags` — mix para captions

```json
"hashtags": {
  "niche": ["#MarcaPersonalColombia", "#CoachingMujeres", ...],
  "mid": ["#MarketingDigital", "#Emprendimiento", ...],
  "broad": ["#Instagram", "#Negocios", ...]
}
```

Ideal: **5 nicho + 10 medio + 5 amplio = 20**. El caption-writer los mezcla así.

Si dejas vacíos, el sistema usa genéricos y te avisa.

### `leadMagnet` — tu lead magnet principal

```json
"leadMagnet": {
  "name": "Guía de Marca Personal 2026",
  "url": "https://lauramendez.co/guia",
  "bioLinkLabel": "Link en bio"
}
```

El caption-writer lo usa para CTAs.

---

## Cambiar algo después del setup

1. Abre `brand.config.json` en tu editor
2. Cambia lo que quieras
3. Guarda

Los cambios aplican desde la próxima generación — no hace falta re-ejecutar el wizard.

### Cambios que requieren re-ejecutar algo:

| Cambio | Acción adicional |
|---|---|
| Añadir fotos del personaje | `npm run analyze-character` |
| Cambiar logos | Colocar nuevos PNGs en las rutas configuradas |
| Cambiar API key | Editar `.env.local` directamente |
| Empezar de cero con otra marca | `npm run setup` (te pregunta si sobreescribir) |

---

## Migrar configuración entre máquinas

`brand.config.json` **no** está en git por default (está en `.gitignore` por privacidad). Si quieres sincronizar entre Mac y Windows:

1. Copia a mano `brand.config.json`, `.env.local` y `brand-assets/` entre máquinas
2. O usa un servicio privado (1Password, iCloud Drive) para los archivos
3. **Nunca** commitees estos archivos a un repo público

---

## Cómo saber si el config es válido

```bash
node -e "import('./scripts/brand-system.mjs').then(m => m.loadConfig().then(c => console.log('✓ Config válido:', c.brand.name)))"
```

Si sale un error, te dice qué falta.
