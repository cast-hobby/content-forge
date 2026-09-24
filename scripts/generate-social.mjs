#!/usr/bin/env node
// generate-social.mjs — Generador de imágenes sociales con pipeline de 2 fases.
//
// Fase A — Composición editorial (gpt-image-2, quality=medium):
//   gpt-image-2 genera la escena con un placeholder humano genérico.
//   Aporta composición cinematográfica, iluminación editorial y mood premium
//   sin pelear con el modelo por la cara.
//
// Fase B — Character swap (gemini-2.5-flash-image, solo si el slide lleva personaje):
//   Gemini recibe la imagen de Fase A + 2-4 refs reales del personaje +
//   prompt de swap. Reemplaza la identidad preservando composición, luz y pose.
//
// Features:
//   - Lee brand.config.json (paleta, fuentes, handle, character)
//   - Mapea aspect ratio → tamaño válido de gpt-image-2 (múltiplos de 16)
//   - Resize final con sharp al target de plataforma (1080x1350, etc.)
//   - Por slide: Fase A siempre, Fase B condicional a useChar
//   - Escribe PNGs finales en output/social/YYYYMMDD-<slug>/ + manifest.json
//     con trazabilidad por fase (gptGen y geminiSwap).
//
// Uso:
//   node scripts/generate-social.mjs \
//     --concept=hooks-reels-educativo \
//     --platform=ig-carousel \
//     --brief=drafts/20260417-hooks-reels-brief.json

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import sharp from "sharp";
import { config as loadEnv } from "dotenv";
import { loadConfig, buildPrompt, buildSwapPrompt } from "./brand-system.mjs";
import { generateImage as wavespeedGenerate } from "./wavespeed-client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadEnv({ path: join(ROOT, ".env.local") });

const MODEL_GEN = "gpt-image-2";
const MODEL_SWAP = "gemini-2.5-flash-image";
const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const GEMINI_KEY  = process.env.GEMINI_API_KEY;
const WAVESPEED_KEY = process.env.WAVESPEED_API_KEY;

// Fase A: WaveSpeed tiene prioridad (sin límites de billing), OpenAI como fallback
const PHASE_A_PROVIDER = WAVESPEED_KEY ? "wavespeed" : OPENAI_KEY ? "openai" : null;

if (!PHASE_A_PROVIDER) {
  console.error("Falta WAVESPEED_API_KEY o OPENAI_API_KEY en .env.local. Corre 'npm run setup' primero.");
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error("Falta GEMINI_API_KEY en .env.local. Corre 'npm run setup' primero.");
  process.exit(1);
}

const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;
const gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });

// ─── Plataformas ───────────────────────────────────────────────────────
// gptSize debe ser múltiplo de 16 en ambos ejes, ratio ≤ 3:1, y total pixels
// entre 655_360 y 8_294_400. Post-generación se re-escala al targetWidth/Height.
const PLATFORM_DEFAULTS = {
  "ig-carousel":   { aspectRatio: "4:5",  targetWidth: 1080, targetHeight: 1350, gptSize: "1024x1280" },
  "ig-feed":       { aspectRatio: "4:5",  targetWidth: 1080, targetHeight: 1350, gptSize: "1024x1280" },
  "ig-square":     { aspectRatio: "1:1",  targetWidth: 1080, targetHeight: 1080, gptSize: "1024x1024" },
  "reel":          { aspectRatio: "9:16", targetWidth: 1080, targetHeight: 1920, gptSize: "1088x1920" },
  "story":         { aspectRatio: "9:16", targetWidth: 1080, targetHeight: 1920, gptSize: "1088x1920" },
  "tiktok":        { aspectRatio: "9:16", targetWidth: 1080, targetHeight: 1920, gptSize: "1088x1920" },
  "youtube-short": { aspectRatio: "9:16", targetWidth: 1080, targetHeight: 1920, gptSize: "1088x1920" },
  "youtube-thumb": { aspectRatio: "16:9", targetWidth: 1280, targetHeight: 720,  gptSize: "1280x720"  },
  "linkedin":      { aspectRatio: "16:9", targetWidth: 1200, targetHeight: 628,  gptSize: "1280x720"  },
  "linkedin-pdf":  { aspectRatio: "4:5",  targetWidth: 1080, targetHeight: 1350, gptSize: "1024x1280" },
  "whatsapp":      { aspectRatio: "1:1",  targetWidth: 1080, targetHeight: 1080, gptSize: "1024x1024" },
  "x-post":        { aspectRatio: "16:9", targetWidth: 1600, targetHeight: 900,  gptSize: "1600x896"  },
  "newsletter":    { aspectRatio: "2:1",  targetWidth: 1200, targetHeight: 600,  gptSize: "1280x640"  },
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
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
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

// Keywords que indican identidad étnica/física — deben NO pasar a Phase A.
// gpt-image-2 drifta cuando recibe "olive-warm Latin man" y lo interpreta como
// caucasian/european. La identidad se aplica en Phase B vía refs.
const IDENTITY_KEYWORDS = /\b(latin|latino|latina|hispanic|colombian|mexican|mestizo|olive[- ]?warm|olive[- ]?brown|brown[- ]?skin|caucasian|european|african|asian|afro|skin[- ]?tone|pale|ivory|pinkish|tanned|silver[- ]?gray|salt[- ]?and[- ]?pepper|gray temples|gray streaks|figaro chain|silver chain|stocky|robust build|broad shoulders|mestizo colombian|maluma|sofia vergara)\b/gi;

function sanitizeHintForPhaseA(hint) {
  if (!hint) return "";
  // Keep only short phrases about pose, angle, gesture. Remove identity lines.
  const lines = String(hint).split(/[.\n]|·/).map((s) => s.trim()).filter(Boolean);
  const kept = lines.filter((line) => !IDENTITY_KEYWORDS.test(line));
  const cleaned = kept.join(". ").replace(IDENTITY_KEYWORDS, "").replace(/\s{2,}/g, " ").trim();
  return cleaned || "3/4 angle, direct gaze, confident posture";
}

function sanitizeConceptForPhaseA(concept) {
  if (!concept) return "";
  // Mantener el concepto visual pero quitar menciones étnicas/raciales que
  // confunden a gpt-image-2. El swap de Phase B aplicará la identidad real.
  return String(concept).replace(IDENTITY_KEYWORDS, "a person").replace(/\s{2,}/g, " ");
}

/**
 * Selecciona 2-4 refs de character. Heurística simple por orden.
 */
function selectRefs(characterCtx) {
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

function bufferToInlineData(buffer, mimeType = "image/png") {
  return {
    inlineData: {
      mimeType,
      data: buffer.toString("base64"),
    },
  };
}

// ─── Text QA: validator con Gemini Vision ─────────────────────────────
/**
 * Levenshtein distance normalizado en [0, 1] donde 1.0 = idéntico.
 * Insensible a mayúsculas/minúsculas y comillas curvas.
 */
function stringSimilarity(a, b) {
  const normalize = (s) => String(s || "")
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const x = normalize(a);
  const y = normalize(b);
  if (x === y) return 1;
  if (!x || !y) return 0;
  const m = x.length, n = y.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
  }
  const dist = dp[m][n];
  const maxLen = Math.max(m, n);
  return 1 - dist / maxLen;
}

/**
 * Usa Gemini 2.5 Flash vision para extraer todo el texto visible en la imagen,
 * carácter por carácter, preservando typos y duplicaciones tal como aparecen.
 * Luego compara con los textos esperados del textPayload.renderInImage.
 *
 * Retorna { ok, overallScore, results: [{expected, found, score, ok}], rawExtracted }
 */
async function validateTextInImage({ buffer, expectedTexts, slideId }) {
  if (!expectedTexts || expectedTexts.length === 0) {
    return { ok: true, overallScore: 1, results: [], skipped: true };
  }

  const prompt = [
    "You are an OCR engine. Read this image carefully and extract EVERY piece of visible",
    "rendered text, character by character, preserving accents, punctuation, capitalization",
    "and spacing EXACTLY as they appear. Do NOT fix typos, do NOT interpret, do NOT translate.",
    "If a word is broken or duplicated in the image, extract it broken or duplicated.",
    "",
    "Return ONLY a JSON object with this exact shape (no markdown, no commentary):",
    "",
    '{"texts":[{"text":"exact rendered text","position":"top-left | top-center | top-right | mid-left | mid | mid-right | bottom-left | bottom-center | bottom-right"}]}',
  ].join("\n");

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          bufferToInlineData(buffer, "image/png"),
          { text: prompt },
        ],
      }],
    });
    const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn(`  [${slideId}] Text QA: Gemini no devolvió JSON parseable — skipeo validación.`);
      return { ok: true, overallScore: 1, results: [], skipped: true, parseError: true };
    }
    const parsed = JSON.parse(match[0]);
    const extracted = Array.isArray(parsed.texts) ? parsed.texts : [];

    // Matcheamos cada esperado al mejor candidato extraído por similarity.
    const usedIdx = new Set();
    const results = expectedTexts.map((expected) => {
      let bestIdx = -1, bestScore = 0;
      extracted.forEach((t, i) => {
        if (usedIdx.has(i)) return;
        const score = stringSimilarity(expected, t.text);
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      });
      if (bestIdx >= 0) usedIdx.add(bestIdx);
      return {
        expected,
        found: bestIdx >= 0 ? extracted[bestIdx].text : null,
        score: bestScore,
        ok: bestScore >= 0.95,
      };
    });

    const overallScore = results.length ? Math.min(...results.map((r) => r.score)) : 1;
    const ok = results.every((r) => r.ok);
    return { ok, overallScore, results, extracted };
  } catch (err) {
    console.warn(`  [${slideId}] Text QA error: ${err?.message ?? err} — skipeo validación.`);
    return { ok: true, overallScore: 1, results: [], skipped: true, error: String(err) };
  }
}

/**
 * Refuerza el prompt con instrucciones críticas de fidelidad de texto.
 * Se usa en los retries tras detectar drift.
 */
function buildRetryBoostBlock(expectedTexts, previousDrift) {
  const driftLines = previousDrift
    ? previousDrift.map((r) => `    expected: "${r.expected}"\n    rendered : "${r.found || "(missing)"}"  (score ${r.score.toFixed(2)})`).join("\n")
    : "";
  return [
    "",
    "── RETRY · TEXT FIDELITY IS NOW THE #1 PRIORITY ──",
    "The previous generation corrupted at least one of the text elements.",
    "You MUST render every text element EXACTLY as specified — character by character.",
    "",
    "Authorized texts (count the words, match them literally):",
    ...expectedTexts.map((t) => `  • "${t}"  (${String(t).split(/\s+/).length} words, ${String(t).length} characters)`),
    previousDrift ? "\nPrevious drift detected:\n" + driftLines : "",
    "",
    "Rules:",
    "  - No duplicated words (e.g. do NOT write 'QUE QUE').",
    "  - No missing letters (e.g. do NOT write 'N' when it should be 'UN').",
    "  - No paraphrasing, no translating, no auto-correcting.",
    "  - If a word cannot fit at the requested size, reduce the size but keep every letter.",
    "  - Double-check each rendered word against the authorized list before finalizing.",
  ].filter(Boolean).join("\n");
}

// ─── Fase A: composición editorial con WaveSpeed (flux-dev) ────────────
async function generateCompositionWaveSpeed({ slide, prompt, gptSize, targetWidth, targetHeight }) {
  const t0 = Date.now();
  const rawBuffer = await wavespeedGenerate(prompt, { size: gptSize });
  const finalBuffer = await sharp(rawBuffer)
    .resize(targetWidth, targetHeight, { fit: "cover", position: "attention" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { buffer: finalBuffer, elapsedMs: Date.now() - t0, gptSize };
}

// ─── Fase A: composición editorial con gpt-image-2 ─────────────────────
async function generateCompositionGPT({ slide, prompt, gptSize, targetWidth, targetHeight }) {
  const t0 = Date.now();
  const response = await openai.images.generate({
    model: MODEL_GEN,
    prompt,
    size: gptSize,
    quality: "medium",
    moderation: "low",
    n: 1,
  });

  const b64 = response?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`gpt-image-2 no devolvió b64_json para ${slide.id}`);
  }

  const rawBuffer = Buffer.from(b64, "base64");
  // Resize al target final de la plataforma (gpt-image-2 devuelve gptSize).
  const finalBuffer = await sharp(rawBuffer)
    .resize(targetWidth, targetHeight, { fit: "cover", position: "attention" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const elapsedMs = Date.now() - t0;
  return { buffer: finalBuffer, elapsedMs, gptSize };
}

// ─── Fase B: character swap con Gemini + refs ──────────────────────────
async function swapCharacterGemini({ baseImageBuffer, refPaths, swapPrompt, aspectRatio, slideId }) {
  const t0 = Date.now();
  const parts = [];

  // Orden: imagen base primero (image 1), refs del personaje después (images 2+).
  parts.push(bufferToInlineData(baseImageBuffer, "image/png"));
  for (const refPath of refPaths) {
    parts.push(await imageToInlineData(refPath));
  }
  parts.push({ text: swapPrompt });

  const response = await gemini.models.generateContent({
    model: MODEL_SWAP,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio },
    },
  });

  const resParts = response?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = resParts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    console.warn(`  [${slideId}] Gemini swap no devolvió imagen — uso composición base.`);
    return { buffer: baseImageBuffer, elapsedMs: Date.now() - t0, fallback: true };
  }

  const swapBuffer = Buffer.from(imagePart.inlineData.data, "base64");
  return { buffer: swapBuffer, elapsedMs: Date.now() - t0, fallback: false };
}

// ─── Generación de un slide con validación + auto-retry ───────────────
/**
 * Wrapper sobre generateOne que:
 *   1. Genera el slide (Fase A + Fase B si aplica)
 *   2. Valida que el texto renderizado coincide con el expected (Gemini Vision)
 *   3. Si hay drift y quedan retries, re-genera con prompt reforzado
 *   4. Si persiste el drift tras los retries, marca textFallbackToOverlay:true
 *      para que compose-overlay rasterice el headline con sharp/resvg.
 */
async function generateOneWithValidation(opts, outDir, { maxRetries = 1, validate = true } = {}) {
  let result = await generateOne(opts, outDir);
  const expectedTexts = opts.textInImageEntries || [];
  if (!validate || !result.ok || expectedTexts.length === 0) return result;

  let qa = await validateTextInImage({
    buffer: await readFile(result.path),
    expectedTexts,
    slideId: opts.slide.id,
  });

  if (!qa.skipped) {
    const driftSummary = qa.results
      .filter((r) => !r.ok)
      .map((r) => `"${r.expected}" → "${r.found || "(missing)"}" (${r.score.toFixed(2)})`)
      .join(" · ");
    console.log(`  [${opts.slide.id}] Text QA: ${qa.ok ? "✓ pass" : `✗ drift — ${driftSummary}`} (score ${qa.overallScore.toFixed(2)})`);
  }

  let attempts = 0;
  let lastDrift = qa.results.filter((r) => !r.ok);
  while (!qa.ok && attempts < maxRetries) {
    attempts++;
    const boost = buildRetryBoostBlock(expectedTexts, lastDrift);
    const retryPrompt = opts.promptA + "\n" + boost;
    console.log(`  [${opts.slide.id}] → Retry ${attempts}/${maxRetries} con prompt reforzado`);
    const retryResult = await generateOne({ ...opts, promptA: retryPrompt }, outDir);
    if (!retryResult.ok) { result = retryResult; break; }
    qa = await validateTextInImage({
      buffer: await readFile(retryResult.path),
      expectedTexts,
      slideId: opts.slide.id,
    });
    if (!qa.skipped) {
      const ds = qa.results.filter((r) => !r.ok).map((r) => `"${r.expected}" → "${r.found || "(missing)"}" (${r.score.toFixed(2)})`).join(" · ");
      console.log(`  [${opts.slide.id}] Retry QA: ${qa.ok ? "✓ pass" : `✗ drift — ${ds}`} (score ${qa.overallScore.toFixed(2)})`);
    }
    result = retryResult;
    lastDrift = qa.results.filter((r) => !r.ok);
  }

  result.textQa = {
    ok: qa.ok,
    overallScore: qa.overallScore,
    retriesUsed: attempts,
    results: qa.results,
    skipped: !!qa.skipped,
  };

  if (!qa.ok) {
    result.textFallbackToOverlay = true;
    console.warn(`  [${opts.slide.id}] ⚠ Text drift persistente tras ${attempts} retry(s). El compose-overlay rasterizará el headline pixel-perfect como fallback.`);
  }

  return result;
}

// ─── Generación de un slide (orquesta Fase A + Fase B) ─────────────────
async function generateOne({ slide, promptA, platformCfg, useChar, refPaths, swapPrompt }, outDir) {
  const providerLabel = PHASE_A_PROVIDER === "wavespeed" ? `wavespeed/flux-dev, ${platformCfg.gptSize}` : `gpt-image-2, ${platformCfg.gptSize}`;
  console.log(
    `\n[${slide.id}] Fase A (${providerLabel})` +
    (useChar ? ` → Fase B (gemini swap, ${refPaths.length} refs)` : " (sin swap)")
  );

  let compositionBuffer;
  let gptElapsed = 0;
  try {
    const phaseAFn = PHASE_A_PROVIDER === "wavespeed" ? generateCompositionWaveSpeed : generateCompositionGPT;
    const a = await phaseAFn({
      slide,
      prompt: promptA,
      gptSize: platformCfg.gptSize,
      targetWidth: platformCfg.targetWidth,
      targetHeight: platformCfg.targetHeight,
    });
    compositionBuffer = a.buffer;
    gptElapsed = a.elapsedMs;
    console.log(`  Fase A OK (${(gptElapsed / 1000).toFixed(1)}s)`);
  } catch (err) {
    console.error(`  Fase A FALLÓ: ${err?.message ?? err}`);
    return { ok: false, id: slide.id, error: `phase_a: ${err?.message ?? String(err)}` };
  }

  let finalBuffer = compositionBuffer;
  let swapElapsed = 0;
  let swapFallback = false;

  if (useChar && refPaths.length > 0) {
    try {
      const b = await swapCharacterGemini({
        baseImageBuffer: compositionBuffer,
        refPaths,
        swapPrompt,
        aspectRatio: platformCfg.aspectRatio,
        slideId: slide.id,
      });
      // Gemini puede devolver un tamaño distinto; re-resize al target por seguridad.
      finalBuffer = await sharp(b.buffer)
        .resize(platformCfg.targetWidth, platformCfg.targetHeight, { fit: "cover", position: "attention" })
        .png({ compressionLevel: 9 })
        .toBuffer();
      swapElapsed = b.elapsedMs;
      swapFallback = b.fallback;
      console.log(`  Fase B ${swapFallback ? "FALLBACK (base sin swap)" : "OK"} (${(swapElapsed / 1000).toFixed(1)}s)`);
    } catch (err) {
      console.warn(`  Fase B error — uso base sin swap: ${err?.message ?? err}`);
      swapFallback = true;
    }
  }

  const outPath = join(outDir, slide.filename);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, finalBuffer);
  console.log(`  OK ${outPath} (${(finalBuffer.length / 1024).toFixed(0)} KB)`);

  return {
    ok: true,
    id: slide.id,
    path: outPath,
    usedCharacterRefs: useChar ? refPaths.length : 0,
    gptGenMs: gptElapsed,
    geminiSwapMs: swapElapsed,
    swapFallback,
  };
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
  const platformCfg = PLATFORM_DEFAULTS[platform];
  if (!platformCfg) {
    console.error(`Plataforma desconocida: ${platform}`);
    console.error(`Soportadas: ${Object.keys(PLATFORM_DEFAULTS).join(", ")}`);
    process.exit(1);
  }

  const concept = slugify(args.concept);
  const datePrefix = args.date || yyyymmdd();
  const outDir = join(ROOT, config.output.baseDir, `${datePrefix}-${concept}`);
  const aspectRatio = brief.aspectRatio || platformCfg.aspectRatio;

  // Flags CLI para el validador de texto.
  const validationEnabled = !(args["skip-validation"] === true || args["skip-validation"] === "true");
  const maxRetries = Math.max(0, Math.min(3, Number.parseInt(args["max-retries"] ?? "1", 10) || 0));

  console.log(`Batch: ${brief.images.length} imagen(es) → ${outDir}`);
  console.log(`Text QA: ${validationEnabled ? `enabled · max ${maxRetries} retry(s) por slide` : "DESHABILITADO"}`);
  console.log(`Plataforma: ${platform} · target ${platformCfg.targetWidth}x${platformCfg.targetHeight} · Fase A: ${PHASE_A_PROVIDER === "wavespeed" ? "wavespeed/flux-dev" : "gpt-image-2"} ${platformCfg.gptSize}`);
  if (characterCtx) {
    console.log(`Character mode: ${characterCtx.mode} · ${characterCtx.refs.length} refs · swap engine: ${MODEL_SWAP}`);
  }

  const batchStartedAt = Date.now();
  const results = [];

  // Fija la selección de refs UNA SOLA VEZ para todo el batch. Así todos los
  // slides con personaje usan el mismo subconjunto de fotos → máxima consistencia
  // facial entre slides del mismo carrusel (no hay rotación que pueda inducir
  // variaciones de cara entre el slide 02 y el slide 07).
  const sharedRefPaths = characterCtx ? selectRefs(characterCtx) : [];
  if (characterCtx && sharedRefPaths.length) {
    console.log(`Refs compartidas en todo el batch: ${sharedRefPaths.length} (${sharedRefPaths.map((p) => p.split(/[\\/]/).pop()).join(", ")})`);
  }

  const sceneSeed = brief.sceneSeed || null;
  if (sceneSeed) {
    console.log(`Scene seed activo: prop="${sceneSeed.recurringProp || "—"}" · mood="${sceneSeed.mood || "—"}"`);
  }

  for (const slide of brief.images) {
    const useChar =
      characterCtx &&
      (characterCtx.mode === "always" || slideRequiresCharacter(slide.concept, slide.character));

    const refPaths = useChar ? sharedRefPaths : [];

    const textPayload = slide.textPayload || null;
    const textInImageEntries = textPayload?.renderInImage
      ? [
          textPayload.renderInImage.eyebrow?.text,
          textPayload.renderInImage.headline?.text,
          textPayload.renderInImage.subhead?.text,
          textPayload.renderInImage.data_chip?.text,
        ].filter(Boolean)
      : [];
    const hasTextInImage = textInImageEntries.length > 0;

    // Phase A recibe SOLO pose/gesture (sin identity detail). El swap de Phase B
    // aplica la identidad real con las refs. Esto evita que gpt-image-2 drifte
    // interpretando "olive-warm Latin man" → caucasian/european.
    // - Si el brief trae `characterPose` (nuevo schema), es lo único que va a Phase A.
    // - Si solo hay `characterHint` legacy (con identity detail), lo sanitiza.
    const rawHint = slide.characterHint || "";
    const phaseAHint = slide.characterPose
      ? slide.characterPose
      : sanitizeHintForPhaseA(rawHint);

    const promptA = buildPrompt(config, {
      concept: sanitizeConceptForPhaseA(slide.concept || ""),
      composition: slide.composition || "",
      extra: slide.extra || "",
      character: useChar
        ? { usageHint: phaseAHint }
        : null,
      sceneSeed,
      continuity: slide.continuity || null,
      narrativeBeat: slide.narrativeBeat || null,
      textPayload,
    });

    const swapPrompt = useChar
      ? buildSwapPrompt(config, {
          characterName: characterCtx.name || "the referenced person",
          usageHint: slide.characterHint || "",
          preserveText: hasTextInImage,
          authorizedTexts: textInImageEntries,
        })
      : null;

    try {
      const res = await generateOneWithValidation(
        { slide, promptA, platformCfg, useChar, refPaths, swapPrompt, textInImageEntries },
        outDir,
        { maxRetries, validate: validationEnabled },
      );
      results.push(res);
    } catch (err) {
      console.error(`  Error en ${slide.id}: ${err?.message ?? err}`);
      results.push({ ok: false, id: slide.id, error: err?.message ?? String(err) });
    }
  }

  const batchElapsedMs = Date.now() - batchStartedAt;
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n${okCount}/${results.length} generadas en ${outDir} (${(batchElapsedMs / 1000).toFixed(1)}s total)`);

  // Propagamos dataPoints, brandsReferenced y textPayload del brief al manifest,
  // slide por slide, para que etapas posteriores (brand-overlay, copy-overlay,
  // compose-overlay) sepan qué texto ya está renderizado en la imagen vs qué
  // falta por componer en overlay tipográfico.
  const resultsWithMeta = results.map((r) => {
    const slide = brief.images.find((s) => s.id === r.id);
    if (!slide) return r;
    return {
      ...r,
      narrativeBeat: slide.narrativeBeat || null,
      continuity: slide.continuity || null,
      dataPoints: slide.dataPoints || [],
      brandsReferenced: slide.brandsReferenced || [],
      textPayload: slide.textPayload || null,
      // text QA viene desde generateOneWithValidation si aplicó.
      textQa: r.textQa || null,
      textFallbackToOverlay: r.textFallbackToOverlay || false,
    };
  });

  const qaFailed = resultsWithMeta.filter((r) => r.ok && r.textQa && !r.textQa.ok).length;
  const qaPassed = resultsWithMeta.filter((r) => r.ok && r.textQa && r.textQa.ok).length;
  const qaSkipped = resultsWithMeta.filter((r) => r.ok && r.textQa?.skipped).length;
  if (validationEnabled) {
    console.log(`Text QA resumen: ${qaPassed} pass · ${qaFailed} fallback a overlay · ${qaSkipped} skipped`);
  }

  const manifestPath = join(outDir, "manifest.json");
  await mkdir(outDir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    concept,
    platform,
    aspectRatio,
    pipeline: {
      phaseA: { provider: PHASE_A_PROVIDER, model: PHASE_A_PROVIDER === "wavespeed" ? "wavespeed-ai/flux-dev" : MODEL_GEN, size: platformCfg.gptSize },
      phaseB: { model: MODEL_SWAP, engine: "identity-swap" },
      textQa: {
        enabled: validationEnabled,
        maxRetries,
        engine: "gemini-2.5-flash-vision",
        summary: { pass: qaPassed, fallback: qaFailed, skipped: qaSkipped },
      },
    },
    target: { width: platformCfg.targetWidth, height: platformCfg.targetHeight },
    resolution: `${platformCfg.targetWidth}x${platformCfg.targetHeight}`,
    brand: config.brand.name,
    brief_source: resolve(args.brief),
    research_source: brief.researchFile ? resolve(brief.researchFile) : null,
    character_mode: characterCtx ? characterCtx.mode : "off",
    shared_refs: sharedRefPaths.map((p) => p.split(/[\\/]/).pop()),
    sceneSeed: brief.sceneSeed || null,
    batch_elapsed_ms: batchElapsedMs,
    results: resultsWithMeta,
  }, null, 2));
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err?.message ?? err);
  process.exit(1);
});
