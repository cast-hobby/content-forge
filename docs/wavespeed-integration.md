# WaveSpeed AI — Guía de integración

## Por qué WaveSpeed sobre OpenAI

| Criterio | WaveSpeed flux-dev | OpenAI gpt-image-2 |
|----------|-------------------|-------------------|
| Calidad artística | Muy alta (FLUX architecture) | Alta (fotorrealista) |
| Velocidad | ~10-30s | ~30-60s |
| Precio aprox. | $0.003-0.01 / imagen | $0.04-0.12 / imagen |
| Formatos | Flexible (W×H custom) | Fijo (1024, 1280, 1536) |
| LoRA personal | Sí (entrenable) | No |
| Control de parámetros | Alto (steps, CFG, seed) | Limitado |
| Estilo FLUX | Fotográfico + artístico | Solo fotorrealista |

---

## Configuración

### 1. Obtener API Key

1. Ir a `wavespeed.ai/accesskey`
2. Crear nueva key con nombre descriptivo (ej: `content-forge-prod`)
3. **Importante:** la key requiere un top-up previo para activarse

### 2. Configurar en el proyecto

```bash
# En .env.local (nunca en .git)
WAVESPEED_API_KEY=ws_xxxxxxxxxxxxxxxx
```

El sistema detecta automáticamente la key. Si está presente, usa WaveSpeed. Si no, cae a OpenAI.

### 3. Verificar que funciona

```bash
npm run editor
# Abrir localhost:4321 → Tab AI → Escribir cualquier prompt → Generar imagen
# Si ve "Generando imagen premium..." → está usando WaveSpeed
```

---

## API Reference (flux-dev)

### Submit task

```
POST https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-dev
Authorization: Bearer {WAVESPEED_API_KEY}
Content-Type: application/json
```

**Body:**
```json
{
  "prompt":              "string — descripción de la imagen",
  "size":                "1024*1280",
  "num_images":          1,
  "guidance_scale":      3.5,
  "num_inference_steps": 28,
  "seed":                -1
}
```

**Nota crítica:** El separador de dimensiones es `*` (asterisco), NO `x`. `"1024x1280"` dará error.

**Response:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id":     "task-abc123",
    "status": "pending",
    "urls": {
      "get": "https://api.wavespeed.ai/api/v3/predictions/task-abc123"
    }
  }
}
```

### Poll result

```
GET https://api.wavespeed.ai/api/v3/predictions/{task_id}/result
Authorization: Bearer {WAVESPEED_API_KEY}
```

**Response (completed):**
```json
{
  "code": 200,
  "data": {
    "id":      "task-abc123",
    "status":  "completed",
    "outputs": ["https://cdn.wavespeed.ai/outputs/image-xxxxx.png"],
    "timings": { "inference": 2500 }
  }
}
```

### Status lifecycle

```
pending → processing → completed
                    → failed
```

---

## Implementación en Content Forge

### Archivo: `scripts/wavespeed-client.mjs`

```js
// Conversión de formato de tamaño
const wsSize = size.replace("x", "*");   // "1024x1280" → "1024*1280"

// Premium prefix automático (no necesitas escribirlo en el prompt)
const PREMIUM_PREFIX = "premium editorial photography, ultra high quality, ...";
```

### Parámetros tunables

| Parámetro | Valor actual | Rango | Efecto |
|-----------|-------------|-------|--------|
| `num_inference_steps` | 30 | 1-50 | Más pasos = más detalle, más lento |
| `guidance_scale` | 3.5 | 1-20 | Más alto = más fiel al prompt (puede perder realismo) |
| `seed` | -1 (random) | 0-∞ | Fijo = reproducibilidad exacta |
| `POLL_INTERVAL` | 2000ms | — | Frecuencia de polling |
| `POLL_MAX` | 50 | — | Máx intentos (~100s total) |

### Cambiar el modelo

Por defecto se usa `wavespeed-ai/flux-dev`. Para cambiar:

```bash
# En .env.local
WAVESPEED_MODEL=wavespeed-ai/flux-schnell
```

Y en `wavespeed-client.mjs`:
```js
const DEFAULT_MODEL = process.env.WAVESPEED_MODEL || "wavespeed-ai/flux-dev";
```

---

## Modelos de imagen disponibles en WaveSpeed

| Modelo | Velocidad | Calidad | Caso de uso |
|--------|-----------|---------|-------------|
| `wavespeed-ai/flux-dev` | Rápido | Muy alta | **Producción (recomendado)** |
| `wavespeed-ai/flux-schnell` | Muy rápido | Alta | Prototipos rápidos |
| `bytedance/seedream-3-0` | Medio | Alta | Alternativa con buen prompt following |
| `openai/gpt-image-1-5` | Lento | Muy alta | Fotorrealismo extremo |
| `ideogram-ai/ideogram-v3` | Medio | Alta | Texto en imágenes (títulos embebidos) |

Ver lista completa en `wavespeed.ai/models`.

---

## LoRA Training (personaje propio)

WaveSpeed permite entrenar un modelo personalizado en el rostro de una persona. Esto elimina la Fase B (Gemini character swap).

### Dataset requerido

- **20-50 fotos** de calidad del personaje
- Variedad: diferentes ángulos, expresiones, iluminaciones
- Sin filtros ni heavy editing
- Fondo neutro preferible (al menos 30% del dataset)
- Formato: JPG o PNG, mínimo 512×512

### Proceso de entrenamiento

1. En `wavespeed.ai` → Training → New LoRA
2. Subir el dataset
3. Definir trigger word (ej: `ALEXANDER_CAST`)
4. Configurar: `base_model: flux-dev`, `training_steps: 1000`
5. Esperar ~1-2h
6. Obtener `lora_url` del modelo

### Integrar en Content Forge

```bash
# En .env.local
WAVESPEED_LORA_URL=https://cdn.wavespeed.ai/loras/tu-lora-id.safetensors
WAVESPEED_LORA_TRIGGER=ALEXANDER_CAST
```

Modificación en `wavespeed-client.mjs`:
```js
const loraUrl     = process.env.WAVESPEED_LORA_URL;
const loraTrigger = process.env.WAVESPEED_LORA_TRIGGER || "";

body: JSON.stringify({
  prompt: loraUrl ? `${loraTrigger} ${PREMIUM_PREFIX}${prompt}` : `${PREMIUM_PREFIX}${prompt}`,
  ...(loraUrl ? { loras: [{ path: loraUrl, scale: 1.0 }] } : {}),
  size: wsSize,
  num_images: 1,
  guidance_scale: 3.5,
  num_inference_steps: steps,
  seed: -1,
})
```

---

## Troubleshooting

### "WAVESPEED_API_KEY no está definida en el entorno"

- Verificar que está en `.env.local` (no en `.env`)
- Reiniciar `npm run editor` después de cambiar `.env.local`
- Verificar que la key no tenga espacios extra

### "WaveSpeed submit falló 401"

- La key es inválida o expiró
- Revisar en `wavespeed.ai/accesskey`

### "WaveSpeed submit falló 402"

- Sin créditos. Recargar en `wavespeed.ai/billing`

### "WaveSpeed: timeout después de 100s"

- La tarea tardó más de lo esperado (raro en flux-dev)
- Aumentar `POLL_MAX` en `wavespeed-client.mjs` si pasa frecuentemente

### La imagen tiene artifacts o calidad baja

- Aumentar `num_inference_steps` de 30 a 40-50
- Mejorar el prompt (más específico en iluminación, estilo, composición)
- Usar seed fijo para reproducir y ajustar

### La imagen no respeta el prompt

- Subir `guidance_scale` de 3.5 a 5-7
- Ser más explícito en el prompt (qué SÍ debe verse, qué NO)
- Evitar prompts contradictorios ("minimalista y muy detallado" al mismo tiempo)

---

## Costos estimados

Para 10 slides por carrusel, 3 carruseles por semana:

| Proveedor | Imágenes/semana | Costo aprox./semana | Costo aprox./mes |
|-----------|----------------|--------------------|--------------------|
| WaveSpeed flux-dev | 30 | $0.09 - $0.30 | $0.36 - $1.20 |
| OpenAI gpt-image-2 (medium) | 30 | $0.90 - $1.20 | $3.60 - $4.80 |

*Los precios varían según resolución y configuración. Verificar en wavespeed.ai/pricing.*
