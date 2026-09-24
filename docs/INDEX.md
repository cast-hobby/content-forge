# Documentación — Content Forge

> Estudio editorial en terminal. Carruseles y reels con calidad de agencia.

---

## Docs de usuario (setup y uso)

| Documento | Qué cubre |
|-----------|-----------|
| [getting-started.md](./getting-started.md) | Instalación, primer carrusel en 10 minutos |
| [configuring-your-brand.md](./configuring-your-brand.md) | Colores, fuentes, voz, cadencia |
| [character-consistency.md](./character-consistency.md) | Setup de personaje, refs, pipeline 2 fases |
| [writing-prompts.md](./writing-prompts.md) | Estructura de brief, sceneSeed, narrativa |
| [troubleshooting.md](./troubleshooting.md) | Errores comunes, diagnóstico |

---

## Docs técnicos (arquitectura y desarrollo)

| Documento | Qué cubre |
|-----------|-----------|
| [architecture.md](./architecture.md) | Stack, árbol de directorios, módulos clave, flujo de datos |
| [pipeline-reference.md](./pipeline-reference.md) | Los 3 pipelines (IA / tipográfico / clonado), compositor de overlays, design system |
| [agents-reference.md](./agents-reference.md) | Los 10 agentes Claude: propósito, inputs/outputs, cuándo invocarlos |
| [api-server-reference.md](./api-server-reference.md) | Todos los endpoints de localhost:4321 con body/response |
| [brand-config-reference.md](./brand-config-reference.md) | Esquema completo de brand.config.json con ejemplos |
| [wavespeed-integration.md](./wavespeed-integration.md) | API de WaveSpeed, LoRA training, troubleshooting, costos |
| [roadmap-improvements.md](./roadmap-improvements.md) | Mejoras pendientes, deuda técnica, ideas experimentales |

---

## Flujo de trabajo rápido

```
1. SETUP (una sola vez)
   npm run setup
   → brand.config.json + .env.local

2. BRIEF
   /content-forge-brief-architect "topic del carrusel"
   → brief JSON con sceneSeed y 8-10 slides

3. GENERAR IMÁGENES
   node scripts/generate-social.mjs --brief=brief.json --platform=ig-carousel
   → output/social/YYYYMMDD-slug/ con PNGs base

4. EDITAR OVERLAYS
   npm run editor  →  localhost:4321
   → Editar texto, fondos, logos por slide
   → Compose → PNGs finales

5. PUBLICAR
   /content-forge-caption-writer  →  caption.md
   /content-forge-calendar-publisher  →  entrada en calendario
```

---

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `WAVESPEED_API_KEY` | Recomendada | Generación premium con flux-dev |
| `OPENAI_API_KEY` | Alternativa | Fallback si no hay WaveSpeed |
| `GEMINI_API_KEY` | Para personaje | Character swap Fase B |
| `APIFY_API_TOKEN` | Opcional | Clone-from-URL |
| `WAVESPEED_LORA_URL` | Opcional | LoRA personal entrenado |
| `WAVESPEED_LORA_TRIGGER` | Opcional | Trigger word del LoRA |

Todas van en `.env.local` (nunca en git).

---

## Decisiones de diseño importantes

| Decisión | Razón |
|----------|-------|
| Sin fondos IA generados (solo CSS/SVG o WaveSpeed) | OpenAI Billing bloqueado, Gemini daba 404 — los fondos CSS son más rápidos, controlables y gratuitos |
| `colorScheme` determina color de texto | "light" → #1A1A1A, "dark" → #FFFFFF. Nunca hardcodear "white" |
| Sin eyebrows tipo "SLIDE X DE Y" | Distrae del copy, es eyebrow genérico sin valor editorial |
| Identidad de Alexander es rigurosa | Drift caucásico/afro/europeo es rechazado — las refs deben ser de frente, bien iluminadas |
| Mascota Claude solo en contenido sobre Claude/Anthropic | Es específica de ese contexto, no un elemento decorativo general |
| Logos y textos en cuadrantes distintos | Nunca superponer el logo AC con texto de overlay |
| Image-aware overlays | Leer cada PNG con Vision antes de posicionar overlay — usar block opaco, no scrim suave |

---

## Contribuir

El proyecto es ESM puro (Node ≥ 20). Para añadir un script nuevo:

1. Crear `scripts/mi-script.mjs` con `export function`
2. Importar con ruta relativa + extensión `.mjs`
3. Si necesita env vars, cargar `dotenv` al inicio
4. Actualizar `package.json` scripts si es un comando de usuario

Para añadir un agente Claude:

1. Crear `.claude/agents/content-forge-mi-agente.md`
2. Incluir frontmatter YAML: `name`, `description`, `model`, `tools`
3. El cuerpo del archivo son las instrucciones del sistema del agente
4. Documentar en [agents-reference.md](./agents-reference.md)
