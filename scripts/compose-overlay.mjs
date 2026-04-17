#!/usr/bin/env node
// compose-overlay.mjs — Compositor image-aware de Content Forge.
//
// Lee:
//   - brand.config.json              (paleta, fuentes, logo paths, footer)
//   - <dir>/manifest.json            (PNGs generados por generate-social.mjs)
//   - <dir>/overlay-copy.json        (headlines/body/eyebrow/signature por slide)
//   - <dir>/layout-plan.json OPCIONAL (decisiones image-aware por slide)
//
// Produce:
//   - <dir>/slide-XX-final.png       (con overlay tipográfico + logo)
//   - <dir>/raw/slide-XX.png         (backup del base)
//   - <dir>/compose-report.json
//
// Uso:
//   node scripts/compose-overlay.mjs --dir=output/social/<folder>

import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { loadConfig } from "./brand-system.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FONTS_DIR = join(__dirname, "fonts");

// ─── Args ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else if (raw.startsWith("--")) args[raw.slice(2)] = true;
  }
  return args;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Typography helpers ────────────────────────────────────────────────
function wrapLines(text, maxCharsPerLine) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    if (!current) { current = w; continue; }
    if ((current + " " + w).length <= maxCharsPerLine) current += " " + w;
    else { lines.push(current); current = w; }
  }
  if (current) lines.push(current);
  return lines;
}

function charsPerLineForSize(safeAreaWidthPx, fontSize) {
  return Math.max(8, Math.floor(safeAreaWidthPx / (fontSize * 0.48)));
}

function autosizeHeadline(words, basePx) {
  if (words <= 3) return basePx * 1.18;
  if (words <= 5) return basePx * 1.05;
  if (words <= 7) return basePx * 1.0;
  if (words <= 9) return basePx * 0.9;
  if (words <= 12) return basePx * 0.82;
  return basePx * 0.72;
}

// ─── SVG filters ───────────────────────────────────────────────────────
function buildShadowFilter(shadow) {
  if (!shadow) return { def: "", ref: "" };
  const def = `
    <filter id="dropshadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${shadow.blur / 2}"/>
      <feOffset dx="0" dy="${shadow.offsetY || 2}" result="offsetblur"/>
      <feFlood flood-color="${shadow.color || "#000000"}" flood-opacity="${shadow.opacity ?? 0.65}"/>
      <feComposite in2="offsetblur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  return { def, ref: 'filter="url(#dropshadow)"' };
}

function buildGlowFilter(glow) {
  if (!glow) return { def: "", ref: "" };
  const def = `
    <filter id="textglow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${glow.blur / 2}"/>
      <feFlood flood-color="${glow.color}" flood-opacity="${glow.opacity ?? 0.4}"/>
      <feComposite in2="SourceAlpha" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  return { def, ref: 'filter="url(#textglow)"' };
}

function buildScrimRect({ width, height, scrim }) {
  if (!scrim) return "";
  const h = Math.round(height * (scrim.height ?? 0.4));
  const pos = scrim.position ?? "bottom";
  const gradient = scrim.gradient ?? "transparent-to-dark";
  let stops;
  if (gradient === "transparent-to-dark") {
    stops = `<stop offset="0%" stop-color="#000000" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.72"/>`;
  } else if (gradient === "dark-to-transparent") {
    stops = `<stop offset="0%" stop-color="#000000" stop-opacity="0.72"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/>`;
  } else {
    stops = `<stop offset="0%" stop-color="#000000" stop-opacity="0.55"/><stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>`;
  }
  let y = pos === "top" ? 0 : pos === "full" ? 0 : height - h;
  const hh = pos === "full" ? height : h;
  return `
    <defs>
      <linearGradient id="scrimgrad" x1="0%" y1="0%" x2="0%" y2="100%">${stops}</linearGradient>
    </defs>
    <rect x="0" y="${y}" width="${width}" height="${hh}" fill="url(#scrimgrad)"/>
  `;
}

// ─── SVG overlay builder ───────────────────────────────────────────────
function buildOverlaySvg({ width, height, overlay, layout, palette }) {
  const { headline = "", body = "", eyebrow = "", signature = "", position: posCopy = "bottom", colorScheme = "dark" } = overlay;
  const position = layout?.recommendedPosition || posCopy;
  const textPrimary = layout?.textColor || (colorScheme === "dark" ? palette.white : palette.dark);
  const textSecondary = colorScheme === "dark" ? palette.grayLight : palette.grayDark;
  const accent = palette.primary;
  const sizes = layout?.sizes || { headline: 1.0, body: 1.0, eyebrow: 1.0, signature: 1.0 };

  const SIDE_PAD = Math.round(width * 0.07);
  const safeWidth = width - SIDE_PAD * 2;
  const words = (headline || "").split(/\s+/).filter(Boolean).length;

  const HEADLINE_SIZE = Math.round(autosizeHeadline(words, Math.round(width * 0.09)) * (sizes.headline ?? 1));
  const BODY_SIZE = Math.round(width * 0.028 * (sizes.body ?? 1));
  const EYEBROW_SIZE = Math.round(width * 0.022 * (sizes.eyebrow ?? 1));
  const SIG_SIZE = Math.round(width * 0.019 * (sizes.signature ?? 1));
  const LINE_H_HEAD = HEADLINE_SIZE * 1.02;
  const LINE_H_BODY = BODY_SIZE * 1.4;

  const headlineLines = headline ? wrapLines(headline.toUpperCase(), charsPerLineForSize(safeWidth, HEADLINE_SIZE)) : [];
  const bodyLines = body ? wrapLines(body, charsPerLineForSize(safeWidth, BODY_SIZE) + 2) : [];

  const totalHeadH = headlineLines.length * LINE_H_HEAD;
  const totalBodyH = bodyLines.length * LINE_H_BODY;
  const GAP = Math.round(width * 0.03);
  const blockH = (eyebrow ? EYEBROW_SIZE + GAP * 0.5 : 0) + totalHeadH + (body ? GAP * 0.8 + totalBodyH : 0);

  let yStart;
  if (position === "top") yStart = Math.round(height * 0.08);
  else if (position === "center") yStart = Math.round(height / 2 - blockH / 2);
  else if (position === "split") yStart = Math.round(height * 0.08);
  else yStart = Math.round(height - blockH - Math.round(height * 0.11));

  const shadow = buildShadowFilter(layout?.textShadow);
  const glow = buildGlowFilter(layout?.textGlow);
  const scrimSvg = buildScrimRect({ width, height, scrim: layout?.scrim });

  const parts = [];
  let y = yStart;

  if (eyebrow) {
    parts.push(`<text x="${SIDE_PAD}" y="${y + EYEBROW_SIZE}" font-family="Inter" font-weight="600" font-size="${EYEBROW_SIZE}" fill="${accent}" letter-spacing="${EYEBROW_SIZE * 0.12}" ${shadow.ref}>${escapeXml(eyebrow.toUpperCase())}</text>`);
    y += EYEBROW_SIZE + GAP * 0.5;
  }

  for (const line of headlineLines) {
    y += HEADLINE_SIZE * 0.92;
    parts.push(`<text x="${SIDE_PAD}" y="${y}" font-family="Anton" font-weight="400" font-size="${HEADLINE_SIZE}" fill="${textPrimary}" letter-spacing="-1" ${glow.ref || shadow.ref}>${escapeXml(line)}</text>`);
    y += LINE_H_HEAD - HEADLINE_SIZE * 0.92;
  }

  if (body) {
    y += GAP * 0.6;
    for (const line of bodyLines) {
      y += BODY_SIZE;
      parts.push(`<text x="${SIDE_PAD}" y="${y}" font-family="Inter" font-weight="400" font-size="${BODY_SIZE}" fill="${textSecondary}" ${shadow.ref}>${escapeXml(line)}</text>`);
      y += LINE_H_BODY - BODY_SIZE;
    }
  }

  if (signature) {
    const sigY = height - Math.round(height * 0.04);
    parts.push(`<text x="${SIDE_PAD}" y="${sigY}" font-family="Inter" font-weight="500" font-size="${SIG_SIZE}" fill="${accent}" letter-spacing="${SIG_SIZE * 0.08}" ${shadow.ref}>${escapeXml(signature.toUpperCase())}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>${shadow.def}${glow.def}</defs>
    ${scrimSvg}
    ${parts.join("\n    ")}
  </svg>`;
}

// ─── Footer ────────────────────────────────────────────────────────────
function buildFooterSvg({ width, height, text, color, fontSize = 14 }) {
  const x = width - 16;
  const y = height - 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <text x="${x}" y="${y}" font-family="Inter" font-weight="500" font-size="${fontSize}" fill="${color}" opacity="0.55" text-anchor="end" letter-spacing="0.5">${escapeXml(text)}</text>
  </svg>`;
}

async function renderSvgToPng(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontDirs: [FONTS_DIR], loadSystemFonts: false, defaultFontFamily: "Inter" },
    background: "rgba(0,0,0,0)",
  });
  return Buffer.from(resvg.render().asPng());
}

// ─── Logo ──────────────────────────────────────────────────────────────
function pickLogoVariant(config, layout, overlay) {
  const variant = layout?.logo?.variant || overlay?.logoVariant;
  if (variant === "light" || variant === "color") return join(ROOT, config.logo.lightVariant);
  if (variant === "dark" || variant === "white") return join(ROOT, config.logo.darkVariant);
  const scheme = (overlay?.colorScheme || "dark").toLowerCase();
  const bgHint = (overlay?.backgroundHint || "").toLowerCase();
  if (scheme === "light" || bgHint.includes("cream") || bgHint.includes("light")) return join(ROOT, config.logo.lightVariant);
  return join(ROOT, config.logo.darkVariant);
}

async function applyLogo(baseBuffer, overlay, layout, config, canvasWidth, canvasHeight) {
  const show = layout?.logo?.show ?? overlay?.showLogo;
  if (!show) return baseBuffer;
  const logoPath = pickLogoVariant(config, layout, overlay);
  if (!existsSync(logoPath)) {
    console.warn(`  ⚠ Logo no encontrado: ${logoPath}`);
    return baseBuffer;
  }
  const sizeMult = layout?.logo?.size || 1.0;
  const logoTargetWidth = Math.round(canvasWidth * 0.22 * sizeMult);
  const logoResized = await sharp(logoPath).resize({ width: logoTargetWidth }).toBuffer();
  const meta = await sharp(logoResized).metadata();
  const pos = layout?.logo?.position || overlay?.logoPosition || "bottom-right";
  const clearspace = Math.round(canvasWidth * (config.logo.clearspaceRatio ?? 0.022) * 2);
  const pad = Math.max(clearspace, Math.round(canvasWidth * 0.05));
  let left, top;
  if (pos === "bottom-right") { left = canvasWidth - meta.width - pad; top = canvasHeight - meta.height - pad; }
  else if (pos === "bottom-left") { left = pad; top = canvasHeight - meta.height - pad; }
  else if (pos === "top-right") { left = canvasWidth - meta.width - pad; top = pad; }
  else if (pos === "top-left") { left = pad; top = pad; }
  else if (pos === "center") { left = Math.round((canvasWidth - meta.width) / 2); top = Math.round((canvasHeight - meta.height) / 2); }
  else { left = canvasWidth - meta.width - pad; top = canvasHeight - meta.height - pad; }
  return sharp(baseBuffer).composite([{ input: logoResized, left, top, blend: "over" }]).toBuffer();
}

// ─── Compose slide ─────────────────────────────────────────────────────
async function composeSlide(baseImagePath, overlay, layout, config, outPath) {
  const baseImg = sharp(baseImagePath);
  const meta = await baseImg.metadata();
  const { width, height } = meta;
  const hasCopy = overlay?.headline || overlay?.body || overlay?.eyebrow || overlay?.signature;
  let composed = await baseImg.toBuffer();

  if (hasCopy) {
    const svg = buildOverlaySvg({ width, height, overlay, layout, palette: config.colors });
    const overlayPng = await renderSvgToPng(svg, width);
    composed = await sharp(composed).composite([{ input: overlayPng, top: 0, left: 0, blend: "over" }]).toBuffer();
  }

  composed = await applyLogo(composed, overlay, layout, config, width, height);

  // Footer opcional
  if (config.output?.showFooter) {
    const bgIsDark = (overlay?.colorScheme || "dark") === "dark";
    const footerColor = bgIsDark ? config.colors.grayLight : config.colors.grayDark;
    const footerSvg = buildFooterSvg({ width, height, text: config.output.footerText || "made with content-forge", color: footerColor });
    const footerPng = await renderSvgToPng(footerSvg, width);
    composed = await sharp(composed).composite([{ input: footerPng, top: 0, left: 0, blend: "over" }]).toBuffer();
  }

  await writeFile(outPath, composed);
  return { ok: true, path: outPath, width, height };
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (!args.dir) {
    console.error("Uso: --dir=<output/social/YYYYMMDD-slug>");
    process.exit(1);
  }

  const dir = resolve(args.dir);
  const manifestPath = join(dir, "manifest.json");
  const overlayPath = join(dir, "overlay-copy.json");
  const layoutPath = join(dir, "layout-plan.json");
  const rawDir = join(dir, "raw");

  if (!existsSync(manifestPath)) { console.error(`No existe ${manifestPath}`); process.exit(1); }
  if (!existsSync(overlayPath)) { console.error(`No existe ${overlayPath}. Genera overlay-copy.json primero.`); process.exit(1); }

  const config = await loadConfig();
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const overlayData = JSON.parse(await readFile(overlayPath, "utf8"));
  const layoutData = existsSync(layoutPath) ? JSON.parse(await readFile(layoutPath, "utf8")) : null;

  if (layoutData) console.log(`✓ Usando layout-plan.json (image-aware mode)`);
  else console.log(`⚠ Sin layout-plan.json — defaults. Corre ugc-layout-architect primero para layout óptimo.`);

  await mkdir(rawDir, { recursive: true });
  console.log(`Composing ${manifest.results.length} slides en ${dir}`);

  const slideOverlays = overlayData.slides || {};
  const slideLayouts = layoutData?.slides || {};
  const results = [];

  for (const r of manifest.results) {
    if (!r.ok) continue;
    const fname = basename(r.path);
    const rawPath = join(rawDir, fname);
    const finalName = fname.replace(/\.png$/i, "-final.png");
    const outPath = join(dir, finalName);

    if (!existsSync(rawPath)) await copyFile(r.path, rawPath);

    const overlay = slideOverlays[r.id] || {};
    const layout = slideLayouts[r.id] || null;

    try {
      const res = await composeSlide(r.path, overlay, layout, config, outPath);
      console.log(`  ✓ ${layout ? "🎨 " : "  "}${finalName} (${res.width}×${res.height})`);
      results.push({ id: r.id, ok: true, path: outPath, layoutApplied: !!layout });
    } catch (err) {
      console.error(`  ✗ ${r.id}: ${err?.message ?? err}`);
      results.push({ id: r.id, ok: false, error: err?.message ?? String(err) });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const withLayout = results.filter((r) => r.layoutApplied).length;
  console.log(`\n${okCount}/${results.length} slides compuestos · ${withLayout} con layout image-aware`);

  await writeFile(join(dir, "compose-report.json"), JSON.stringify({
    composed_at: new Date().toISOString(),
    dir, used_layout_plan: !!layoutData,
    footer_shown: !!config.output?.showFooter,
    slides: results,
  }, null, 2));
}

main().catch((err) => { console.error("Fatal:", err?.message ?? err); process.exit(1); });
