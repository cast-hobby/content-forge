#!/usr/bin/env node
// brand-overlay.mjs — Descarga logos reales de marcas citadas en los slides
// y los compone sobre los PNGs generados.
//
// Workflow:
//   1. Lee manifest.json del batch (producido por generate-social.mjs).
//   2. Para cada slide con brandsReferenced[] no vacío:
//      a. Descarga el logo oficial vía Clearbit Logo API
//         (https://logo.clearbit.com/<domain>).
//      b. Valida que sea PNG/JPG válido y > 1 KB.
//      c. Compone con sharp sobre la posición pedida (top-left, etc.)
//         respetando clearspaceRatio del config.
//   3. Si Clearbit falla (404, timeout), fallback: renderiza el nombre de la
//      marca con tipografía neutra como chip blanco sobre fondo oscuro.
//   4. Escribe slide-XX-branded.png junto al original y un brand-overlay-manifest.json
//      con qué logos se descargaron y desde dónde.
//
// Uso:
//   node scripts/brand-overlay.mjs --dir=output/social/YYYYMMDD-<slug>
//
// Requisitos: solo sharp + @resvg/resvg-js (ya en package.json). Sin API keys.

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { loadConfig } from "./brand-system.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const CLEARBIT_BASE = "https://logo.clearbit.com";
const LOGO_DOWNLOAD_TIMEOUT_MS = 10_000;
const MIN_LOGO_BYTES = 1024;

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

function sizeForRatio(ratioName, slideWidth) {
  // Ratios como % del ancho del slide. Clampeamos para evitar logos gigantes.
  const map = { small: 0.08, medium: 0.14, large: 0.22 };
  const ratio = map[ratioName] ?? 0.12;
  const raw = Math.round(slideWidth * ratio);
  return Math.max(64, Math.min(raw, Math.round(slideWidth * 0.3)));
}

function positionFor(anchor, slideWidth, slideHeight, logoWidth, logoHeight, padding) {
  const p = padding;
  switch (anchor) {
    case "top-left":
      return { left: p, top: p };
    case "top-right":
      return { left: slideWidth - logoWidth - p, top: p };
    case "bottom-left":
      return { left: p, top: slideHeight - logoHeight - p };
    case "bottom-right":
      return { left: slideWidth - logoWidth - p, top: slideHeight - logoHeight - p };
    case "center":
      return { left: Math.round((slideWidth - logoWidth) / 2), top: Math.round((slideHeight - logoHeight) / 2) };
    default:
      return { left: slideWidth - logoWidth - p, top: slideHeight - logoHeight - p };
  }
}

async function downloadLogo(domain) {
  const url = `${CLEARBIT_BASE}/${domain}?size=512`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGO_DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Clearbit HTTP ${res.status} para ${domain}`);
    }
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length < MIN_LOGO_BYTES) {
      throw new Error(`Logo demasiado pequeño (${buf.length}B) — probable placeholder`);
    }
    return { buffer: buf, source: url };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fallback: renderiza un "chip" tipográfico con el nombre de la marca.
 * Look: pastilla blanca con borde suave, texto en sans-serif. No intenta imitar
 * el branding real — solo menciona a la marca con neutralidad editorial.
 */
async function renderBrandChip({ name, slideWidth, heightPx }) {
  const chipHeight = heightPx || Math.round(slideWidth * 0.06);
  const text = name.toUpperCase();
  const fontSize = Math.round(chipHeight * 0.42);
  const padX = Math.round(chipHeight * 0.55);
  const approxWidth = Math.round(fontSize * 0.62 * text.length) + padX * 2;
  const svg = `
<svg width="${approxWidth}" height="${chipHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" />
    </filter>
  </defs>
  <rect x="1" y="1" width="${approxWidth - 2}" height="${chipHeight - 2}"
        rx="${Math.round(chipHeight / 2)}" ry="${Math.round(chipHeight / 2)}"
        fill="rgba(255,255,255,0.94)" stroke="rgba(26,26,26,0.15)" stroke-width="1.2" />
  <text x="${approxWidth / 2}" y="${chipHeight / 2 + fontSize * 0.36}"
        font-family="Inter, Helvetica, Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="600"
        letter-spacing="0.08em"
        fill="#1A1A1A"
        text-anchor="middle">${text}</text>
</svg>
  `.trim();
  const resvg = new Resvg(svg, {
    background: "rgba(0,0,0,0)",
    fitTo: { mode: "original" },
  });
  return { buffer: resvg.render().asPng(), width: approxWidth, height: chipHeight };
}

async function composeLogoOnSlide({ slidePath, logoBuffer, anchor, logoSize, slideMeta, clearspaceRatio }) {
  const baseMeta = slideMeta || (await sharp(slidePath).metadata());
  const slideWidth = baseMeta.width;
  const slideHeight = baseMeta.height;

  const targetLogoWidth = sizeForRatio(logoSize, slideWidth);

  // Pre-escala el logo al ancho target manteniendo ratio.
  const resized = await sharp(logoBuffer)
    .resize({ width: targetLogoWidth, height: null, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  const resizedMeta = await sharp(resized).metadata();
  const padding = Math.round(slideWidth * (clearspaceRatio || 0.022));

  const { left, top } = positionFor(
    anchor,
    slideWidth,
    slideHeight,
    resizedMeta.width,
    resizedMeta.height,
    padding
  );

  const out = await sharp(slidePath)
    .composite([{ input: resized, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { buffer: out, appliedWidth: resizedMeta.width, appliedHeight: resizedMeta.height, left, top };
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (!args.dir) {
    console.error("Uso: --dir=<output/social/YYYYMMDD-<slug>>");
    process.exit(1);
  }

  const dir = resolve(args.dir);
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`No encuentro manifest.json en ${dir}. Corre primero 'npm run generate'.`);
    process.exit(1);
  }

  const config = await loadConfig();
  const clearspaceRatio = config.logo?.clearspaceRatio ?? 0.022;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  // Agrupamos descargas por dominio para no repetir hits al mismo logo.
  const downloadCache = new Map();

  const overlayResults = [];
  let logosApplied = 0;
  let logosFallback = 0;
  let slidesTouched = 0;

  for (const slideResult of manifest.results) {
    if (!slideResult.ok) continue;
    const brands = slideResult.brandsReferenced || [];
    if (brands.length === 0) continue;

    const slidePath = slideResult.path;
    if (!existsSync(slidePath)) {
      console.warn(`  [${slideResult.id}] slide no encontrado en ${slidePath} — skip`);
      continue;
    }

    let currentPath = slidePath;
    let workingBuffer = await readFile(slidePath);
    const slideMeta = await sharp(workingBuffer).metadata();

    const slideLog = { slideId: slideResult.id, brands: [] };

    for (const brand of brands) {
      const domain = (brand.domain || "").trim().toLowerCase();
      const name = brand.name || domain;
      const anchor = brand.logoPosition || "bottom-right";
      const size = brand.logoSize || "medium";

      if (!domain) {
        console.warn(`  [${slideResult.id}] brand "${name}" sin domain — uso chip tipográfico`);
        const chip = await renderBrandChip({ name, slideWidth: slideMeta.width });
        const composed = await composeLogoOnSlide({
          slidePath: currentPath,
          logoBuffer: chip.buffer,
          anchor,
          logoSize: size,
          slideMeta,
          clearspaceRatio,
        });
        workingBuffer = composed.buffer;
        const fallbackPath = join(dir, slideResult.id + "-branded.png");
        await writeFile(fallbackPath, workingBuffer);
        currentPath = fallbackPath;
        logosFallback++;
        slideLog.brands.push({ name, source: "text-chip-fallback", anchor, size, reason: "no-domain" });
        continue;
      }

      let logoBuffer = null;
      let source = null;
      let usedFallback = false;
      if (downloadCache.has(domain)) {
        const cached = downloadCache.get(domain);
        logoBuffer = cached.buffer;
        source = cached.source;
      } else {
        try {
          const dl = await downloadLogo(domain);
          logoBuffer = dl.buffer;
          source = dl.source;
          downloadCache.set(domain, dl);
        } catch (err) {
          console.warn(`  [${slideResult.id}] Clearbit falló para ${domain} (${err?.message ?? err}) — uso chip tipográfico`);
          usedFallback = true;
          const chip = await renderBrandChip({ name, slideWidth: slideMeta.width });
          logoBuffer = chip.buffer;
          source = "text-chip-fallback";
        }
      }

      const composed = await composeLogoOnSlide({
        slidePath: currentPath,
        logoBuffer,
        anchor,
        logoSize: size,
        slideMeta,
        clearspaceRatio,
      });
      workingBuffer = composed.buffer;
      await writeFile(join(dir, slideResult.id + "-branded.png"), workingBuffer);
      currentPath = join(dir, slideResult.id + "-branded.png");

      slideLog.brands.push({
        name,
        domain,
        anchor,
        size,
        source,
        usedFallback,
        appliedAt: { left: composed.left, top: composed.top, width: composed.appliedWidth, height: composed.appliedHeight },
      });

      if (usedFallback) logosFallback++;
      else logosApplied++;
    }

    slidesTouched++;
    overlayResults.push({ ...slideLog, outputPath: currentPath });
    console.log(`  [${slideResult.id}] ${slideLog.brands.length} logo(s) aplicados → ${basename(currentPath)}`);
  }

  const outPath = join(dir, "brand-overlay-manifest.json");
  await writeFile(outPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    source_manifest: manifestPath,
    slides_touched: slidesTouched,
    logos_applied_real: logosApplied,
    logos_fallback_chip: logosFallback,
    clearbit_cache_hits: downloadCache.size,
    results: overlayResults,
  }, null, 2));

  console.log(`\n✓ Brand overlay listo: ${logosApplied} logos reales + ${logosFallback} fallbacks en ${slidesTouched} slide(s).`);
  console.log(`  Manifest: ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err?.message ?? err);
  process.exit(1);
});
