#!/usr/bin/env node
// gen-themed-bgs.mjs — Genera fondos temáticos individuales por slide.
// Lee un JSON de configuración con prompts por slide y genera cada imagen.
// Uso: node scripts/gen-themed-bgs.mjs --config=path/to/bgs-config.json

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

const args = {};
for (const raw of process.argv.slice(2)) {
  const m = raw.match(/^--([^=]+)=(.*)$/s);
  if (m) args[m[1]] = m[2];
}

if (!args.config) {
  console.error("Uso: node scripts/gen-themed-bgs.mjs --config=drafts/bgs-config.json");
  process.exit(1);
}

const cfg = JSON.parse(await readFile(resolve(ROOT, args.config), "utf8"));
const dir = resolve(ROOT, cfg.dir);
const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
const width  = manifest.target?.width  || 1080;
const height = manifest.target?.height || 1350;
const rawDir = join(dir, "raw");
await mkdir(rawDir, { recursive: true });

// ── Seleccionar proveedor ─────────────────────────────────────────────────
let generateFn;
if (process.env.WAVESPEED_API_KEY) {
  const { generateImage } = await import("./wavespeed-client.mjs");
  generateFn = (prompt) => generateImage(prompt, { size: `${width}x${height}` });
  console.log("Proveedor: WaveSpeed (flux-dev)\n");
} else if (process.env.OPENAI_API_KEY) {
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI();
  const gptSize = `${Math.round(width/64)*64}x${Math.round(height/64)*64}`;
  generateFn = async (prompt) => {
    const r = await openai.images.generate({ model: "gpt-image-2", prompt, size: gptSize, quality: "high", moderation: "low", n: 1 });
    const b64 = r?.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI no devolvió imagen");
    return Buffer.from(b64, "base64");
  };
  console.log("Proveedor: OpenAI gpt-image-2\n");
} else {
  console.error("Necesitas WAVESPEED_API_KEY o OPENAI_API_KEY en .env.local");
  process.exit(1);
}

// ── Generar cada slide ────────────────────────────────────────────────────
for (const { id, prompt } of cfg.slides) {
  const r = manifest.results.find(r => r.id === id);
  if (!r) { console.warn(`  ⚠ No encontrado en manifest: ${id}`); continue; }

  process.stdout.write(`  ⏳ ${id} — generando...`);
  try {
    const buf     = await generateFn(prompt);
    const resized = await sharp(buf).resize({ width, height, fit: "cover", position: "center" }).png().toBuffer();

    const slidePath = resolve(ROOT, r.path);
    await writeFile(slidePath, resized);
    await writeFile(join(rawDir, basename(slidePath)), resized);
    console.log(` ✓`);
  } catch (err) {
    console.log(` ✗ ${err.message}`);
  }
}

console.log(`\n✅ Fondos generados. Corre:`);
console.log(`  npm run compose -- --dir=${cfg.dir}`);
