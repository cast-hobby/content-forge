#!/usr/bin/env node
// gen-shared-bg.mjs — Genera UNA imagen y la usa como fondo de todos los slides.
// Uso: node scripts/gen-shared-bg.mjs --dir=output/social/SLUG --prompt="..."

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadEnv({ path: join(ROOT, ".env.local") });
loadEnv({ path: join(ROOT, ".env") });

// ── Args ───────────────────────────────────────────────────────────────
const args = {};
for (const raw of process.argv.slice(2)) {
  const m = raw.match(/^--([^=]+)=(.*)$/s);
  if (m) args[m[1]] = m[2];
}

if (!args.dir || !args.prompt) {
  console.error("Uso: node scripts/gen-shared-bg.mjs --dir=output/social/SLUG --prompt=\"...\"");
  process.exit(1);
}

const dir      = args.dir.startsWith("output") ? resolve(ROOT, args.dir) : resolve(args.dir);
const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
const width    = manifest.target?.width  || 1080;
const height   = manifest.target?.height || 1350;
const gptSize  = `${Math.round(width / 64) * 64}x${Math.round(height / 64) * 64}`;

// ── Generar imagen ──────────────────────────────────────────────────────
let imgBuf;

if (process.env.WAVESPEED_API_KEY) {
  console.log("▶ Generando con WaveSpeed (flux-dev)…");
  const { generateImage } = await import("./wavespeed-client.mjs");
  imgBuf = await generateImage(args.prompt, { size: `${width}x${height}` });
  console.log("✓ Imagen recibida de WaveSpeed");

} else if (process.env.OPENAI_API_KEY) {
  console.log("▶ Generando con OpenAI gpt-image-2…");
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI();
  const r = await openai.images.generate({
    model:      "gpt-image-2",
    prompt:     args.prompt,
    size:       gptSize,
    quality:    "high",
    moderation: "low",
    n: 1,
  });
  const b64 = r?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI no devolvió imagen");
  imgBuf = Buffer.from(b64, "base64");
  console.log("✓ Imagen recibida de OpenAI");

} else {
  console.error("Necesitas WAVESPEED_API_KEY o OPENAI_API_KEY en .env.local");
  process.exit(1);
}

// ── Redimensionar al target final ───────────────────────────────────────
const resized = await sharp(imgBuf)
  .resize({ width, height, fit: "cover", position: "center" })
  .png()
  .toBuffer();

// ── Escribir en todos los slides (o solo los filtrados por --slides) ────
const rawDir = join(dir, "raw");
await mkdir(rawDir, { recursive: true });

const targetSlides = args.slides ? new Set(args.slides.split(",").map(s => s.trim())) : null;

for (const r of manifest.results) {
  if (!r.path) continue;
  if (targetSlides && !targetSlides.has(r.id)) continue;
  const slidePath = resolve(ROOT, r.path);
  await writeFile(slidePath, resized);
  const rawPath = join(rawDir, basename(slidePath));
  await writeFile(rawPath, resized);
  console.log(`  ✓ ${basename(slidePath)}`);
}

console.log(`\n✅ Fondo aplicado a ${manifest.results.length} slides.`);
console.log(`Ahora corre:`);
console.log(`  npm run compose -- --dir=${args.dir}`);
