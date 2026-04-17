#!/usr/bin/env node
// analyze-character.mjs — Analiza fotos del personaje con Gemini Vision.
//
// Lee brand-assets/character/*.jpg|png, las envía a Gemini para extraer:
//   - Características físicas (rasgos, complexión, estilo habitual)
//   - Variedad cubierta (ángulos, emociones, contextos)
//   - Recomendaciones de uso por mood de slide
//
// Escribe:
//   - brand-assets/character/character.md  (descripción textual usable en prompts)
//   - actualiza brand.config.json con el array de referenceImages detectadas
//
// Uso:
//   npm run analyze-character
//   node scripts/analyze-character.mjs

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { config as loadEnv } from "dotenv";
import pc from "picocolors";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONFIG_PATH = join(ROOT, "brand.config.json");
const CHARACTER_DIR = join(ROOT, "brand-assets", "character");

loadEnv({ path: join(ROOT, ".env.local") });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error(pc.red("  Falta GEMINI_API_KEY en .env.local. Corre 'npm run setup' primero."));
  process.exit(1);
}

const MODEL = "gemini-2.5-flash";

const SUPPORTED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Prompt de análisis — optimizado para extraer lo útil para generación de imágenes
const ANALYSIS_PROMPT = `
You are a character reference analyst for an editorial content pipeline.

You will receive 3-10 reference photos of the same person. Your job is to produce a concise, structured description in Spanish that a downstream image generation model (Gemini 2.5 Flash Image) can use to maintain visual consistency of this person across newly generated scenes.

Output format — respond with EXACTLY this Markdown structure, filling in from the photos:

# Character: {NAME}

## Características físicas

- **Género y edad aparente**: ...
- **Pelo**: color, longitud, textura, barba/bigote si aplica
- **Rasgos faciales distintivos**: forma de ojos/mandíbula/nariz, rasgos únicos visibles
- **Color de piel / tono**: usa descriptores neutros (clara cálida, media, dorada, oliva, morena, etc.)
- **Complexión y estatura aparente**: complexión + altura estimada si se infiere

## Estilo habitual

- **Outfit recurrente**: qué ropa aparece en las fotos (colores predominantes, estilo)
- **Accesorios**: gafas, joyas, tatuajes visibles, piercings, reloj, etc.
- **Grooming**: barba, maquillaje, cejas, cualquier característica de estilo

## Gestualidad y presencia

- **Postura recurrente**: cómo se para / sienta, qué comunica
- **Expresiones más comunes**: enumera las que aparecen (ej. "calma reflexiva", "sonrisa leve", "mirada directa")
- **Gestos de mano/cuerpo**: si aparece algo repetido (ej. "apunta con mano derecha", "brazos cruzados")

## Variedad detectada en las refs

- **Ángulos cubiertos**: frontal / 3/4 / perfil / otros
- **Emociones cubiertas**: enumera
- **Planos cubiertos**: retrato cerrado / plano medio / plano americano / cuerpo entero
- **Contextos**: interior / exterior / estudio / naturaleza

## Notas de iluminación

Qué tipo de luz favorece al personaje (ej. "luz natural lateral cálida funciona mejor que flash directo").

## Uso recomendado por mood

- **Slides educativos / autoridad**: refs número [X, Y] (expresión seria, mirada directa)
- **Slides BTS / casuales**: refs [X, Y] (sonrisa, postura relajada)
- **Portadas / hero**: refs [X, Y] (frontal o 3/4 contundente)
- **Retratos en acción**: refs [X, Y] (con gestos, trabajando, sosteniendo algo)

## Recomendaciones de refs adicionales (si aplican)

Si detectas algún vacío importante (ej. "no hay fotos de exterior", "todas las emociones son neutras"), menciónalo aquí con una frase. Si las refs son suficientemente diversas, escribe "Variedad suficiente."

---

**Importante:**
- Responde SOLO el Markdown, sin texto introductorio.
- Usa descriptores neutros y respetuosos.
- No inventes atributos que no se vean en las fotos.
- El tono es clínico-editorial (útil para un generador), no literario.
`;

async function listReferenceImages() {
  if (!existsSync(CHARACTER_DIR)) return [];
  const entries = await readdir(CHARACTER_DIR);
  const images = [];
  for (const e of entries) {
    const ext = extname(e).toLowerCase();
    if (SUPPORTED_EXTS.has(ext)) {
      const full = join(CHARACTER_DIR, e);
      const st = await stat(full);
      if (st.size > 10 * 1024) { // al menos 10KB, filtra placeholders
        images.push(full);
      }
    }
  }
  return images.sort();
}

async function imageToInlineData(path) {
  const buffer = await readFile(path);
  const ext = extname(path).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return {
    inlineData: {
      mimeType,
      data: buffer.toString("base64"),
    },
  };
}

async function main() {
  console.log(pc.bold("\n  🧬 Analyze Character · Content Forge\n"));

  if (!existsSync(CONFIG_PATH)) {
    console.error(pc.red("  No existe brand.config.json. Corre 'npm run setup' primero.\n"));
    process.exit(1);
  }

  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  if (!config.character?.enabled) {
    console.log(pc.yellow("  Character mode no está habilitado en brand.config.json."));
    console.log(pc.dim("  Edita brand.config.json → character.enabled = true para activarlo.\n"));
    process.exit(0);
  }

  const images = await listReferenceImages();
  if (images.length < 3) {
    console.error(pc.red(`  Se necesitan mínimo 3 fotos del personaje en ${CHARACTER_DIR}`));
    console.error(pc.dim(`  Encontradas: ${images.length}`));
    console.error(pc.dim(`  Ver brand-assets/character/README.md para la guía de qué subir.\n`));
    process.exit(1);
  }
  if (images.length > 10) {
    console.log(pc.yellow(`  ⚠ Encontradas ${images.length} fotos. Usaré las primeras 10 (alfabéticamente).`));
    images.length = 10;
  }

  console.log(pc.dim(`  ${images.length} fotos detectadas:`));
  images.forEach((p, i) => console.log(pc.dim(`    ${String(i + 1).padStart(2, "0")}. ${basename(p)}`)));
  console.log("");

  console.log(pc.dim("  Enviando a Gemini para análisis..."));
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const parts = [];
  for (const p of images) parts.push(await imageToInlineData(p));

  const characterName = config.character.name || "Personaje";
  const prompt = ANALYSIS_PROMPT.replace("{NAME}", characterName);
  parts.push({ text: prompt });

  let description;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
    });
    description = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!description) throw new Error("Respuesta vacía de Gemini");
  } catch (err) {
    console.error(pc.red("  Error al analizar: " + (err?.message ?? err)));
    process.exit(1);
  }

  // Escribir character.md
  const mdPath = join(CHARACTER_DIR, "character.md");
  await writeFile(mdPath, description + "\n\n---\n\n_Generado por analyze-character.mjs · " + new Date().toISOString() + "_\n", "utf8");
  console.log(pc.green(`  ✓ character.md escrito en ${mdPath}`));

  // Actualizar brand.config.json con referenceImages
  const relativeRefs = images.map((p) => "brand-assets/character/" + basename(p));
  config.character.referenceImages = relativeRefs;
  config.character.descriptionFile = "brand-assets/character/character.md";
  config.meta = {
    ...config.meta,
    characterAnalyzedAt: new Date().toISOString(),
  };

  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(pc.green(`  ✓ brand.config.json actualizado con ${relativeRefs.length} referencias`));

  console.log("");
  console.log(pc.dim("  Resumen de la descripción generada:"));
  console.log(pc.dim("  ─────────────────────────────────────"));
  const preview = description.split("\n").slice(0, 20).join("\n");
  console.log(pc.dim("  " + preview.split("\n").join("\n  ")));
  console.log(pc.dim("  ..."));
  console.log(pc.dim(`  Ver ${mdPath} para la descripción completa.`));
  console.log("");
  console.log(pc.bold(pc.green("  ✨ Character consistency lista.")));
  console.log(pc.dim(`  Cuando generes un carrusel, los slides humanos usarán tus fotos como referencia.\n`));
}

main().catch((err) => {
  console.error(pc.red("\n  Error:"), err?.message ?? err);
  process.exit(1);
});
