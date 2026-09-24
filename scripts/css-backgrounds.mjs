#!/usr/bin/env node
// css-backgrounds.mjs — Fondos premium via SVG/CSS, sin IA, renderizados con resvg
// 8 diseños únicos para el carrusel "No dejes tu trabajo. Úsalo."
// Técnicas: gradientes multi-capa · bokeh (feGaussianBlur) · grano (feTurbulence) · splits

import { Resvg } from "@resvg/resvg-js";

const W = 2160;
const H = 2160;

// ─── Params por defecto (uno por slide) ────────────────────────────────────────

export const DEFAULT_PARAMS = [
  { style: "dark-shaft",  base: "#110e09", base2: "#050505", accent: "#D4AF37", intensity: 0.65 },
  { style: "light-wall",  base: "#fffef8", base2: "#f4ede3", accent: "#9a8878", intensity: 0.40 },
  { style: "cream-bokeh", base: "#f8f3ea", base2: "#f8f3ea", accent: "#D4AF37", intensity: 0.17 },
  { style: "concrete",    base: "#d8d2c9", base2: "#e6dfd4", accent: "#c8a060", intensity: 0.12 },
  { style: "dark-galaxy", base: "#060608", base2: "#060608", accent: "#D4AF37", intensity: 0.22 },
  { style: "bw-split",    base: "#f9f8f5", base2: "#0b0b0b", accent: "#808080", intensity: 1.00 },
  { style: "ivory-grad",  base: "#ffffff", base2: "#ece5d8", accent: "#c0a880", intensity: 0.14 },
  { style: "amber-glow",  base: "#fff9ed", base2: "#a85510", accent: "#e8a030", intensity: 0.55 },
];

// ─── Filtros reutilizables ──────────────────────────────────────────────────────

function blurFilter(id, dev) {
  // Región expandida para que el blur no se recorte en los bordes del elemento
  return `<filter id="${id}" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="${dev}"/>
  </filter>`;
}

function grainFilter(id, freq = "0.72", octaves = 4, seed = 1) {
  return `<filter id="${id}" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>`;
}

// ─── Slide 01 — Hook ─────────────────────────────────────────────────────────
// Near-black · eje de luz dorado diagonal desde esquina superior-derecha · grano de película
function slide01(p = {}) {
  const { base, base2, accent, intensity } = { ...DEFAULT_PARAMS[0], ...p };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${base}"/>
      <stop offset="100%" stop-color="${base2}"/>
    </linearGradient>
    <linearGradient id="shaft" x1="100%" y1="0%" x2="40%" y2="60%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="${intensity}"/>
      <stop offset="42%"  stop-color="${accent}" stop-opacity="${(intensity * 0.15 / 0.65).toFixed(3)}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="hotspot" cx="92%" cy="4%" r="32%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="0.40"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vign" cx="50%" cy="50%" r="70%">
      <stop offset="60%"  stop-color="${base2}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${base2}" stop-opacity="0.55"/>
    </radialGradient>
    ${grainFilter("grain", "0.75", 4, 3)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#shaft)"/>
  <rect width="${W}" height="${H}" fill="url(#hotspot)"/>
  <rect width="${W}" height="${H}" fill="url(#vign)"/>
  <rect width="${W}" height="${H}" fill="#808080" filter="url(#grain)" opacity="0.045"/>
</svg>`;
}

// ─── Slide 02 — El error más común ───────────────────────────────────────────
// Pared blanca arquitectónica · sombra suave superior-izquierda · warm ivory
function slide02(p = {}) {
  const { base, base2, accent, intensity } = { ...DEFAULT_PARAMS[1], ...p };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="base" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="${base}"/>
      <stop offset="100%" stop-color="${base2}"/>
    </linearGradient>
    <radialGradient id="shadow" cx="0%" cy="0%" r="75%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="${intensity}"/>
      <stop offset="55%"  stop-color="${accent}" stop-opacity="${(intensity * 0.08 / 0.40).toFixed(3)}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vign" cx="50%" cy="50%" r="65%">
      <stop offset="68%"  stop-color="#c8b8a0" stop-opacity="0"/>
      <stop offset="100%" stop-color="#c8b8a0" stop-opacity="0.14"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#shadow)"/>
  <rect width="${W}" height="${H}" fill="url(#vign)"/>
</svg>`;
}

// ─── Slide 03 — Por qué ───────────────────────────────────────────────────────
// Cream suave · campo de bokeh dorado y blanco flotando en el lado derecho
function slide03(p = {}) {
  const { base, accent, intensity } = { ...DEFAULT_PARAMS[2], ...p };
  // Ratio de escala para cada opacidad base (relativo a intensity=0.17)
  const scale = intensity / 0.17;
  const op = (v) => Math.min(1, parseFloat((v * scale).toFixed(3)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    ${blurFilter("bl180", 180)}
    ${blurFilter("bl120", 120)}
    ${blurFilter("bl90",  90)}
    ${blurFilter("bl55",  55)}
  </defs>
  <rect width="${W}" height="${H}" fill="${base}"/>
  <!-- Bokeh field — derecha -->
  <circle cx="1720" cy="560"  r="340" fill="${accent}"  opacity="${op(0.17)}" filter="url(#bl180)"/>
  <circle cx="1980" cy="1280" r="260" fill="${accent}"  opacity="${op(0.22)}" filter="url(#bl120)"/>
  <circle cx="1520" cy="980"  r="200" fill="#ffffff"   opacity="${op(0.38)}" filter="url(#bl120)"/>
  <circle cx="2060" cy="640"  r="140" fill="${accent}"  opacity="${op(0.20)}" filter="url(#bl90)"/>
  <circle cx="1820" cy="1640" r="180" fill="${accent}"  opacity="${op(0.12)}" filter="url(#bl120)"/>
  <circle cx="1380" cy="1440" r="120" fill="#ffffff"   opacity="${op(0.28)}" filter="url(#bl90)"/>
  <circle cx="1950" cy="400"  r="90"  fill="${accent}"  opacity="${op(0.18)}" filter="url(#bl55)"/>
  <circle cx="1640" cy="1820" r="100" fill="${accent}"  opacity="${op(0.13)}" filter="url(#bl55)"/>
</svg>`;
}

// ─── Slide 04 — En la práctica ────────────────────────────────────────────────
// Concreto gris-cálido · textura fina · calidez sutil desde la derecha
function slide04(p = {}) {
  const { base, base2, accent, intensity } = { ...DEFAULT_PARAMS[3], ...p };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="base" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${base}"/>
      <stop offset="100%" stop-color="${base2}"/>
    </linearGradient>
    <linearGradient id="warmth" x1="70%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="${intensity}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vign" cx="50%" cy="50%" r="70%">
      <stop offset="62%"  stop-color="#b0a090" stop-opacity="0"/>
      <stop offset="100%" stop-color="#b0a090" stop-opacity="0.12"/>
    </radialGradient>
    ${grainFilter("tex", "0.85", 5, 7)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#warmth)"/>
  <rect width="${W}" height="${H}" fill="url(#vign)"/>
  <rect width="${W}" height="${H}" fill="#808080" filter="url(#tex)" opacity="0.035"/>
</svg>`;
}

// ─── Slide 05 — Historia personal ────────────────────────────────────────────
// Near-black · galaxia bokeh ámbar/dorado densa · grano cinematográfico
function slide05(p = {}) {
  const { base, accent, intensity } = { ...DEFAULT_PARAMS[4], ...p };
  // intensity controla los círculos de ambiente grandes; escala relativa a 0.22
  const scale = intensity / 0.22;
  const op = (v) => Math.min(1, parseFloat((v * scale).toFixed(3)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    ${blurFilter("b160", 160)}
    ${blurFilter("b110", 110)}
    ${blurFilter("b70",  70)}
    ${blurFilter("b45",  45)}
    ${grainFilter("gr", "0.72", 4, 11)}
  </defs>
  <rect width="${W}" height="${H}" fill="${base}"/>
  <!-- Resplandor ambiente — capas largas -->
  <circle cx="1280" cy="860"  r="580" fill="${accent}"  opacity="${op(0.11)}" filter="url(#b160)"/>
  <circle cx="780"  cy="1420" r="420" fill="${accent}"  opacity="${op(0.09)}" filter="url(#b160)"/>
  <circle cx="1700" cy="1500" r="380" fill="${accent}"  opacity="${op(0.08)}" filter="url(#b160)"/>
  <!-- Bokeh medio -->
  <circle cx="1720" cy="580"  r="230" fill="${accent}"  opacity="0.17" filter="url(#b110)"/>
  <circle cx="1940" cy="1240" r="190" fill="${accent}"  opacity="0.15" filter="url(#b110)"/>
  <circle cx="580"  cy="680"  r="170" fill="${accent}"  opacity="0.13" filter="url(#b110)"/>
  <circle cx="1080" cy="1760" r="155" fill="${accent}"  opacity="0.15" filter="url(#b110)"/>
  <circle cx="420"  cy="1560" r="145" fill="${accent}"  opacity="0.12" filter="url(#b70)"/>
  <!-- Bokeh pequeño — chispas -->
  <circle cx="440"  cy="380"  r="80"  fill="${accent}"  opacity="0.22" filter="url(#b45)"/>
  <circle cx="1520" cy="1380" r="75"  fill="${accent}"  opacity="0.19" filter="url(#b45)"/>
  <circle cx="1960" cy="860"  r="65"  fill="${accent}"  opacity="0.21" filter="url(#b45)"/>
  <circle cx="820"  cy="1920" r="55"  fill="${accent}"  opacity="0.16" filter="url(#b45)"/>
  <circle cx="290"  cy="1180" r="50"  fill="${accent}"  opacity="0.14" filter="url(#b45)"/>
  <circle cx="2060" cy="380"  r="45"  fill="${accent}"  opacity="0.18" filter="url(#b45)"/>
  <circle cx="1200" cy="280"  r="40"  fill="${accent}"  opacity="0.15" filter="url(#b45)"/>
  <!-- Grano cinematográfico -->
  <rect width="${W}" height="${H}" fill="#808080" filter="url(#gr)" opacity="0.05"/>
</svg>`;
}

// ─── Slide 06 — La verdad ─────────────────────────────────────────────────────
// Split duro blanco/negro vertical exacto en x=1080 · textura leve en ambos lados
function slide06(p = {}) {
  const { base, base2, intensity } = { ...DEFAULT_PARAMS[5], ...p };
  // intensity afecta la sombra de profundidad en la junta
  const shadowL = parseFloat((0.14 * intensity).toFixed(3));
  const shadowR = parseFloat((0.20 * intensity).toFixed(3));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    ${grainFilter("tex", "0.90", 4, 13)}
    <radialGradient id="shadowL" cx="100%" cy="50%" r="30%">
      <stop offset="0%"   stop-color="#b0a090" stop-opacity="${shadowL}"/>
      <stop offset="100%" stop-color="#b0a090" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="shadowR" cx="0%" cy="50%" r="30%">
      <stop offset="0%"   stop-color="#000000" stop-opacity="${shadowR}"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Mitad izquierda — blanco cálido -->
  <rect x="0"    y="0" width="1080" height="${H}" fill="${base}"/>
  <!-- Mitad derecha — negro profundo -->
  <rect x="1080" y="0" width="1080" height="${H}" fill="${base2}"/>
  <!-- Sombra de profundidad en la junta -->
  <rect x="0"    y="0" width="1080" height="${H}" fill="url(#shadowL)"/>
  <rect x="1080" y="0" width="1080" height="${H}" fill="url(#shadowR)"/>
  <!-- Textura sutil común -->
  <rect width="${W}" height="${H}" fill="#808080" filter="url(#tex)" opacity="0.025"/>
</svg>`;
}

// ─── Slide 07 — La lección ────────────────────────────────────────────────────
// Ivory gradiente limpio · vignette cálida en esquinas inferiores
function slide07(p = {}) {
  const { base, base2, accent, intensity } = { ...DEFAULT_PARAMS[6], ...p };
  const vignBL = parseFloat((0.14 * intensity / 0.14).toFixed(3));
  const vignBR = parseFloat((0.11 * intensity / 0.14).toFixed(3));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="base" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="${base}"/>
      <stop offset="100%" stop-color="${base2}"/>
    </linearGradient>
    <radialGradient id="vignBL" cx="0%" cy="100%" r="55%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="${vignBL}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignBR" cx="100%" cy="100%" r="50%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="${vignBR}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="highlight" cx="50%" cy="0%" r="45%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.60"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#highlight)"/>
  <rect width="${W}" height="${H}" fill="url(#vignBL)"/>
  <rect width="${W}" height="${H}" fill="url(#vignBR)"/>
</svg>`;
}

// ─── Slide 08 — CTA / Cierre ──────────────────────────────────────────────────
// Golden-hour cálido · diagonal cream → ámbar profundo · bloom de luz superior-izquierda
function slide08(p = {}) {
  const { base, base2, accent, intensity } = { ...DEFAULT_PARAMS[7], ...p };
  const bloomOp   = parseFloat((0.55 * intensity / 0.55).toFixed(3));
  const bloomMid  = parseFloat((0.08 * intensity / 0.55).toFixed(3));
  const depthOp   = parseFloat((0.30 * intensity / 0.55).toFixed(3));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${base}"/>
      <stop offset="45%"  stop-color="${accent}"/>
      <stop offset="100%" stop-color="${base2}"/>
    </linearGradient>
    <radialGradient id="bloom" cx="5%" cy="5%" r="52%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="${bloomOp}"/>
      <stop offset="60%"  stop-color="#ffffff" stop-opacity="${bloomMid}"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="depth" cx="100%" cy="100%" r="50%">
      <stop offset="0%"   stop-color="#701800" stop-opacity="${depthOp}"/>
      <stop offset="100%" stop-color="#701800" stop-opacity="0"/>
    </radialGradient>
    ${grainFilter("gr", "0.70", 3, 17)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#bloom)"/>
  <rect width="${W}" height="${H}" fill="url(#depth)"/>
  <rect width="${W}" height="${H}" fill="#808080" filter="url(#gr)" opacity="0.04"/>
</svg>`;
}

// ─── Builders array ───────────────────────────────────────────────────────────

const BUILDERS = [slide01, slide02, slide03, slide04, slide05, slide06, slide07, slide08];

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Genera un Buffer PNG listo para composición final.
 * @param {number} idx - Índice 0–7
 * @param {Partial<typeof DEFAULT_PARAMS[0]>} params - Overrides opcionales
 */
export function buildBackground(idx, params = {}) {
  if (idx < 0 || idx >= BUILDERS.length) {
    throw new Error(`Índice ${idx} fuera de rango (0–${BUILDERS.length - 1})`);
  }
  const svg = BUILDERS[idx](params);
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W } });
  return Buffer.from(resvg.render().asPng());
}

/**
 * Genera el string SVG (para editor en vivo o previsualización).
 * @param {number} idx - Índice 0–7
 * @param {Partial<typeof DEFAULT_PARAMS[0]>} params - Overrides opcionales
 */
export function buildSvg(idx, params = {}) {
  if (idx < 0 || idx >= BUILDERS.length) {
    throw new Error(`Índice ${idx} fuera de rango (0–${BUILDERS.length - 1})`);
  }
  return BUILDERS[idx](params);
}

/**
 * Devuelve una copia de los params por defecto de un slide.
 * @param {number} idx - Índice 0–7
 */
export function getDefaultParams(idx) {
  if (idx < 0 || idx >= DEFAULT_PARAMS.length) {
    throw new Error(`Índice ${idx} fuera de rango (0–${DEFAULT_PARAMS.length - 1})`);
  }
  return { ...DEFAULT_PARAMS[idx] };
}

// ─── CLI standalone: node scripts/css-backgrounds.mjs ─────────────────────────
if (process.argv[1] && process.argv[1].endsWith("css-backgrounds.mjs")) {
  const { writeFile, mkdir } = await import("node:fs/promises");
  const { existsSync }       = await import("node:fs");
  const { join, dirname, resolve } = await import("node:path");
  const { fileURLToPath }    = await import("node:url");

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const OUT = resolve(__dirname, "..", "output", "bg-test");
  if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

  console.log("\n✦ CSS Backgrounds — test render\n");
  for (let i = 0; i < BUILDERS.length; i++) {
    const buf  = buildBackground(i);
    const file = join(OUT, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await writeFile(file, buf);
    console.log(`  ✓ slide-${String(i + 1).padStart(2, "0")}.png  (${buf.length} bytes)`);
  }
  console.log(`\n  Output: output/bg-test/\n`);
}
