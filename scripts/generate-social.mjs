#!/usr/bin/env node
// generate-social.mjs — Generador de imágenes sociales con Nanobanana.
//
// Features:
//   - Lee brand.config.json (paleta, fuentes, handle, character)
//   - Por cada slide del brief construye el prompt vía buildPrompt()
//   - Si el slide requiere character consistency, inyecta 2-4 fotos de referencia
//     en el call a Gemini como inlineData → el modelo mantiene identidad
//   - Escribe PNGs en output/social/YYYYMMDD-<slug>/ + manifest.json
//
// Uso:
//   node scripts/generate-social.mjs \
//     --concept=hooks-reels-educativo \
//     --platform=ig-carousel \
//     --brief=drafts/20260417-hooks-reels-brief.json

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, basename, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { config as loadEnv } from "dotenv";
import { loadConfig, buildPrompt } from "./brand-system.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadEnv({ path: join(ROOT, ".env.local") });

const MODEL = "gemini-2.5-flash-image";
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Falta GEMINI_API_KEY en .env.local. Corre 'npm run setup' primero.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const PLATFORM_DEFAULTS = {
  "ig-carousel":   { aspectRatio: "4:5",  expectedWidth: 1080, expectedHeight: 1350 },
  "ig-feed":       { aspectRatio: "4:5",  expectedWidth: 1080, expectedHeight: 1350 },
  "ig-square":     { aspectRatio: "1:1",  expectedWidth: 1080, expectedHeight: 1080 },
  "reel":          { aspectRatio: "9:16", expectedWidth: 1080, expectedHeight: 1920 },
  "story":         { aspectRatio: "9:16", expectedWidth: 1080, expectedHeight: 1920 },
  "tiktok":        { aspectRatio: "9:16", expectedWidth: 1080, expectedHeight: 1920 },
  "youtube-short": { aspectRatio: "9:16", expectedWidth: 1080, expectedHeight: 1920 },
  "youtube-thumb": { aspectRatio: "16:9", expectedWidth: 1280, expectedHeight: 720 },
  "linkedin":      { aspectRatio: "16:9", expectedWidth: 1200, expectedHeight: 628 },
  "linkedin-pdf":  { aspectRatio: "4:5",  expectedWidth: 1080, expectedHeight: 1350 },
  "whatsapp":      { aspectRatio: "1:1",  expectedWidth: 1080, expectedHeight: 1080 },
  "x-post":        { aspectRatio: "16:9", expectedWidth: 1600, expectedHeight: 900 },
  "newsletter":    { aspectRatio: "2:1",  expectedWidth: 1200, expectedHeight: 600 },
};

// ─── Utilidades ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else if (raw.startsWith("--")) args[raw.slice(2)] = true;
  }
  return args;
}

function yyyymmdd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function loadBrief(path) {
  const raw = await readFile(resolve(path), "utf8");
  return JSON.parse(raw);
}

async function loadCharacterContext(config) {
  if (!config.character?.enabled) return null;
  const descPath = join(ROOT, config.character.descriptionFile || "brand-assets/character/character.md");
  let description = "";
  if (existsSync(descPath)) {
    description = await readFile(descPath, "utf8");
  }
  return {
    description,
    refs: (config.character.referenceImages || []).map((p) => join(ROOT, p)),
    name: config.character.name,
    maxRefs: config.character.maxRefsPerCall || 4,
    mode: config.character.useInSlides || "auto",
  };
}

/**
 * Detecta si un slide requiere character basado en keywords del concept.
 */
function slideRequiresCharacter(concept, explicitFlag) {
  if (explicitFlag === true) return true;
  if (explicitFlag === false) return false;

  const text = String(concept).toLowerCase();
  const YES_KEYWORDS = [
    "creator", "founder", "person", "woman", "man", "portrait",
    "speaking", "speaker", "holding", "working", "hands of", "self",
    "sitting", "standing", "walking", "looking at camera", "behind",
  ];
  const NO_KEYWORDS = [
    "flat lay", "abstract", "minimalist composition", "blank background",
    "only background", "bar", "checkbox", "separator line", "geometric",
    "product shot only", "still life",
  ];

  const hasNo = NO_KEYWORDS.some((k) => text.includes(k));
  if (hasNo) return false;

  const hasYes = YES_KEYWORDS.some((k) => text.includes(k));
  return hasYes;
}

/**
 * Selecciona 2-4 refs de character según el mood del slide.
 * Heurística simple: por orden, limitado al maxRefs configurado.
 */
function selectRefs(characterCtx, slideConcept) {
  if (!characterCtx?.refs?.length) return [];
  const max = Math.min(characterCtx.maxRefs, 4);
  return characterCtx.refs.slice(0, max).filter((p) => existsSync(p));
}

async function imageToInlineData(filePath) {
  const buffer = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  return {
    inlineData: {
      mimeType,
      data: buffer.toString("base64"),
    },
  };
}

// ─── Generación de un slide ────────────────────────────────────────────
async function generateOne({ slide, prompt, aspectRatio, refImageParts }, outDir) {
  console.log(`\n[${slide.id}] Generando (aspect ${aspectRatio})${refImageParts.length ? ` · ${refImageParts.length} refs` : ""}...`);

  const parts = [];
  // Refs primero, texto al final (mejor para Nanobanana).
  for (const refPart of refImageParts) parts.push(refPart);
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio },
    },
  });

  const resParts = response?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = resParts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    console.error(`  FALLO: sin imagen en respuesta para ${slide.id}`);
    return { ok: false, id: slide.id };
  }

  const buffer = Buffer.from(imagePart.inlineData.data, "base64");
  const outPath = join(outDir, slide.filename);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buffer);
  console.log(`  OK ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  return { ok: true, id: slide.id, path: outPath, usedCharacterRefs: refImageParts.length };
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (!args.concept || !args.platform || !args.brief) {
    console.error("Uso: --concept=<slug> --platform=<ig-carousel|reel|...> --brief=<path.json>");
    process.exit(1);
  }

  const config = await loadConfig();
  const brief = await loadBrief(args.brief);
  const characterCtx = await loadCharacterContext(config);

  const platform = args.platform;
  const defaults = PLATFORM_DEFAULTS[platform];
  if (!defaults) {
    console.error(`Plataforma desconocida: ${platform}`);
    process.exit(1);
  }

  const concept = slugify(args.concept);
  const datePrefix = args.date || yyyymmdd();
  const outDir = join(ROOT, config.output.baseDir, `${datePrefix}-${concept}`);
  const aspectRatio = brief.aspectRatio || defaults.aspectRatio;

  console.log(`Batch: ${brief.images.length} imagen(es) → ${outDir}`);
  console.log(`Plataforma: ${platform} · Aspect: ${aspectRatio}`);
  if (characterCtx) {
    console.log(`Character mode: ${characterCtx.mode} · ${characterCtx.refs.length} refs disponibles`);
  }

  const results = [];
  for (const slide of brief.images) {
    const useChar =
      characterCtx &&
      (characterCtx.mode === "always" || slideRequiresCharacter(slide.concept, slide.character));

    const refImageParts = [];
    if (useChar) {
      const refs = selectRefs(characterCtx, slide.concept);
      for (const r of refs) refImageParts.push(await imageToInlineData(r));
    }

    const prompt = buildPrompt(config, {
      concept: slide.concept,
      composition: slide.composition || "",
      extra: slide.extra || "",
      character: useChar ? { description: characterCtx.description, usageHint: slide.characterHint || "" } : null,
    });

    try {
      const res = await generateOne({
        slide,
        prompt,
        aspectRatio: slide.aspectRatio || aspectRatio,
        refImageParts,
      }, outDir);
      results.push(res);
    } catch (err) {
      console.error(`  Error en ${slide.id}: ${err?.message ?? err}`);
      results.push({ ok: false, id: slide.id, error: err?.message ?? String(err) });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n${okCount}/${results.length} generadas en ${outDir}`);

  const manifestPath = join(outDir, "manifest.json");
  await mkdir(outDir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    concept,
    platform,
    aspectRatio,
    model: MODEL,
    brand: config.brand.name,
    brief_source: resolve(args.brief),
    character_mode: characterCtx ? characterCtx.mode : "off",
    results,
  }, null, 2));
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err?.message ?? err);
  process.exit(1);
});
