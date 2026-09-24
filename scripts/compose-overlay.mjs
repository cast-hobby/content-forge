#!/usr/bin/env node
// compose-overlay.mjs — Compositor tipográfico de nivel diseñador v2.0
//
// Sistema de diseño profesional con:
//   - Márgenes seguros: 8% lados · 7% top · 8.2% bottom
//   - 10 tokens tipográficos (display → micro) con escala, peso, fuente, tracking y lineH
//   - Elementos ricos: chip (label-pill), accent-bar, text custom, divider
//   - overlay.elements[] para composición personalizada slide por slide
//   - Scrim cinematográfico de 4 stops
//   - Compatible v1.0 (legacy plano) y v1.1 (headline ya renderizado en imagen)
//
// Uso:
//   node scripts/compose-overlay.mjs --dir=output/social/<folder>

import { readFile, writeFile, mkdir, copyFile, unlink, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { loadConfig } from "./brand-system.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const FONTS_DIR = join(__dirname, "fonts");

// ─── Design System ─────────────────────────────────────────────────────
// Todas las medidas son relativas al canvas (ancho o alto) salvo tracking (px).

/** Safe-zone margins (ratio of canvas dimension) */
export const MARGIN = {
  x:   0.080,   // ≈ 86px @ 1080px wide
  top: 0.070,   // ≈ 95px @ 1350px tall
  bot: 0.082,   // ≈ 111px @ 1350px tall
};

/** Escala tipográfica — multiplicada por el ANCHO del canvas */
export const SCALE = {
  "display":     0.098,
  "display-sm":  0.082,
  "display-xs":  0.068,
  "heading":     0.055,
  "subheading":  0.042,
  "label":       0.0240,
  "body":        0.0318,
  "caption":     0.0240,
  "micro":       0.0190,
  "signature":   0.0240,
};

/** Font family por token */
export const FONT = {
  "display":     "Anton",
  "display-sm":  "Anton",
  "display-xs":  "Anton",
  "heading":     "Inter",
  "subheading":  "Inter",
  "label":       "Inter",
  "body":        "Inter",
  "caption":     "Inter",
  "micro":       "Inter",
  "signature":   "Inter",
};

/** Font weight por token */
export const WEIGHT = {
  "display":     "400",  // Anton solo tiene Regular
  "display-sm":  "400",
  "display-xs":  "400",
  "heading":     "700",  // Inter Bold
  "subheading":  "600",  // Inter SemiBold
  "label":       "700",  // Inter Bold
  "body":        "400",  // Inter Regular
  "caption":     "500",  // Inter Medium
  "micro":       "500",
  "signature":   "600",  // Inter SemiBold
};

/** Letter-spacing en px por token (se usa directamente en SVG) */
export const TRACKING = {
  "display":     -2.0,
  "display-sm":  -1.5,
  "display-xs":  -0.8,
  "heading":     -0.5,
  "subheading":   0,
  "label":        4.5,   // Wide tracking para eyebrows
  "body":         0,
  "caption":      0.5,
  "micro":        1.8,
  "signature":    3.5,
};

/** Multiplicador de line-height por token */
export const LINE_H = {
  "display":     0.91,  // Tight para display
  "display-sm":  0.93,
  "display-xs":  0.95,
  "heading":     1.10,
  "subheading":  1.25,
  "label":       1.20,
  "body":        1.55,
  "caption":     1.45,
  "micro":       1.30,
  "signature":   1.20,
};

/** Uppercase por defecto según token */
export const UPPERCASE_DEFAULT = {
  "display":     true,
  "display-sm":  true,
  "display-xs":  true,
  "heading":     true,
  "subheading":  false,
  "label":       true,
  "body":        false,
  "caption":     false,
  "micro":       true,
  "signature":   false,
};

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

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Color resolver ────────────────────────────────────────────────────
/**
 * Convierte un token semántico o hex directo al hex real de la paleta del usuario.
 *
 * Tokens: "white" | "dark" | "gold" | "accent" | "light" | "soft-gold"
 *         "gray" | "gray-light" | "muted" | "gray-dark" | "black" | "#RRGGBB"
 */
export function resolveColor(token, palette) {
  if (!token) return palette.white || "#FFFFFF";
  const t = String(token).toLowerCase().trim();
  const map = {
    "white":      palette.white   || "#FFFFFF",
    "primary":    palette.primary,
    "dark":       palette.dark,       // Dorado #D4AF37
    "gold":       palette.dark,
    "accent":     palette.dark,
    "light":      palette.light,      // Dorado claro #C9A84C
    "soft-gold":  palette.light,
    "gray":       palette.grayLight,
    "gray-light": palette.grayLight,
    "muted":      palette.grayLight,
    "gray-dark":  palette.grayDark,
    "black":      "#000000",
  };
  return map[t] || (String(token).startsWith("#") ? token : palette.white || "#FFFFFF");
}

/** Convierte hex a "R, G, B" para uso en rgba() de SVG fill */
export function hexToRgb(hex) {
  const m = String(hex).match(/#(.{2})(.{2})(.{2})/) || ["", "05", "05", "05"];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].join(", ");
}

// ─── Text utilities ────────────────────────────────────────────────────
export function wrapLines(text, maxCharsPerLine) {
  const paragraphs = String(text).split('\n');
  const lines = [];
  for (const para of paragraphs) {
    if (!para.trim()) { lines.push(''); continue; }
    const words = para.split(/\s+/);
    let current = '';
    for (const w of words) {
      if (!current) { current = w; continue; }
      if ((current + ' ' + w).length <= maxCharsPerLine) current += ' ' + w;
      else { lines.push(current); current = w; }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [''];
}

/** Caracteres estimados por línea en el área segura para un tamaño de fuente dado */
function charsPerLine(safeWidthPx, fontSize) {
  return Math.max(6, Math.floor(safeWidthPx / (fontSize * 0.52)));
}

/**
 * Selecciona el token tipográfico óptimo para un headline según cantidad de palabras.
 * Ajusta hacia abajo para textos más largos — el texto siempre cabe sin desbordarse.
 */
export function autoHeadingToken(wordCount) {
  if (wordCount <= 3)  return "display";
  if (wordCount <= 5)  return "display-sm";
  if (wordCount <= 8)  return "display-xs";
  return "heading";
}

/** Ancho estimado de texto plano (sin chip padding) */
export function estimateTextWidth(text, fontSize, fontType = "sans") {
  const charW = fontType === "display" ? 0.52 : 0.55;
  return Math.round(String(text).length * fontSize * charW);
}

/** Ancho estimado del chip completo incluyendo padding y tracking */
function estimateChipWidth(text, fontSize, tracking = TRACKING["label"]) {
  const padX      = Math.round(fontSize * 0.85);
  const charW     = 0.56;
  const textW     = Math.round(text.length * fontSize * charW + Math.max(0, text.length - 1) * tracking);
  return textW + padX * 2;
}

// ─── SVG filters ───────────────────────────────────────────────────────
function buildShadowFilter(shadow) {
  if (!shadow) return { def: "", ref: "" };
  const blur = shadow.blur    ?? 8;
  const oy   = shadow.offsetY ?? 2;
  const op   = shadow.opacity ?? 0.70;
  const col  = shadow.color   ?? "#000000";
  const def  = `
    <filter id="dropshadow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${(blur / 2).toFixed(1)}"/>
      <feOffset dx="0" dy="${oy}" result="offsetblur"/>
      <feFlood flood-color="${col}" flood-opacity="${op}"/>
      <feComposite in2="offsetblur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  return { def, ref: 'filter="url(#dropshadow)"' };
}

function buildGlowFilter(glow) {
  if (!glow) return { def: "", ref: "" };
  const def = `
    <filter id="textglow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${(glow.blur / 2).toFixed(1)}"/>
      <feFlood flood-color="${glow.color}" flood-opacity="${glow.opacity ?? 0.35}"/>
      <feComposite in2="SourceAlpha" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  return { def, ref: 'filter="url(#textglow)"' };
}

// ─── Scrim cinematográfico 4-stop ──────────────────────────────────────
function buildScrimRect({ width, height, scrim }) {
  if (!scrim) return "";
  const hRatio = scrim.height ?? 0.45;
  const h      = Math.round(height * hRatio);
  const pos    = scrim.position ?? "bottom";

  let stops;
  if (pos === "bottom") {
    stops = [
      `<stop offset="0%"   stop-color="#000000" stop-opacity="0"/>`,
      `<stop offset="28%"  stop-color="#000000" stop-opacity="0.20"/>`,
      `<stop offset="65%"  stop-color="#000000" stop-opacity="0.55"/>`,
      `<stop offset="100%" stop-color="#000000" stop-opacity="0.82"/>`,
    ].join("");
  } else if (pos === "top") {
    stops = [
      `<stop offset="0%"   stop-color="#000000" stop-opacity="0.80"/>`,
      `<stop offset="38%"  stop-color="#000000" stop-opacity="0.48"/>`,
      `<stop offset="78%"  stop-color="#000000" stop-opacity="0.12"/>`,
      `<stop offset="100%" stop-color="#000000" stop-opacity="0"/>`,
    ].join("");
  } else {
    const op = scrim.opacity ?? 0.50;
    stops = `<stop offset="0%" stop-color="#000000" stop-opacity="${op}"/><stop offset="100%" stop-color="#000000" stop-opacity="${op}"/>`;
  }

  const y  = pos === "top" ? 0 : pos === "full" ? 0 : height - h;
  const hh = pos === "full" ? height : h;

  return `
    <defs>
      <linearGradient id="scrimgrad" x1="0%" y1="0%" x2="0%" y2="100%">${stops}</linearGradient>
    </defs>
    <rect x="0" y="${y}" width="${width}" height="${hh}" fill="url(#scrimgrad)"/>`;
}

// ─── Element renderers ─────────────────────────────────────────────────

/**
 * CHIP — Label con fondo pill y borde.
 * Úsalo para eyebrows: "IA TOOLS", "ERROR 01", "SI PUEDE", "NO PUEDE", etc.
 * El fondo semitransparente dorado y el borde lo hacen parecer de diseñador.
 */
export function buildChip({
  x, y, text, textColor, bgColor, borderColor,
  fontSize, font, weight, tracking, radius,
}) {
  const padX  = Math.round(fontSize * 0.82);
  const padY  = Math.round(fontSize * 0.48);
  const chipH = Math.round(fontSize + padY * 2);
  const textW = Math.round(text.length * fontSize * 0.56 + Math.max(0, text.length - 1) * tracking);
  const chipW = textW + padX * 2;
  const rx    = radius ?? Math.round(chipH * 0.28);

  return [
    `<rect x="${x}" y="${y}" width="${chipW}" height="${chipH}" rx="${rx}" ry="${rx}" fill="${bgColor}" stroke="${borderColor}" stroke-width="1.4"/>`,
    `<text x="${x + padX}" y="${y + padY + Math.round(fontSize * 0.78)}" font-family="${font}" font-weight="${weight}" font-size="${fontSize}" fill="${textColor}" letter-spacing="${tracking}">${escapeXml(text)}</text>`,
  ].join("\n    ");
}

/**
 * ACCENT BAR — Línea horizontal decorativa de marca.
 * Úsalo entre eyebrow y headline, o encima del @handle.
 * El ancho corto (~6-10% del canvas) y color dorado lo hacen elegante.
 */
export function buildAccentBar({ x, y, width, thickness = 2.5, color, opacity = 1.0, radius = 1.2 }) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${thickness}" rx="${radius}" ry="${radius}" fill="${color}" opacity="${opacity}"/>`;
}

/**
 * DIVIDER — Línea horizontal extendida (separador sutil).
 * Más largo que el accent bar, menor opacidad. Para separar secciones.
 */
export function buildDivider({ x, y, width, color, opacity = 0.25, thickness = 1 }) {
  return `<line x1="${x}" y1="${y}" x2="${x + width}" y2="${y}" stroke="${color}" stroke-width="${thickness}" stroke-opacity="${opacity}"/>`;
}

/**
 * TEXT BLOCK — Renderiza texto multi-línea con el token del Design System.
 * Retorna { svgLines, nextY } para encadenar elementos.
 */
export function buildTextBlock({
  lines, x, y, scale, font, weight, color,
  tracking, lineH, shadow, glow, uppercase, align, boxWidth,
  italic = false, textDecoration = "none", bgColor = null, bgOpacity = 0.7, bgPad = 4,
}) {
  const filter   = glow?.ref || shadow?.ref || "";
  const fontStyle = italic ? 'font-style="italic"' : '';
  const textDec   = textDecoration && textDecoration !== "none" ? `text-decoration="${textDecoration}"` : '';
  const parts    = [];
  let cy = y;
  const lhPx = scale * lineH;

  const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
  const ax = align === "center" ? x + Math.round((boxWidth || 0) / 2)
           : align === "right"  ? x + (boxWidth || 0)
           : x;

  for (const line of lines) {
    cy += scale * 0.88;
    if (bgColor) {
      const rectY = Math.round(cy - scale * 0.82 - bgPad);
      const rectH = Math.round(scale * 1.0 + bgPad * 2);
      // Rect width uses boxWidth — full column for consistent highlight stripe
      // Rect X aligns with text anchor
      const rectX = align === "center"
        ? ax - Math.round((boxWidth || 0) / 2) - bgPad
        : align === "right"
        ? ax - (boxWidth || 0) - bgPad
        : x - bgPad;
      const rectW = (boxWidth || 0) + bgPad * 2;
      parts.push(`<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" fill="${bgColor}" fill-opacity="${bgOpacity}" rx="3"/>`);
    }
    const content = uppercase ? line.toUpperCase() : line;
    parts.push(
      `<text x="${ax}" y="${Math.round(cy)}" font-family="${font}" font-weight="${weight}" font-size="${Math.round(scale)}" fill="${color}" letter-spacing="${tracking}" text-anchor="${anchor}" ${fontStyle} ${textDec} ${filter}>${escapeXml(content)}</text>`
    );
    cy += lhPx - scale * 0.88;
  }
  return { svgLines: parts, nextY: cy };
}

// ─── Normalize overlay ─────────────────────────────────────────────────
/**
 * Normaliza el overlay al formato interno.
 * v1.1: tiene sub-objeto `overlay` → headline/eyebrow ya están en la imagen
 * v1.0: formato plano legacy
 */
export function normalizeOverlay(raw) {
  if (!raw) return {};
  if (raw.overlay && typeof raw.overlay === "object") {
    // Los campos pueden ser strings (v1.0) u objetos {text, color, y, ...} (v1.1+).
    // Extraemos solo el texto para el renderer legacy.
    const txt = (v) => (v && typeof v === "object" ? v.text : v) || "";
    return {
      eyebrow:        txt(raw.overlay.eyebrow),
      headline:       txt(raw.overlay.headline),
      body:           txt(raw.overlay.body),
      signature:      txt(raw.overlay.signature),
      microCopy:      txt(raw.overlay.microCopy),
      elements:       raw.overlay.elements     || [],
      position:       raw.overlay.position     || "bottom",
      colorScheme:    raw.overlay.colorScheme  || "dark",
      showLogo:       raw.overlay.showLogo     ?? true,
      logoPosition:   raw.overlay.logoPosition || "bottom-right",
      logoVariant:    raw.overlay.logoVariant,
      backgroundHint: raw.overlay.backgroundHint || "",
      navArrow:       raw.overlay.navArrow || null,
      _schema:        "v1.1",
      _inImageSummary: raw.inImageSummary || null,
    };
  }
  return { elements: raw.elements || [], ...raw, _schema: "v1.0" };
}

// ─── Pro Overlay SVG Builder ───────────────────────────────────────────
/**
 * Construye el SVG completo del overlay con el Design System v2.0.
 *
 * Orden de capas:
 *  1. Scrim (gradiente cinematográfico)
 *  2. elements[] — chips, accent-bars, dividers, texto custom
 *  3. Legacy headline / eyebrow / body (v1.0 backward compat)
 *  4. Signature @handle (con accent bar decorativo sobre ella)
 *  5. Micro-copy
 */
export function buildProOverlaySvg({ width, height, overlay, layout, palette, logoZone }) {
  const mx    = Math.round(width  * MARGIN.x);
  const mTop  = Math.round(height * MARGIN.top);
  // Si hay una franja de logos incrustada, el margen inferior no puede ser menor que esa franja
  const logoReserved = logoZone ? Math.round(height * (logoZone.h + 0.02)) : 0;
  const mBot  = Math.max(Math.round(height * MARGIN.bot), logoReserved);
  const safeW = width - mx * 2;

  const colorScheme    = overlay.colorScheme || layout?.colorScheme || "dark";
  const defaultTextCol = resolveColor(colorScheme === "dark" ? "white" : "black", palette);
  const accentCol      = resolveColor("gold", palette);

  const shadow = buildShadowFilter(layout?.textShadow || { blur: 9, offsetY: 2, opacity: 0.72 });
  const glow   = buildGlowFilter(layout?.textGlow);
  const scrim  = buildScrimRect({ width, height, scrim: layout?.scrim || { position: "bottom", height: 0.46 } });

  const defs  = [shadow.def, glow.def].filter(Boolean).join("\n");
  const parts = [];

  // Posiciones calculadas — se devuelven para sincronizar el editor (WYSIWYG)
  const computedPositions = {};

  // ── CAPA 1: Scrim ─────────────────────────────────────────────────
  parts.push(scrim);

  // ── CAPA 2: Custom elements[] ─────────────────────────────────────
  for (const el of (overlay.elements || [])) {
    const elColor = resolveColor(el.color, palette);
    const pos     = el.position || "top-left";

    // — CHIP —
    if (el.type === "chip") {
      const tok       = el.scale || "label";
      const fontSize  = Math.round(width * (SCALE[tok] || SCALE.label));
      const text      = (UPPERCASE_DEFAULT[tok] !== false) ? String(el.text || "").toUpperCase() : String(el.text || "");
      const tracking  = el.tracking ?? TRACKING[tok];
      const accentHex = resolveColor(el.color || "gold", palette);
      const bgColor   = el.bgColor   || `rgba(${hexToRgb(accentHex)}, 0.13)`;
      const border    = resolveColor(el.borderColor || "gold", palette);

      let ex = mx, ey = mTop;
      if (pos.includes("right"))  ex = width - mx - estimateChipWidth(text, fontSize, tracking);
      if (pos.includes("bottom")) ey = height - mBot - Math.round(fontSize * 2.2);
      if (pos.includes("center") && !pos.includes("left") && !pos.includes("right")) {
        ex = Math.round((width - estimateChipWidth(text, fontSize, tracking)) / 2);
      }

      parts.push(buildChip({
        x: ex, y: ey, text,
        textColor:   resolveColor(el.textColor || "gold", palette),
        bgColor, borderColor: border,
        fontSize,
        font:    FONT[tok],
        weight:  WEIGHT[tok],
        tracking,
        radius:  el.radius,
      }));
    }

    // — ACCENT BAR —
    else if (el.type === "accent-bar") {
      const barW  = Math.round(width * (el.widthRatio || 0.08));
      const thick = el.thickness || 2.5;
      const opac  = el.opacity   || 1.0;

      let bx = mx, by = mTop;
      if (pos === "bottom-signature-above") {
        by = height - mBot - Math.round(height * 0.044) - thick - 5;
      } else if (pos.includes("bottom")) {
        by = height - mBot - thick;
      } else if (pos.includes("center")) {
        by = Math.round(height / 2);
      }
      if (pos.includes("right"))  bx = width - mx - barW;
      if (pos.includes("center") && !pos.includes("left") && !pos.includes("right")) {
        bx = Math.round((width - barW) / 2);
      }

      parts.push(buildAccentBar({ x: bx, y: by, width: barW, thickness: thick, color: elColor, opacity: opac }));
    }

    // — BLOCK (rect sólido opaco para cubrir texto drift rasterizado) —
    // Usa x/y/w/h como ratios del canvas. Color: "dark"|"primary" o hex.
    // Opacity por defecto 1.0 (opaco). Para scrim semi-transparente, usa `scrim` en layout-plan.
    else if (el.type === "block") {
      const bx = Math.round((el.x ?? 0) * width);
      const by = Math.round((el.y ?? 0) * height);
      const bw = Math.round((el.w ?? 1) * width);
      const bh = Math.round((el.h ?? 0.2) * height);
      const bcol = resolveColor(el.color || "dark", palette) || "#050505";
      const bop = el.opacity ?? 1.0;
      parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${bcol}" opacity="${bop}"/>`);
    }

    // — DIVIDER —
    else if (el.type === "divider") {
      const thick  = el.thickness || 1;
      const elSafeW = el.widthRatio ? Math.round(width * el.widthRatio) : safeW;
      let dy = mTop;
      if (pos.includes("bottom")) dy = height - mBot - thick;
      else if (pos.includes("center")) dy = Math.round(height / 2);
      parts.push(buildDivider({ x: mx, y: dy, width: elSafeW, color: elColor, opacity: el.opacity || 0.25 }));
    }

    // — TEXT custom —
    else if (el.type === "text") {
      const tok     = el.scale || "caption";
      const sz      = Math.round(width * (SCALE[tok] || SCALE.caption));
      const font    = el.font   || FONT[tok];
      const wt      = el.weight || WEIGHT[tok];
      const track   = el.tracking ?? TRACKING[tok];
      const lh      = el.lineHeight ?? LINE_H[tok];
      const uc      = el.uppercase ?? UPPERCASE_DEFAULT[tok] ?? false;
      const col     = resolveColor(el.color, palette) || defaultTextCol;
      const rawText = uc ? String(el.text || "").toUpperCase() : String(el.text || "");
      const wrapped = wrapLines(rawText, charsPerLine(safeW, sz));

      let tx = mx;
      let ty = mTop;
      if (pos.includes("right"))  tx = width - mx - estimateTextWidth(rawText, sz);
      if (pos.includes("bottom")) ty = height - mBot - (wrapped.length * sz * lh);
      if (pos.includes("center") && !pos.includes("left") && !pos.includes("right")) {
        tx = Math.round(width / 2 - estimateTextWidth(rawText, sz) / 2);
      }

      buildTextBlock({
        lines: wrapped, x: tx, y: ty,
        scale: sz, font, weight: wt, color: col,
        tracking: track, lineH: lh, shadow, glow,
        uppercase: false, // ya resuelto arriba
      }).svgLines.forEach((l) => parts.push(l));
    }

    // — FREETEXT (texto libre con posición x/y exacta) —
    else if (el.type === "freetext") {
      const sz     = Math.round(width * (el.size ?? 0.040));
      const font   = el.font   || "Inter";
      const wt     = String(el.weight ?? 400);
      const track  = el.tracking ?? 0;
      const lh     = el.lineH ?? 1.4;
      const uc     = el.uppercase ?? false;
      const col    = resolveColor(el.color, palette) || "#FFFFFF";
      const rawText = uc ? String(el.text || "").toUpperCase() : String(el.text || "");
      const textW  = Math.round((el.w ?? 0.80) * width);
      const wrapped = wrapLines(rawText, charsPerLine(textW, sz));
      const tx     = Math.round((el.x ?? 0.10) * width);
      const ty     = Math.round((el.y ?? 0.10) * height);
      const align  = el.align || "left";
      const opac   = el.opacity ?? 1;
      const italic = el.italic ?? false;
      const textDec = el.textDecoration || "none";
      const elShadow = el.shadow ? { blur: 8, offsetY: 2, opacity: 0.8 } : null;
      const elShadowFilter = buildShadowFilter(elShadow);
      const bgColor = el.bg ? resolveColor(el.bg, palette) : null;
      const result = buildTextBlock({
        lines: wrapped, x: tx, y: ty, scale: sz, font, weight: wt, color: col,
        tracking: track, lineH: lh,
        shadow: elShadow ? elShadowFilter : shadow, glow,
        uppercase: false, align, boxWidth: textW,
        italic, textDecoration: textDec,
        bgColor, bgOpacity: el.bgOpacity ?? 0.7, bgPad: el.bgPad ?? 4,
      });
      const inner = result.svgLines.join("\n");
      const shadowDef = elShadow ? elShadowFilter.def : "";
      parts.push(opac < 1
        ? `<g opacity="${opac}">${shadowDef ? `<defs>${shadowDef}</defs>` : ""}${inner}</g>`
        : `${shadowDef ? `<defs>${shadowDef}</defs>` : ""}${inner}`);
    }

    // — CIRCLE / ELLIPSE —
    else if (el.type === "circle") {
      const cw  = Math.round((el.w ?? 0.40) * width);
      const ch  = Math.round((el.h ?? 0.32) * height);
      const cx  = Math.round((el.x ?? 0.30) * width) + Math.round(cw / 2);
      const cy  = Math.round((el.y ?? 0.22) * height) + Math.round(ch / 2);
      const rx  = Math.round(cw / 2);
      const ry  = Math.round(ch / 2);
      const fill   = resolveColor(el.fill || "gold", palette);
      const fillOp = el.fillOpacity ?? 0.12;
      const stroke = resolveColor(el.stroke || el.fill || "gold", palette);
      const sw     = el.strokeWidth ?? 2;
      const opac   = el.opacity ?? 1;
      parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" fill-opacity="${fillOp}" stroke="${stroke}" stroke-width="${sw}" opacity="${opac}"/>`);
    }

    // — LINE —
    else if (el.type === "line") {
      const x1   = Math.round((el.x ?? 0.08) * width);
      const y1   = Math.round((el.y ?? 0.50) * height);
      const len  = Math.round((el.length ?? 0.84) * width);
      const ang  = (el.angle ?? 0) * Math.PI / 180;
      const x2   = Math.round(x1 + len * Math.cos(ang));
      const y2   = Math.round(y1 + len * Math.sin(ang));
      const col  = resolveColor(el.color || "gold", palette);
      const thick = el.thickness ?? 2;
      const opac  = el.opacity ?? 0.8;
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${thick}" opacity="${opac}" stroke-linecap="round"/>`);
    }

    // — NUMBERBADGE (número decorativo grande) —
    else if (el.type === "numberbadge") {
      const sz   = Math.round(width * (el.size ?? 0.13));
      const col  = resolveColor(el.color || "gold", palette);
      const tx   = Math.round((el.x ?? 0.08) * width);
      const ty   = Math.round((el.y ?? 0.08) * height) + sz;  // baseline
      const opac = el.opacity ?? 0.15;
      const text = String(el.number ?? "01");
      parts.push(`<text x="${tx}" y="${ty}" font-family="Anton, sans-serif" font-size="${sz}" fill="${col}" opacity="${opac}" letter-spacing="-2" font-weight="400">${text}</text>`);
    }

    // — QUOTE (cita con barra lateral) —
    else if (el.type === "quote") {
      const sz   = Math.round(width * (el.size ?? 0.032));
      const font = el.font || "Inter";
      const wt   = String(el.weight ?? 400);
      const lh   = el.lineH ?? 1.55;
      const col  = resolveColor(el.color || "white", palette) || "#FFFFFF";
      const barCol = resolveColor(el.barColor || "gold", palette);
      const barW   = el.barWidth ?? 3;
      const tx   = Math.round((el.x ?? 0.10) * width);
      const ty   = Math.round((el.y ?? 0.40) * height);
      const textW = Math.round((el.w ?? 0.76) * width);
      const opac = el.opacity ?? 1;
      const rawText = el.text || "Cita";
      const wrapped = wrapLines(rawText, charsPerLine(textW - barW - 12, sz));
      const totalH = Math.round(wrapped.length * sz * lh);
      // Barra vertical
      parts.push(`<rect x="${tx}" y="${ty}" width="${barW}" height="${totalH}" fill="${barCol}" opacity="${opac}"/>`);
      // Texto desplazado a la derecha de la barra
      const textX = tx + barW + 12;
      const result = buildTextBlock({
        lines: wrapped, x: textX, y: ty, scale: sz, font, weight: wt, color: col,
        tracking: 0, lineH: lh, shadow, glow, uppercase: false, align: "left", boxWidth: textW - barW - 12,
      });
      const inner = result.svgLines.join("\n");
      parts.push(opac < 1 ? `<g opacity="${opac}">${inner}</g>` : inner);
    }

    // — RICHTEXT (tipografía mixta con runs[]) —
    else if (el.type === "richtext") {
      const runs  = el.runs || [];
      const tx    = Math.round((el.x ?? 0.08) * width);
      const lhMul = el.lineH ?? 1.5;
      const opac  = el.opacity ?? 1;
      const textW = Math.round((el.w ?? 0.84) * width);
      const runParts = [];
      let cy = Math.round((el.y ?? 0.20) * height);
      for (const run of runs) {
        const sz    = Math.round(width * (run.size ?? 0.04));
        const font  = run.font || "Inter";
        const wt    = String(run.weight ?? 400);
        const track = run.tracking ?? 0;
        const lh    = run.lineH ?? lhMul;
        const uc    = run.uppercase ?? false;
        const col   = resolveColor(run.color || "white", palette) || "#FFFFFF";
        const italic = run.italic ?? false;
        const textDec = run.textDecoration || "none";
        const bgColor = run.bg ? resolveColor(run.bg, palette) : null;
        const rawText = uc ? String(run.text || "").toUpperCase() : String(run.text || "");
        const wrapped = wrapLines(rawText, charsPerLine(textW, sz));
        const result = buildTextBlock({
          lines: wrapped, x: tx, y: cy, scale: sz, font, weight: wt, color: col,
          tracking: track, lineH: lh, shadow, glow, uppercase: false, align: run.align || "left", boxWidth: textW,
          italic, textDecoration: textDec,
          bgColor, bgOpacity: run.bgOpacity ?? 0.7, bgPad: run.bgPad ?? 4,
        });
        result.svgLines.forEach(l => runParts.push(l));
        cy = result.nextY + Math.round((run.gapAfter ?? 0) * height);
      }
      const inner = runParts.join("\n");
      parts.push(opac < 1 ? `<g opacity="${opac}">${inner}</g>` : inner);
    }
  }

  // ── CAPA 3: Legacy headline / eyebrow / body (v1.0) ───────────────
  const { headline = "", body = "", eyebrow = "", signature = "", microCopy = "" } = overlay;
  const lSizes    = layout?.sizes || {};
  const posHint   = layout?.recommendedPosition || overlay.position || "bottom";

  if (eyebrow || headline || body) {
    const headWords = (headline || "").split(/\s+/).filter(Boolean).length;
    const headTok   = autoHeadingToken(headWords);
    const GAP       = Math.round(width * 0.030);

    // Tamaños: override del editor (ratio 0-0.2) o token por defecto
    const headSz    = overlay.headline_size != null
      ? Math.round(width * overlay.headline_size)
      : Math.round(width * SCALE[headTok] * (lSizes.headline ?? 1));
    const bodySz    = overlay.body_size != null
      ? Math.round(width * overlay.body_size)
      : Math.round(width * SCALE["body"] * (lSizes.body ?? 1));
    const eyebrowSz = overlay.eyebrow_size != null
      ? Math.round(width * overlay.eyebrow_size)
      : Math.round(width * SCALE["label"] * (lSizes.eyebrow ?? 1));

    // Fuente/estilo: override del editor o token por defecto
    const headFont     = overlay.headline_font     || FONT[headTok];
    const headWeight   = overlay.headline_weight   ?? WEIGHT[headTok];
    const headTracking = overlay.headline_tracking ?? TRACKING[headTok];
    const headLineH    = LINE_H[headTok];
    const headCase     = overlay.headline_case ?? (UPPERCASE_DEFAULT[headTok] ? "upper" : "normal");
    const headText     = headCase === "upper" ? headline.toUpperCase() : headline;

    const bodyFont     = overlay.body_font     || FONT["body"];
    const bodyWeight   = overlay.body_weight   ?? WEIGHT["body"];
    const bodyTracking = overlay.body_tracking ?? TRACKING["body"];
    const bodyColToken = overlay.body_color ? resolveColor(overlay.body_color, palette) : resolveColor("gray", palette);
    const bodyCase     = overlay.body_case || "normal";
    const bodyText     = bodyCase === "upper" ? (body || "").toUpperCase() : (body || "");

    // FREE MODE: si algún campo tiene _pos del editor, cada elemento va a su posición exacta
    const hasPosOverride = overlay.headline_pos || overlay.body_pos || overlay.eyebrow_pos;

    if (hasPosOverride) {
      if (eyebrow) {
        const ep = overlay.eyebrow_pos || {};
        const ex = Math.round((ep.x ?? MARGIN.x) * width);
        const ey = Math.round((ep.y ?? MARGIN.top) * height);
        parts.push(buildChip({
          x: ex, y: ey, text: eyebrow.toUpperCase(),
          textColor: accentCol, bgColor: `rgba(${hexToRgb(accentCol)}, 0.13)`, borderColor: accentCol,
          fontSize: eyebrowSz, font: FONT["label"], weight: WEIGHT["label"], tracking: TRACKING["label"],
        }));
        computedPositions.eyebrow_pos = { x: ex / width, y: ey / height, w: ep.w ?? safeW / width };
      }

      if (headline) {
        const hp  = overlay.headline_pos || {};
        const hx  = Math.round((hp.x ?? MARGIN.x) * width);
        const hy  = Math.round((hp.y ?? MARGIN.top) * height);
        const hw  = Math.round((hp.w ?? 0.88) * width);
        const col = resolveColor(overlay.headline_color, palette) || defaultTextCol;
        const headLines = wrapLines(headText, charsPerLine(hw, headSz));
        const headAlign = overlay.headline_align || "left";
        const res = buildTextBlock({ lines: headLines, x: hx, y: hy, scale: headSz, font: headFont, weight: headWeight, color: col, tracking: headTracking, lineH: headLineH, shadow, glow, uppercase: false, align: headAlign, boxWidth: hw, italic: !!overlay.headline_italic, textDecoration: overlay.headline_textDecoration || "none", bgColor: overlay.headline_bg ? resolveColor(overlay.headline_bg, palette) : null, bgOpacity: overlay.headline_bgOpacity ?? 0.7, bgPad: overlay.headline_bgPad ?? 4 });
        res.svgLines.forEach(l => parts.push(l));
        computedPositions.headline_pos = { x: hx / width, y: hy / height, w: hw / width };
      }

      if (body) {
        const bp  = overlay.body_pos || {};
        const bx  = Math.round((bp.x ?? MARGIN.x) * width);
        const by  = Math.round((bp.y ?? 0.68) * height);
        const bw  = Math.round((bp.w ?? 0.80) * width);
        const bodyLines = wrapLines(bodyText, charsPerLine(bw, bodySz) + 2);
        const bodyAlign = overlay.body_align || "left";
        const res = buildTextBlock({ lines: bodyLines, x: bx, y: by, scale: bodySz, font: bodyFont, weight: bodyWeight, color: bodyColToken, tracking: bodyTracking, lineH: LINE_H["body"], shadow, glow: null, uppercase: false, align: bodyAlign, boxWidth: bw, italic: !!overlay.body_italic, textDecoration: overlay.body_textDecoration || "none", bgColor: overlay.body_bg ? resolveColor(overlay.body_bg, palette) : null, bgOpacity: overlay.body_bgOpacity ?? 0.7, bgPad: overlay.body_bgPad ?? 4 });
        res.svgLines.forEach(l => parts.push(l));
        computedPositions.body_pos = { x: bx / width, y: by / height, w: bw / width };
      }

    } else {
      // BLOCK MODE: algoritmo de apilado original
      const headLines = headline ? wrapLines(headText, charsPerLine(safeW, headSz)) : [];
      const bodyLines = body     ? wrapLines(bodyText, charsPerLine(safeW, bodySz) + 2) : [];

      const eyebrowChipH = eyebrowSz + Math.round(eyebrowSz * 0.96) + GAP * 0.7;
      const headBlockH   = headLines.length * headSz * headLineH;
      const bodyBlockH   = body ? GAP * 0.6 + bodyLines.length * bodySz * LINE_H["body"] : 0;
      const totalBlockH  = (eyebrow ? eyebrowChipH : 0) + headBlockH + bodyBlockH;

      const sigSpace = (signature || microCopy) ? Math.round(height * 0.050) : 0;

      let yStart;
      if (posHint === "top")         yStart = mTop;
      else if (posHint === "center") yStart = Math.round(height / 2 - totalBlockH / 2);
      else                           yStart = Math.round(height - totalBlockH - mBot - sigSpace);

      let y = yStart;

      if (eyebrow) {
        parts.push(buildChip({
          x: mx, y, text: eyebrow.toUpperCase(),
          textColor: accentCol, bgColor: `rgba(${hexToRgb(accentCol)}, 0.13)`, borderColor: accentCol,
          fontSize: eyebrowSz, font: FONT["label"], weight: WEIGHT["label"], tracking: TRACKING["label"],
        }));
        computedPositions.eyebrow_pos = { x: mx / width, y: y / height, w: safeW / width };
        y += eyebrowSz + Math.round(eyebrowSz * 0.96) + GAP * 0.6;
      }

      if (eyebrow && headline) {
        parts.push(buildAccentBar({ x: mx, y: y - GAP * 0.4, width: Math.round(width * 0.055), thickness: 2.5, color: accentCol, opacity: 0.85 }));
      }

      if (headline) {
        const headAlign = overlay.headline_align || "left";
        const headColBlock = resolveColor(overlay.headline_color, palette) || defaultTextCol;
        const res = buildTextBlock({ lines: headLines, x: mx, y, scale: headSz, font: headFont, weight: headWeight, color: headColBlock, tracking: headTracking, lineH: headLineH, shadow, glow, uppercase: false, align: headAlign, boxWidth: safeW, italic: !!overlay.headline_italic, textDecoration: overlay.headline_textDecoration || "none", bgColor: overlay.headline_bg ? resolveColor(overlay.headline_bg, palette) : null, bgOpacity: overlay.headline_bgOpacity ?? 0.7, bgPad: overlay.headline_bgPad ?? 4 });
        res.svgLines.forEach(l => parts.push(l));
        computedPositions.headline_pos = { x: mx / width, y: y / height, w: safeW / width };
        y = res.nextY + GAP * 0.45;
      }

      if (body) {
        y += GAP * 0.3;
        const bodyAlign = overlay.body_align || "left";
        const res = buildTextBlock({ lines: bodyLines, x: mx, y, scale: bodySz, font: bodyFont, weight: bodyWeight, color: bodyColToken, tracking: bodyTracking, lineH: LINE_H["body"], shadow, glow: null, uppercase: false, align: bodyAlign, boxWidth: safeW, italic: !!overlay.body_italic, textDecoration: overlay.body_textDecoration || "none", bgColor: overlay.body_bg ? resolveColor(overlay.body_bg, palette) : null, bgOpacity: overlay.body_bgOpacity ?? 0.7, bgPad: overlay.body_bgPad ?? 4 });
        res.svgLines.forEach(l => parts.push(l));
        computedPositions.body_pos = { x: mx / width, y: y / height, w: safeW / width };
      }
    }
  }

  // ── CAPA 4: Signature @handle ──────────────────────────────────────
  const sigSzBase = overlay.signature_size != null
    ? Math.round(width * overlay.signature_size)
    : Math.round(width * SCALE["signature"] * (lSizes?.signature ?? 1));

  if (signature) {
    const sigFont     = overlay.signature_font     || FONT["signature"];
    const sigWeight   = overlay.signature_weight   ?? WEIGHT["signature"];
    const sigTracking = overlay.signature_tracking ?? TRACKING["signature"];
    const sigCol      = resolveColor(overlay.signature_color, palette) || accentCol;
    const sigCase     = overlay.signature_case || "normal";
    const sigText     = sigCase === "upper" ? signature.toUpperCase() : signature;
    const sigAlign    = overlay.signature_align || "left";
    const sp          = overlay.signature_pos;
    const sigX_base   = sp?.x != null ? Math.round(sp.x * width) : mx;
    const sigW_avail  = sp?.w != null ? Math.round(sp.w * width) : Math.round(width * 0.5);
    const sigY        = sp?.y != null ? Math.round(sp.y * height) : height - mBot;
    computedPositions.signature_pos = { x: sigX_base / width, y: sigY / height, w: sigW_avail / width };

    let sigRenderX, sigAnchor;
    if (sigAlign === "center") { sigRenderX = sigX_base + Math.round(sigW_avail / 2); sigAnchor = "middle"; }
    else if (sigAlign === "right") { sigRenderX = sigX_base + sigW_avail; sigAnchor = "end"; }
    else { sigRenderX = sigX_base; sigAnchor = "start"; }

    const barY = microCopy ? sigY - sigSzBase * 0.9 : sigY - sigSzBase * 2.3;
    parts.push(buildAccentBar({ x: sigX_base, y: barY, width: Math.round(width * 0.057), thickness: 2.5, color: accentCol, opacity: 1.0 }));
    parts.push(
      `<text x="${sigRenderX}" y="${sigY}" font-family="${sigFont}" font-weight="${sigWeight}" font-size="${sigSzBase}" fill="${sigCol}" letter-spacing="${sigTracking}" text-anchor="${sigAnchor}" ${overlay.signature_italic ? 'font-style="italic"' : ''} ${shadow.ref}>${escapeXml(sigText)}</text>`
    );
  }

  // ── CAPA 5: Micro-copy ────────────────────────────────────────────
  if (microCopy) {
    const mcSz       = overlay.microCopy_size != null
      ? Math.round(width * overlay.microCopy_size)
      : Math.round(width * SCALE["micro"]);
    const mcFont     = overlay.microCopy_font     || FONT["micro"];
    const mcWeight   = overlay.microCopy_weight   ?? WEIGHT["micro"];
    const mcTracking = overlay.microCopy_tracking ?? TRACKING["micro"];
    const mcCase     = overlay.microCopy_case ?? "upper";
    const mcText     = mcCase === "upper" ? microCopy.toUpperCase() : microCopy;
    const mcAlign    = overlay.microCopy_align || "left";
    const mcCol      = resolveColor(overlay.microCopy_color || "gray", palette);
    const mcp        = overlay.microCopy_pos;
    const mcX_base   = mcp?.x != null ? Math.round(mcp.x * width) : mx;
    const mcW_avail  = mcp?.w != null ? Math.round(mcp.w * width) : safeW;
    const mcY        = mcp?.y != null
      ? Math.round(mcp.y * height)
      : (signature ? height - mBot - sigSzBase * 1.8 : height - mBot);
    computedPositions.microCopy_pos = { x: mcX_base / width, y: Math.round(mcY) / height, w: mcW_avail / width };

    let mcRenderX, mcAnchor;
    if (mcAlign === "center") { mcRenderX = mcX_base + Math.round(mcW_avail / 2); mcAnchor = "middle"; }
    else if (mcAlign === "right") { mcRenderX = mcX_base + mcW_avail; mcAnchor = "end"; }
    else { mcRenderX = mcX_base; mcAnchor = "start"; }

    parts.push(
      `<text x="${mcRenderX}" y="${Math.round(mcY)}" font-family="${mcFont}" font-weight="${mcWeight}" font-size="${mcSz}" fill="${mcCol}" opacity="0.82" letter-spacing="${mcTracking}" text-anchor="${mcAnchor}" ${overlay.microCopy_italic ? 'font-style="italic"' : ''} ${shadow.ref}>${escapeXml(mcText)}</text>`
    );
  }

  // ── CAPA 6: Nav arrow (swipe hint) ─────────────────────────────────
  // Acepta "next" | "prev" | "both" | null. Se dibuja en middle-right
  // y/o middle-left edge — no compite con signature/logo en el bottom.
  const navArrow = overlay.navArrow || layout?.navArrow;
  if (navArrow) {
    const arrowSize = Math.round(width * 0.028);
    const stroke = Math.max(2.4, arrowSize * 0.18);
    const ay = Math.round(height * 0.52);
    const edgePad = Math.round(width * 0.045);
    if (navArrow === "next" || navArrow === "both") {
      const ax = width - edgePad;
      parts.push(
        `<g transform="translate(${ax},${ay})" opacity="0.60">` +
        `<path d="M 0 -${arrowSize * 0.55} L ${arrowSize * 0.50} 0 L 0 ${arrowSize * 0.55}" stroke="${accentCol}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
        `</g>`
      );
    }
    if (navArrow === "prev" || navArrow === "both") {
      const ax = edgePad;
      parts.push(
        `<g transform="translate(${ax},${ay})" opacity="0.60">` +
        `<path d="M 0 -${arrowSize * 0.55} L -${arrowSize * 0.50} 0 L 0 ${arrowSize * 0.55}" stroke="${accentCol}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
        `</g>`
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>${defs}</defs>
    ${parts.filter(Boolean).join("\n    ")}
  </svg>`;
  return { svg, computedPositions };
}

// ─── Footer (opcional) ────────────────────────────────────────────────
function buildFooterSvg({ width, height, text, color }) {
  const x  = width  - Math.round(width  * MARGIN.x);
  const y  = height - Math.round(height * 0.012);
  const sz = Math.round(width * 0.014);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <text x="${x}" y="${y}" font-family="Inter" font-weight="500" font-size="${sz}" fill="${color}" opacity="0.45" text-anchor="end" letter-spacing="0.5">${escapeXml(text)}</text>
  </svg>`;
}

// ─── SVG → PNG ────────────────────────────────────────────────────────
export async function renderSvgToPng(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font:  { fontDirs: [FONTS_DIR], loadSystemFonts: false, defaultFontFamily: "Inter" },
    background: "rgba(0,0,0,0)",
  });
  return Buffer.from(resvg.render().asPng());
}

// ─── Logo ──────────────────────────────────────────────────────────────
function pickLogoVariant(config, layout, overlay) {
  const variant  = layout?.logo?.variant || overlay?.logoVariant;
  if (variant === "light" || variant === "color") return join(ROOT, config.logo.lightVariant);
  if (variant === "dark"  || variant === "white") return join(ROOT, config.logo.darkVariant);
  const scheme   = (overlay?.colorScheme  || "dark").toLowerCase();
  const bgHint   = (overlay?.backgroundHint || "").toLowerCase();
  if (scheme === "light" || bgHint.includes("cream") || bgHint.includes("light")) {
    return join(ROOT, config.logo.lightVariant);
  }
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

  const sizeMult     = layout?.logo?.size || 1.0;
  const logoTargetW  = Math.round(canvasWidth * 0.20 * sizeMult);
  const logoResized  = await sharp(logoPath).resize({ width: logoTargetW }).toBuffer();
  const meta         = await sharp(logoResized).metadata();
  const pos          = layout?.logo?.position || overlay?.logoPosition || "bottom-right";
  const pad          = Math.max(
    Math.round(canvasWidth * (config.logo.clearspaceRatio ?? 0.022) * 2),
    Math.round(canvasWidth * MARGIN.x),
  );

  let left, top;
  if (pos === "bottom-right") { left = canvasWidth - meta.width - pad; top = canvasHeight - meta.height - Math.round(canvasHeight * MARGIN.bot * 0.55); }
  else if (pos === "bottom-left") { left = pad; top = canvasHeight - meta.height - Math.round(canvasHeight * MARGIN.bot * 0.55); }
  else if (pos === "top-right")   { left = canvasWidth - meta.width - pad; top = Math.round(canvasHeight * MARGIN.top * 0.70); }
  else if (pos === "top-left")    { left = pad; top = Math.round(canvasHeight * MARGIN.top * 0.70); }
  else if (pos === "center")      { left = Math.round((canvasWidth - meta.width) / 2); top = Math.round((canvasHeight - meta.height) / 2); }
  else { left = canvasWidth - meta.width - pad; top = canvasHeight - meta.height - Math.round(canvasHeight * MARGIN.bot * 0.55); }

  return sharp(baseBuffer)
    .composite([{ input: logoResized, left, top, blend: "over" }])
    .toBuffer();
}

// ─── Tool chips (brand-assets/tools) ──────────────────────────────────
// Acepta layout.toolChips o overlay.toolChips como array de:
//   { asset: "claude-chip-gold" | "instagram-chip-gold" | "n8n-chip-gold",
//     position: "top-left"|"top-right"|"bottom-left"|"bottom-right",
//     scale: 0.18  // ratio del ancho del canvas (default 0.20)
//   }
async function applyToolChips(baseBuffer, overlay, layout, canvasWidth, canvasHeight) {
  const chips = (layout?.toolChips || overlay?.toolChips || []).filter(Boolean);
  if (chips.length === 0) return baseBuffer;

  const composites = [];
  const pad = Math.round(canvasWidth * MARGIN.x);
  for (const chip of chips) {
    const assetPath = join(ROOT, "brand-assets/tools", `${chip.asset}.png`);
    if (!existsSync(assetPath)) {
      console.warn(`  ⚠ Tool chip no encontrado: ${assetPath}`);
      continue;
    }
    const targetW = Math.round(canvasWidth * (chip.scale || 0.20));
    const resized = await sharp(assetPath).resize({ width: targetW }).toBuffer();
    const meta = await sharp(resized).metadata();
    const pos = chip.position || "top-right";
    let left, top;
    // Posición por ratios explícitos (máxima flexibilidad)
    if (typeof chip.x === "number" && typeof chip.y === "number") {
      left = Math.round(canvasWidth * chip.x);
      top  = Math.round(canvasHeight * chip.y);
    }
    else if (pos === "top-left")         { left = pad; top = Math.round(canvasHeight * MARGIN.top * 0.70); }
    else if (pos === "top-right")        { left = canvasWidth - meta.width - pad; top = Math.round(canvasHeight * MARGIN.top * 0.70); }
    else if (pos === "bottom-left")      { left = pad; top = canvasHeight - meta.height - Math.round(canvasHeight * MARGIN.bot * 0.55); }
    else if (pos === "bottom-right")     { left = canvasWidth - meta.width - pad; top = canvasHeight - meta.height - Math.round(canvasHeight * MARGIN.bot * 0.55); }
    else if (pos === "middle-left")      { left = pad; top = Math.round((canvasHeight - meta.height) / 2); }
    else if (pos === "middle-right")     { left = canvasWidth - meta.width - pad; top = Math.round((canvasHeight - meta.height) / 2); }
    else if (pos === "center")           { left = Math.round((canvasWidth - meta.width) / 2); top = Math.round((canvasHeight - meta.height) / 2); }
    else                                 { left = canvasWidth - meta.width - pad; top = canvasHeight - meta.height - Math.round(canvasHeight * MARGIN.bot * 0.55); }
    composites.push({ input: resized, left, top, blend: "over" });
  }
  if (composites.length === 0) return baseBuffer;
  return sharp(baseBuffer).composite(composites).toBuffer();
}

// ─── Compose slide ────────────────────────────────────────────────────
export async function composeSlide(baseImagePath, rawOverlay, layout, config, outPath) {
  const baseImg = sharp(baseImagePath);
  const meta    = await baseImg.metadata();
  const { width, height } = meta;
  const overlay = normalizeOverlay(rawOverlay);

  // Merge _pos y _color desde slideData.overlay (donde el editor los guarda)
  // También acepta del nivel raíz del slide por compatibilidad
  const overlayObj = rawOverlay?.overlay || rawOverlay || {};
  const TYPO_PROPS = ["pos", "color", "font", "size", "weight", "tracking", "case", "align"];
  for (const k of ["headline", "body", "eyebrow", "signature", "microCopy"]) {
    for (const p of TYPO_PROPS) {
      const key = `${k}_${p}`;
      const val = overlayObj[key] ?? rawOverlay?.[key];
      if (val != null) overlay[key] = val;
    }
  }

  const hasCopy =
    overlay?.headline || overlay?.body || overlay?.eyebrow ||
    overlay?.signature || overlay?.microCopy ||
    (overlay?.elements?.length > 0);

  let composed = await baseImg.toBuffer();
  let computedPositions = {};

  if (hasCopy) {
    const result     = buildProOverlaySvg({ width, height, overlay, layout, palette: config.colors, logoZone: rawOverlay?.logoZone || null });
    computedPositions = result.computedPositions || {};
    const overlayPng = await renderSvgToPng(result.svg, width);
    composed = await sharp(composed)
      .composite([{ input: overlayPng, top: 0, left: 0, blend: "over" }])
      .toBuffer();
  }

  // Composite logo/image elements dragged from the library onto the canvas
  for (const el of (overlay.elements || [])) {
    if (el.type !== "logo" && el.type !== "image") continue;
    const sub = el.sub || (el.asset?.startsWith("ac-") ? "logos" : "tools");
    const filename = el.file || `${el.asset}.png`;
    const assetPath = join(ROOT, "brand-assets", sub, filename);
    if (!existsSync(assetPath)) { console.warn(`  ⚠ Logo element not found: ${assetPath}`); continue; }
    const targetW = Math.round(width * (el.scale ?? 0.20));
    const resized = await sharp(assetPath).resize({ width: targetW }).toBuffer();
    const left = Math.max(0, Math.round((el.x ?? 0.05) * width));
    const top  = Math.max(0, Math.round((el.y ?? 0.05) * height));
    composed = await sharp(composed).composite([{ input: resized, left, top, blend: "over" }]).toBuffer();
  }

  composed = await applyLogo(composed, overlay, layout, config, width, height);

  // Tool chips (logos de herramientas como elementos referentes)
  composed = await applyToolChips(composed, overlay, layout, width, height);

  if (config.output?.showFooter) {
    const bgIsDark   = (overlay?.colorScheme || "dark") === "dark";
    const footerColor = bgIsDark ? config.colors.grayLight : config.colors.grayDark;
    const footerSvg  = buildFooterSvg({
      width, height,
      text:  config.output.footerText || "content-forge",
      color: footerColor,
    });
    const footerPng = await renderSvgToPng(footerSvg, width);
    composed = await sharp(composed)
      .composite([{ input: footerPng, top: 0, left: 0, blend: "over" }])
      .toBuffer();
  }

  await writeFile(outPath, composed);
  return { ok: true, path: outPath, width, height, computedPositions };
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (!args.dir) {
    console.error("Uso: --dir=<output/social/YYYYMMDD-slug>");
    process.exit(1);
  }

  const dir          = resolve(args.dir);
  const manifestPath = join(dir, "manifest.json");
  const overlayPath  = join(dir, "overlay-copy.json");
  const layoutPath   = join(dir, "layout-plan.json");
  const rawDir       = join(dir, "raw");

  if (!existsSync(manifestPath)) { console.error(`No existe ${manifestPath}`); process.exit(1); }
  if (!existsSync(overlayPath))  { console.error(`No existe ${overlayPath}. Genera overlay-copy.json primero.`); process.exit(1); }

  const config      = await loadConfig();
  const manifest    = JSON.parse(await readFile(manifestPath, "utf8"));
  const overlayData = JSON.parse(await readFile(overlayPath,  "utf8"));
  const layoutData  = existsSync(layoutPath)
    ? JSON.parse(await readFile(layoutPath, "utf8"))
    : null;

  if (layoutData) console.log("✓ Usando layout-plan.json (image-aware)");
  else console.log("⚠  Sin layout-plan.json — defaults");

  await mkdir(rawDir, { recursive: true });
  console.log(`Composing ${manifest.results.length} slides → ${dir}`);

  const slideOverlays = overlayData.slides || {};
  const slideLayouts  = layoutData?.slides  || {};
  const results       = [];

  for (const r of manifest.results) {
    if (r.ok === false) continue;  // Solo salta los que fallaron explícitamente
    if (!r.path) continue;
    const fname     = basename(r.bgPath || r.path);
    const rawPath   = join(rawDir, fname);
    const finalName = fname.replace(/\.png$/i, "-final.png");
    const outPath   = join(dir, finalName);  // Escribe a -final.png, nunca toca el original

    // Si el slide tiene bg params CSS editados, regenerar PNG desde css-backgrounds.mjs.
    // Solo activar cuando bgParams tiene la key "style" (exclusiva de CSS backgrounds).
    // Los campos scrim/scrimOpacity son meta del overlay, NO señales de regenerar fondo.
    const slideData  = slideOverlays[r.id] || {};
    const bgParams   = slideData.bg || null;
    const isCssBg   = bgParams && ("style" in bgParams || "baseColor" in bgParams);
    let basePath = r.bgPath || r.path;

    if (isCssBg) {
      try {
        const { buildBackground } = await import("./css-backgrounds.mjs");
        const slideIdx = manifest.results.indexOf(r);
        const pngBuf = buildBackground(slideIdx, bgParams);
        await writeFile(rawPath, pngBuf);
        basePath = rawPath;
      } catch (bgErr) {
        if (!existsSync(rawPath)) await copyFile(basePath, rawPath);
        basePath = rawPath;
      }
    } else {
      // Para slides AI-PNG: guardar copia del original limpio en raw/ si aún no existe.
      // raw/ solo se usa como referencia del editor; compose siempre lee desde r.path.
      if (!existsSync(rawPath)) await copyFile(basePath, rawPath);
    }

    const overlayEntry = slideData;
    const layoutEntry  = slideLayouts[r.id]  || null;

    try {
      const res = await composeSlide(basePath, overlayEntry, layoutEntry, config, outPath);
      console.log(`  ✓ ${layoutEntry ? "🎨 " : "  "}${finalName} (${res.width}×${res.height})`);
      results.push({ id: r.id, ok: true, path: outPath, layoutApplied: !!layoutEntry });

      // Sincronizar posiciones calculadas → overlay-copy.json para WYSIWYG en el editor
      // Los _pos se escriben dentro de slideData.overlay (igual que el editor al hacer drag)
      if (res.computedPositions && Object.keys(res.computedPositions).length > 0) {
        if (!overlayData.slides) overlayData.slides = {};
        if (!overlayData.slides[r.id]) overlayData.slides[r.id] = {};
        if (!overlayData.slides[r.id].overlay) overlayData.slides[r.id].overlay = {};
        Object.assign(overlayData.slides[r.id].overlay, res.computedPositions);
      }
    } catch (err) {
      console.error(`  ✗ ${r.id}: ${err?.message ?? err}`);
      results.push({ id: r.id, ok: false, error: err?.message ?? String(err) });
    }
  }

  const okCount     = results.filter((r) => r.ok).length;
  const withLayout  = results.filter((r) => r.layoutApplied).length;
  console.log(`\n${okCount}/${results.length} slides compuestos · ${withLayout} con layout image-aware`);

  // Escribir posiciones de vuelta al overlay-copy.json para sincronizar editor
  if (okCount > 0) {
    await writeFile(overlayPath, JSON.stringify(overlayData, null, 2));
    console.log("✓ Posiciones sincronizadas en overlay-copy.json");
  }

  await writeFile(join(dir, "compose-report.json"), JSON.stringify({
    composed_at:      new Date().toISOString(),
    dir,
    schema_version:   "2.0",
    used_layout_plan: !!layoutData,
    footer_shown:     !!config.output?.showFooter,
    slides:           results,
  }, null, 2));

  // Cleanup: OPT-IN. Por defecto (`output.keepRawBackup: true`) NO borra nada
  // — los raws y reports quedan para regens parciales. Para activar cleanup,
  // setea `output.keepRawBackup: false` en brand.config.json.
  //
  // Cleanup conservador: solo borra raw/ si todos los -final.png existen en disco.
  const keepRaw = config.output?.keepRawBackup !== false;
  if (!keepRaw && okCount > 0) {
    if (existsSync(rawDir)) {
      try {
        await rm(rawDir, { recursive: true, force: true });
        console.log(`🧹 raw/ eliminado (keepRawBackup=false)`);
      } catch (e) {
        console.warn(`⚠  No se pudo eliminar raw/: ${e.message}`);
      }
    }
  } else if (keepRaw) {
    console.log(`🛡️  keepRawBackup=true — se conservan raws para el editor (fondo limpio).`);
  }
}

// Solo corre main() si este archivo es el punto de entrada directo (no cuando se importa).
import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error("Fatal:", err?.message ?? err); process.exit(1); });
}
