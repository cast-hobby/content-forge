# Getting Started · Content Forge

> Guía de setup para **Mac** y **Windows**. ~20 minutos de punta a punta.

---

## Pre-requisitos

- **Node.js 20 o superior**
- **Git**
- **Claude Code** (app de escritorio)
- **OpenAI account con organización verificada** — ver [platform.openai.com/settings/organization/general](https://platform.openai.com/settings/organization/general). Es requisito obligatorio de OpenAI para usar `gpt-image-2`. Sin la verificación el pipeline de Fase A no funciona.
- **Google account** (para obtener la API key de Gemini, gratis — se usa en la Fase B de character swap)
- **Tus assets de marca**: logo en PNG (2 variantes: dark y light), y si eres marca personal, 3-10 fotos tuyas

---

## 🍎 Mac

### 1. Instala Homebrew (si no lo tienes)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Instala Node.js y Git

```bash
brew install node git
```

Verifica:
```bash
node --version    # debe mostrar v20.x o mayor
git --version
```

### 3. Instala Claude Code

Descarga desde **https://claude.ai/code**, arrastra a Aplicaciones, abre y login.

### 4. Clona Content Forge

```bash
cd ~/Documents
mkdir -p GitHub
cd GitHub
git clone https://github.com/AlexanderKast/content-forge.git
cd content-forge
```

### 5. Instala dependencias

```bash
npm install
```

(Tarda 1-2 minutos.)

### 6. Corre el wizard

```bash
npm run setup
```

Te va a hacer 10 preguntas. Ten listas:
- Nombre de tu marca + tagline
- Tu handle de Instagram
- 3 hex codes de tus colores (primario, oscuro, claro)
- Paths a tus 2 variantes del logo (colócalos en `brand-assets/`)
- Tus 2 API keys (ver paso 7)

### 7. Obtén tus API keys

**OpenAI** (Fase A — composición editorial con gpt-image-2):

1. Ve a **https://platform.openai.com/api-keys** (login o crea cuenta)
2. Verifica tu organización en **https://platform.openai.com/settings/organization/general** (obligatorio para gpt-image-2)
3. Click **"Create new secret key"** y copia (empieza con `sk-...`)
4. Añade saldo si tu cuenta está a cero. ~$5 te rinden para ~10 carruseles completos.

**Gemini** (Fase B — character swap, gratis):

1. Ve a **https://aistudio.google.com/apikey** (login con Google)
2. Click **"Create API key"**
3. Copia la key completa (empieza con `AIzaSy...` y tiene 39 chars)
4. Pega ambas cuando el wizard te las pida

### 8. (Opcional) Sube fotos del personaje

Si activaste character consistency:

1. Cuando el wizard lo pida, copia 3-10 fotos tuyas a `brand-assets/character/`
2. Presiona Enter para que las analice con Gemini Vision
3. Esto tarda ~1 min y genera `brand-assets/character/character.md`

Ver guía detallada: [`character-consistency.md`](./character-consistency.md)

### 9. Abre Claude Code

- Abre la app
- `File → Open Folder` → selecciona `~/Documents/GitHub/content-forge`
- Listo. Prueba escribir en el chat:

> *"hazme un carrusel educativo de 10 slides sobre los 3 errores más comunes de mi industria"*

---

## 🪟 Windows

### 1. Instala Node.js

1. Ve a **https://nodejs.org** y descarga **LTS** (botón verde izquierdo)
2. Doble-click al `.msi` descargado → Next, Next, Install
3. Abre **Terminal de Windows** (tecla Windows → escribe "Terminal" → Enter)
4. Verifica:
   ```bash
   node --version
   ```
   Debe mostrar `v20.x` o mayor.

### 2. Instala Git

1. Ve a **https://git-scm.com/download/win**
2. Descarga + instala con opciones default

### 3. Instala Claude Code

Descarga desde **https://claude.ai/code**, instala como app normal, abre y login.

### 4. Clona Content Forge

En Terminal:

```bash
cd Documents
mkdir GitHub
cd GitHub
git clone https://github.com/AlexanderKast/content-forge.git
cd content-forge
```

### 5. Instala dependencias

```bash
npm install
```

### 6. Corre el wizard

```bash
npm run setup
```

Ten listas las respuestas (ver paso 6 de Mac arriba).

### 7. Obtén tus API keys

**OpenAI** (Fase A):
1. Abre **https://platform.openai.com/api-keys** y crea/loguéate.
2. Verifica tu organización en **https://platform.openai.com/settings/organization/general** (obligatorio para gpt-image-2).
3. Click **"Create new secret key"** → copia (empieza con `sk-...`).
4. Añade saldo si aplica.

**Gemini** (Fase B, gratis):
1. Abre **https://aistudio.google.com/apikey** (login con Google).
2. Click **"Create API key"** → copia.
3. Pega ambas cuando el wizard te las pida.

### 8. (Opcional) Sube fotos del personaje

Copia las fotos a `Documents\GitHub\content-forge\brand-assets\character\` y presiona Enter en el wizard.

Ver [`character-consistency.md`](./character-consistency.md).

### 9. Abre Claude Code

- Abre la app
- `File → Open Folder` → selecciona `Documents\GitHub\content-forge`
- Escribe en el chat tu primer pedido.

---

## Verificación post-setup

Después del wizard deberías tener:

```
content-forge/
├── brand.config.json          ← TU configuración
├── .env.local                 ← tus API keys (OPENAI + GEMINI)
├── brand-assets/
│   ├── logo-dark.png          ← tu logo oscuro
│   ├── logo-light.png         ← tu logo claro
│   └── character/
│       ├── 01-frontal.jpg     ← si configuraste character
│       ├── ...
│       └── character.md       ← generado por analyze-character
├── output/                    ← se llena con tus contenidos
│   ├── social/
│   └── calendar/
└── drafts/                    ← briefs JSON
```

Prueba que todo está bien:

```bash
cat brand.config.json | head -20
```

Debe mostrar tu marca, tus colores, tu handle.

---

## Tu primer carrusel

1. Abre Claude Code apuntando a la carpeta
2. En el chat escribe algo específico. Ejemplos por nicho:

**Coaching / educación:**
> *"hazme un carrusel IG educativo de 10 slides sobre los 5 errores que cometen mis clientes cuando empiezan con marca personal"*

**Ecommerce skincare:**
> *"un carrusel de 8 slides mostrando el ritual de skincare nocturno con mi producto como protagonista"*

**SaaS B2B:**
> *"carrusel LinkedIn de 7 slides sobre por qué las empresas medianas fallan al implementar automatización"*

**Fitness:**
> *"un reel para TikTok con hook provocador sobre el mito de los 10K pasos"*

3. Claude Code te muestra el brief → di **"sí"**
4. Espera 5-8 minutos mientras corre el pipeline
5. Cuando termine, abre la carpeta `output/social/YYYYMMDD-<tu-slug>/` en tu explorador
6. Copia los 10 PNGs + el caption.md a Instagram

---

## ¿Problemas?

Ver [`troubleshooting.md`](./troubleshooting.md).

---

## Próximos pasos

- [`configuring-your-brand.md`](./configuring-your-brand.md) — Afinar tu configuración
- [`character-consistency.md`](./character-consistency.md) — Fotos del personaje para mejores resultados
- [`writing-prompts.md`](./writing-prompts.md) — Cómo pedirle a Claude para que salga top
