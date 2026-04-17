# Content Forge

> **Un estudio editorial en tu terminal.** Genera carruseles, reels y posts con calidad de agencia — desde tu propia marca, tu propia voz y tu propio rostro.
>
> Un regalo de **Alexander Cast** · UGC Colombia × Kreoon para la comunidad que construye en público.

---

## Por qué existe esto

La mayoría de herramientas de contenido con IA producen uno de dos extremos:

- **Plantillas genéricas** (Canva, templates Figma): se ven bonitas pero indistinguibles entre mil cuentas.
- **"Wrappers" de ChatGPT**: textos decentes con imágenes stock que no casan con tu marca.

Content Forge es otra cosa. Es el mismo pipeline editorial que uso todos los días en **UGC Colombia** — imágenes generadas con Nanobanana, tipografía aplicada con sharp + resvg, layout analizado slide por slide, voz de marca en tu idioma. Calidad de agencia boutique, sin agencia.

Lo estoy liberando porque cuando empecé no tenía algo así y me hubiera ahorrado miles de dólares en ejecución. Si tú lo aprovechas y construyes algo top, eso me hace feliz.

---

## Qué obtienes

Un solo comando (`npm run setup`) configura:

- **Tu marca** — colores, tipografía, logo con variantes
- **Tu voz** — tono configurable según cómo escribes tú
- **Tu personaje** (opcional) — 3-10 fotos tuyas y el pipeline te reconoce en cada imagen generada
- **Tu cadencia** — horarios óptimos según tu zona horaria
- **Tu API key** — usas tu propia cuenta de Google Gemini (gratis hasta cierto uso)

Y luego, desde **Claude Code** pides en español normal:

> *"Hazme un carrusel educativo sobre los 3 errores que matan un lanzamiento de producto"*

Y 5-8 minutos después tienes:
- 10 imágenes finales con overlay tipográfico + tu logo
- Caption con hashtags en tu voz
- Entry en calendario editorial con fecha y hora sugeridas
- Todo listo para copiar y pegar en Instagram

---

## Consistencia de personaje (marca personal)

Si eres marca personal, esta es la feature clave. Subes 3-10 fotos tuyas en diferentes ángulos, emociones y poses. El sistema analiza tu apariencia y las usa como referencia en cada generación.

**Resultado**: apareces tú en los slides — el mismo rostro, la misma complexión, el mismo estilo — pero en escenas nuevas, poses nuevas, contextos nuevos. Consistencia visual que construye autoridad.

El modelo mantiene ~85% de fidelidad facial. No es un LoRA entrenado (eso requiere GPU y horas), pero para construir marca personal en redes es más que suficiente.

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
┌─────────────────┐
│   Nanobanana    │  Gemini 2.5 Flash Image genera los PNGs base
│ + tus refs (si  │  (con fotos del personaje si configuraste)
│  eres personaje)│
└────────┬────────┘
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
- **Google Gemini API key** (gratis en [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
- **10-15 minutos** para el setup inicial

Funciona en **Mac** y **Windows**.

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
- **No es plug-and-play sin IA.** Necesitas Claude Code y Gemini API. Si no los tienes, configúralos primero.
- **No entrena un LoRA de tu cara.** Usa reference images en cada call (85% consistencia, no 100%). Si quieres fidelidad total, mira `docs/advanced/lora-training.md`.
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
- **Google** — por Gemini 2.5 Flash Image (Nanobanana)
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
