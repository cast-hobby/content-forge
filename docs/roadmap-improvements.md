# Roadmap de mejoras — Content Forge

## Estado actual del sistema (mayo 2026)

| Componente | Estado | Notas |
|-----------|--------|-------|
| WaveSpeed flux-dev | Integrado | Proveedor primario de imágenes |
| OpenAI gpt-image-2 | Fallback | Funciona cuando no hay WaveSpeed key |
| Gemini character swap | Funcional | Fase B del pipeline |
| Overlay Editor | Funcional | localhost:4321, 6 tabs |
| Logos incrustados | Implementado | SimpleIcons + franja inferior |
| Detección de plataformas | Implementado | Regex en tiempo real |
| 10 agentes Claude | Definidos | Falta orquestación automática |
| Clone from URL | Funcional | Requiere Apify |
| Publicación directa | Pendiente | No hay integración con IG/LinkedIn |

---

## Mejoras prioritarias (Quick Wins)

### 1. Modo sincrónico para WaveSpeed

**Problema:** La API de WaveSpeed requiere polling (2 llamadas). Existe un modo sync que retorna la imagen directo.

**Mejora:** Activar `sync_mode: true` en el body si está disponible para ese modelo. Reducir latencia de ~30s a ~5s.

**Archivo:** `scripts/wavespeed-client.mjs`

```js
// Intentar modo sync primero
body: JSON.stringify({
  prompt, size: wsSize,
  num_images: 1, guidance_scale: 3.5, num_inference_steps: steps,
  seed: -1,
  // Si WaveSpeed lo soporta para flux-dev:
  sync_mode: true
})
```

---

### 2. Regeneración desde el editor

**Problema:** Si la imagen generada no gusta, hay que volver a terminal. El editor solo edita texto y fondos CSS, no regenera imágenes IA.

**Mejora:** Añadir botón "Regenerar fondo" en el panel de propiedades que llame al endpoint `/api/ai-generate` con el prompt del brief actual y reemplace la imagen del slide seleccionado.

**Archivos:** `tools/overlay-editor/index.html`, `app.js`, `server.mjs`

---

### 3. Preview en vivo de logos en la franja

**Problema:** Los logos se incrustan pero el editor no los muestra en el canvas. El usuario solo los ve al hacer Compose.

**Mejora:** En el canvas del editor, superponer los badges de logos (HTML/CSS) en el 13% inferior cuando `slide.logoZone` está definido.

**Archivo:** `tools/overlay-editor/app.js` → función `renderElements()`

---

### 4. Caché de detección de plataformas

**Problema:** Cada keystroke en el textarea hace una llamada a `/api/detect-platforms`.

**Mejora ya implementada:** debounce de 500ms. Posible mejora adicional: hacer la detección en el cliente directamente (cargando el registry JSON sin necesitar fetch al servidor).

**Archivo:** `tools/overlay-editor/app.js`, `scripts/platforms-registry.mjs`

---

### 5. Thumbnails de slides en el editor más grandes

**Problema:** Los thumbnails son 52×52px, difícil distinguir slides.

**Mejora:** Aumentar a 80×100px para ratio 4:5, o añadir hover con preview 200px.

**Archivo:** `tools/overlay-editor/styles.css`, `app.js` → `renderSlideList()`

---

## Mejoras medianas (1-2 semanas)

### 6. Orquestación automática de agentes

**Problema:** Los 10 agentes existen pero hay que invocarlos manualmente uno a uno. No hay un workflow automático end-to-end.

**Mejora:** Crear un agente orquestador `content-forge-orchestrator` que ejecute el workflow completo:

```
topic → researcher → brief-architect → [generate] → layout-architect →
copy-overlay → [compose] → visual-qa → text-validator → caption-writer → calendar-publisher
```

Con checkpoints: si visual-qa falla → regenerar slide; si text-validator falla → recompose.

**Archivo nuevo:** `.claude/agents/content-forge-orchestrator.md`

---

### 7. Múltiples variantes por slide

**Problema:** Se genera 1 imagen por slide. Si no gusta, a empezar de cero.

**Mejora:** Parámetro `--variants=3` en generate-social.mjs que genere 3 imágenes por slide con seeds distintos. El editor muestra un picker de variantes.

**Archivos:** `scripts/generate-social.mjs`, `scripts/wavespeed-client.mjs` (loop de seeds), `tools/overlay-editor/server.mjs`, `app.js`

---

### 8. Exportación directa a Canva

**Problema:** Después de generar, hay que importar manualmente los PNGs a Canva para toques finales.

**Mejora:** Usar el MCP de Canva (ya disponible en el entorno) para crear un diseño nuevo y subir los slides.

```js
// En server.mjs o nuevo endpoint /api/export-canva
await mcp_claude_ai_Canva__upload_asset_from_url({ url: slideUrl });
await mcp_claude_ai_Canva__create_design_from_candidate(...);
```

**Archivos:** `tools/overlay-editor/server.mjs` (nuevo endpoint), `app.js` (botón "Exportar a Canva")

---

### 9. Sistema de templates de brief

**Problema:** Cada vez hay que describir el brief desde cero. No hay templates guardados para tipos de contenido recurrentes.

**Mejora:** Directorio `templates/briefs/` con JSON pre-rellenados para:
- `educativo-5-errores.json`
- `motivacional-historia.json`
- `datos-estadistica.json`
- `tool-tutorial.json`
- `comparativa.json`

El editor añade un selector de template en el tab AI que pre-llena el textarea del prompt.

---

### 10. Generación batch de carruseles

**Problema:** Solo se puede generar un carrusel por ejecución.

**Mejora:** Script `scripts/batch-generate.mjs` que acepta un CSV o JSON con N topics y genera todos los carruseles en secuencia, respetando rate limits.

```bash
node scripts/batch-generate.mjs --topics=topics.json --platform=ig-carousel
```

---

## Mejoras grandes (features nuevos)

### 11. Integración con Meta API (publicación directa)

**Estado:** Meta tiene MCP disponible en el entorno (`mcp__claude_ai_Ads_Meta_MCO`).

**Mejora:** Añadir publicación directa a Instagram desde el editor.

**Flujo:**
1. Botón "Publicar" en el editor
2. Sube el carrusel a un CDN temporal (o Cloudinary)
3. Meta API: `POST /me/media` (crea media objects)
4. `POST /me/media_publish`
5. caption-writer genera el caption
6. calendar-publisher registra como publicado

**Archivos nuevos:** `scripts/publish-instagram.mjs`, endpoint `/api/publish` en server.mjs

---

### 12. LoRA personal de WaveSpeed

**Contexto:** WaveSpeed soporta LoRA training. Esto permite entrenar el modelo en el rostro/estilo de Alexander para hacer el character swap directamente en la Fase A (sin necesitar la Fase B de Gemini).

**Ventajas:**
- El personaje queda integrado en la imagen desde el inicio (no swap posterior)
- Mucho mayor consistencia de identidad visual
- Elimina la latencia de la Fase B

**Pasos:**
1. Preparar dataset: 20-50 fotos de calidad del personaje (variedad de ángulos, expresiones)
2. Subir a WaveSpeed Training
3. Obtener `lora_url` del modelo entrenado
4. En wavespeed-client.mjs añadir `lora_url` al body de la llamada
5. En el prompt incluir el trigger word del LoRA (ej: "ALEXANDER_CAST")

**Estimado:** 1-2 horas de entrenamiento en WaveSpeed, ~$5-10 USD en compute.

**Archivo a modificar:** `scripts/wavespeed-client.mjs`

```js
// Con LoRA personal:
body: JSON.stringify({
  prompt: `ALEXANDER_CAST ${PREMIUM_PREFIX}${prompt}`,
  loras: [{ path: process.env.WAVESPEED_LORA_URL, scale: 1.0 }],
  size: wsSize, ...
})
```

---

### 13. Análisis automático de rendimiento

**Contexto:** Google Analytics MCP está disponible en el entorno.

**Mejora:** Dashboard de rendimiento que muestra qué tipos de carrusel generan más engagement. Retroalimenta el brief-architect con los pilares que más funcionan.

**Flujo:**
- Cada carrusel publicado se registra con su pilar, topic y fecha
- Analytics trae métricas de alcance/interacción
- Un script correlaciona pilares vs. rendimiento
- El brief-architect prioriza los pilares con mejor histórico

---

### 14. Vídeos programáticos desde slides

**Contexto:** Remotion está configurado en `~/my-video/` con ElevenLabs disponible.

**Mejora:** Convertir un carrusel de 8 slides en un Reel animado:
1. Los slides generados se usan como keyframes
2. Remotion anima las transiciones (Ken Burns, slide-in)
3. ElevenLabs genera narración desde el caption
4. Output: MP4 listo para subir

**Archivos:** Nuevos en `~/my-video/` + integración con content-forge via `scripts/generate-reel.mjs`

---

## Deuda técnica

| Issue | Impacto | Esfuerzo |
|-------|---------|----------|
| `app.js` tiene ~1400 líneas en un solo archivo | Mantenibilidad | Alto |
| Detección de plataformas en cliente vs servidor | Performance | Bajo |
| No hay tests automatizados | Riesgo de regresión | Medio |
| dotenv se carga lazy dentro de handlers (no en inicio) | Confuso | Bajo |
| `brand.config.json` no tiene validación de schema JSON | Errores silenciosos | Medio |
| El servidor no tiene hot-reload | DX lento | Bajo |

---

## Ideas experimentales

### Fondo generado con imagen de referencia (img2img)

WaveSpeed flux-dev soporta image-to-image. Se podría pasar una foto del personaje como referencia visual y pedirle que genere el fondo manteniendo la pose/iluminación.

### Paleta de colores extraída automáticamente

Usar Sharp para extraer la paleta dominante de la imagen generada y ajustar automáticamente los colores del overlay (acento, texto) para máxima armonía visual.

### A/B testing de headlines

Generar 2 versiones del carrusel con headlines distintos y trackear cuál tiene mejor rendimiento. El brief-architect aprende de los resultados.

### Plugin de VS Code para Content Forge

Crear una extensión que muestre el canvas del editor directamente en el panel de VS Code, sin necesitar abrir un browser.
