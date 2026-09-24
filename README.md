# Content Forge

> **Un estudio editorial en tu terminal.** Genera carruseles, reels y posts con calidad de agencia — desde tu propia marca, tu propia voz y tu propio rostro.
>
> Un regalo de **Alexander Cast** · UGC Colombia × Kreoon para la comunidad que construye en público.

---

## Por qué existe esto

La mayoría de herramientas de contenido con IA producen uno de dos extremos:

- **Plantillas genéricas** (Canva, templates Figma): se ven bonitas pero indistinguibles entre mil cuentas.
- **"Wrappers" de ChatGPT**: textos decentes con imágenes stock que no casan con tu marca.

Content Forge es otra cosa. Es el mismo pipeline editorial que uso todos los días en **UGC Colombia** — composiciones cinematográficas generadas con **gpt-image-2** (OpenAI), character swap con **Gemini 2.5 Flash Image** para consistencia de rostro, tipografía aplicada con sharp + resvg, layout analizado slide por slide, voz de marca en tu idioma. Calidad de agencia boutique, sin agencia.

Lo estoy liberando porque cuando empecé no tenía algo así y me hubiera ahorrado miles de dólares en ejecución. Si tú lo aprovechas y construyes algo top, eso me hace feliz.

---

## Qué lo hace diferente

- **Research antes de escribir** — Cuando el topic requiere datos (cifras, comparativas, casos), un agente investigador hace búsquedas web reales y produce `research-notes.md` con fuentes citadas. El brief jamás inventa una estadística.
- **Scene seed compartido** — Un solo "mundo visual" (luz, paleta, prop recurrente, mood) se hereda en los 10 slides del carrusel. No son 10 imágenes inconexas: es una sesión de fotos.
- **Narrativa continua** — Cada slide tiene un `narrativeBeat` (hook · setup · tension · insight · proof · cta) y se conecta con los vecinos. Se siente una historia, no una lista.
- **Logos de marcas reales** — Cuando mencionas Duolingo, Apple o la marca que sea, el pipeline descarga su logo oficial de Clearbit y lo compone limpio sobre el slide.
- **Character swap de 2 fases** — gpt-image-2 dirige la estética; Gemini pone tu cara con tus refs. Lo mejor de ambos modelos.

## Qué obtienes

Un solo comando (`npm run setup`) configura:

- **Tu marca** — colores, tipografía, logo con variantes
- **Tu voz** — tono configurable según cómo escribes tú
- **Tu personaje** (opcional) — 3-10 fotos tuyas y el pipeline te reconoce en cada imagen generada
- **Tu cadencia** — horarios óptimos según tu zona horaria
- **Tus API keys** — OpenAI (gpt-image-2) para la composición + Google Gemini (character swap). Ambas se configuran en el wizard.

Y luego, desde **Claude Code** pides en español normal:

> *"Hazme un carrusel educativo sobre los 3 errores que matan un lanzamiento de producto"*

Y 5-8 minutos después tienes:
- 10 imágenes finales con overlay tipográfico + tu logo
- Caption con hashtags en tu voz
- Entry en calendario editorial con fecha y hora sugeridas
- Todo listo para copiar y pegar en Instagram

---

## Consistencia de personaje (marca personal)

Si eres marca personal, esta es la feature clave. Subes 3-10 fotos tuyas en diferentes ángulos, emociones y poses. El sistema usa un **pipeline de 2 fases** para darte lo mejor de dos mundos:

1. **Fase A — Composición editorial** (gpt-image-2): genera la escena con calidad de diseñador gráfico — iluminación cinematográfica, mood premium, dirección de arte boutique. En esta fase un "placeholder" humano ocupa tu lugar.
2. **Fase B — Character swap** (Gemini 2.5 Flash Image + tus refs): reemplaza la identidad por la tuya preservando composición, luz, pose y wardrobe. Gemini ya sabe que tú eres tú gracias a las refs.

**Resultado**: apareces tú en los slides — el mismo rostro, la misma complexión, el mismo estilo — pero en escenas cinematográficas que no se ven generadas por IA plana. Consistencia visual + impacto editorial.

El pipeline apunta a ~95% de fidelidad facial (vs ~85% del enfoque single-pass). No es un LoRA entrenado (eso requiere GPU y horas), pero al desacoplar composición e identidad el resultado es mucho más limpio.

---

## Arquitectura

```
Tu pedido (lenguaje natural)
        │
        ▼
┌─────────────────┐
│ Brief Architect │  Diseña los 10 slides con pilar, hook, prompts
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Fase A — gpt-image-2│  OpenAI genera la composición editorial
│ (quality=medium)    │  con placeholder humano genérico.
└────────┬────────────┘  Aporta mood cinematográfico premium.
         │
         ▼
┌─────────────────────┐
│ Fase B — Gemini Swap│  (solo si el slide lleva personaje)
│ + tus refs          │  Reemplaza identidad usando 2-4 refs tuyas,
└────────┬────────────┘  preservando luz, pose y composición.
         │
         ▼
┌─────────────────┐
│   Visual QA     │  Valida brand compliance con Claude vision
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Layout Architect│  Analiza cada imagen: luminancia, sujeto,
│  (image-aware)  │  espacios negativos. Decide color, sombra,
└────────┬────────┘  glow, scrim, posición del logo.
         │
         ▼
┌─────────────────┐
│  Copy Overlay   │  Redacta headlines, body, eyebrow por slide
│                 │  respetando tu voz configurada
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Compositor      │  sharp + resvg + tus fuentes + tu logo →
│ (sharp + resvg) │  slide-XX-final.png
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Caption Writer  │  Caption IG en tu voz + mix 5+10+5 hashtags
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Calendar Publisher│ Fecha y hora óptimas según tu timezone/mix
└─────────────────┘
```

Cada etapa es un sub-agente Claude Code especializado. Tú solo pides contenido — el sistema lo ejecuta.

---

## Requisitos

- **Node.js 20+** ([nodejs.org](https://nodejs.org))
- **Claude Code** ([claude.ai/code](https://claude.ai/code))
- **OpenAI API key** + organización **verificada** ([platform.openai.com/api-keys](https://platform.openai.com/api-keys) · verifica la org en [settings/organization/general](https://platform.openai.com/settings/organization/general) — es obligatorio para usar gpt-image-2)
- **Google Gemini API key** (gratis en [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
- **10-15 minutos** para el setup inicial

Funciona en **Mac** y **Windows**.

### Costo aproximado por carrusel (10 slides 4:5)
- Fase A (gpt-image-2 medium): ~$0.41
- Fase B (Gemini swap, ~60% de slides con personaje): ~$0.03
- **Total: ~$0.44 por carrusel** — el equivalente a una hora de freelance te rinde para 100+ carruseles.

---

## Setup rápido

```bash
# 1. Clona el repo
git clone https://github.com/AlexanderKast/content-forge.git
cd content-forge

# 2. Instala dependencias
npm install

# 3. Corre el wizard (te hace 10 preguntas)
npm run setup

# 4. Abre Claude Code apuntando a esta carpeta
# 5. Pide tu primer carrusel en el chat
```

Guía detallada para **Mac y Windows**: [`docs/getting-started.md`](./docs/getting-started.md)

---

## Ejemplo real

En `examples/` hay 3 carruseles completos generados por el pipeline:

- `examples/personal-brand/` — marca personal con character consistency
- `examples/ecommerce-skincare/` — marca de producto
- `examples/b2b-saas/` — empresa B2B

Mira los PNGs finales + los `brand.config.json` correspondientes para ver cómo luce cada configuración.

---

## Lo que este repo NO es

- **No es un SaaS.** Todo corre en tu máquina. Tu API key, tus archivos, tu control.
- **No es plug-and-play sin IA.** Necesitas Claude Code + OpenAI (org verificada) + Gemini API. Si no los tienes, configúralos primero.
- **No entrena un LoRA de tu cara.** Usa reference images en la Fase B de swap (~95% consistencia con el pipeline de 2 fases, no 100%). Si quieres fidelidad total, mira `docs/advanced/lora-training.md`.
- **No publica automáticamente.** Tú copias los PNGs y el caption y los subes a Instagram/LinkedIn. Eso es deliberado — publicar automático rompe autenticidad y Meta lo detecta.

---

## Documentación

| Guía | Para qué |
|---|---|
| [`getting-started.md`](./docs/getting-started.md) | Setup Mac + Windows paso a paso |
| [`configuring-your-brand.md`](./docs/configuring-your-brand.md) | Detalle del wizard + editar config manualmente |
| [`character-consistency.md`](./docs/character-consistency.md) | Cómo subir las fotos del personaje para mejores resultados |
| [`writing-prompts.md`](./docs/writing-prompts.md) | Cómo pedirle contenido a Claude Code para que salga top |
| [`troubleshooting.md`](./docs/troubleshooting.md) | Errores comunes y cómo resolverlos |

---

## Contribuir

¿Encontraste un bug? ¿Quieres aportar un agente nuevo? ¿Una integración con otra plataforma?

1. Abre un issue describiendo la idea
2. Fork + branch + PR
3. Todo aporte se aprecia. Sin burocracia.

No hay CI estricto ni tests por ahora — este es un regalo optimizado para que lo uses, no para que sea enterprise-grade.

---

## Agradecimientos

Este proyecto no existiría sin:

- **Anthropic** — por Claude y Claude Code
- **OpenAI** — por gpt-image-2 (dirección artística editorial)
- **Google** — por Gemini 2.5 Flash Image (character swap)
- **@rsms** y el equipo de Inter — tipografía open-source
- **Vernon Adams** — por Anton
- **Lovell Fuller** — por sharp
- **El equipo de UGC Colombia** — Tanya, Diana, Brian, Samuel, Valentina — que validaron el pipeline con contenido real antes de que lo liberara

---

## Licencia

**MIT.** Úsalo como quieras, incluso comercialmente. La atribución es apreciada pero no obligatoria.

Ver [LICENSE](./LICENSE).

---

## Autor

**Alexander Cast**
Fundador de [UGC Colombia](https://ugccolombia.co) y [Kreoon](https://kreoon.com).
Emprendedor digital, Bogotá.

- Instagram: [@agenciaugccolombia](https://instagram.com/agenciaugccolombia)
- LinkedIn: [Alexander Kast](https://linkedin.com/in/alexanderkast)

Si Content Forge te ayuda a construir tu marca, contarme me alegra. Me escribes a founder@kreoon.com.

---

*Hecho con cuidado editorial en Bogotá · 2026*
