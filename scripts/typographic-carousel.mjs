#!/usr/bin/env node
// typographic-carousel.mjs — Carrusel tipográfico 2K · v6.0
// "No dejes tu trabajo. Úsalo." — 8 slides 2160×2160
//
// Pipeline por slide:
//   1. gpt-image-1  → fondo editorial premium (buildPrompt de brand-system.mjs)
//   2. sharp 2K     → Lanczos3 upscale a 2160×2160
//   3. SVG overlay  → tipografía Montserrat, layout fiel al brief
//   4. logo         → monograma AC top-right
//
// Sin personaje — fondos abstractos/editoriales alineados a la marca.
// Uso: node scripts/typographic-carousel.mjs

import { writeFile, mkdir }               from "node:fs/promises";
import { existsSync }                      from "node:fs";
import { dirname, join, resolve }          from "node:path";
import { fileURLToPath }                   from "node:url";
import { Resvg }                           from "@resvg/resvg-js";
import sharp                               from "sharp";
import { buildBackground }                 from "./css-backgrounds.mjs";
import { config as loadEnv }               from "dotenv";

import {
  loadConfig,
  buildPrompt,
  brandHandle,
} from "./brand-system.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const FONTS_DIR = join(__dirname, "fonts");
const SLUG      = "20260506-no-dejes-tu-trabajo";
const OUT_DIR   = join(ROOT, "output", "social", SLUG);

loadEnv({ path: join(ROOT, ".env.local") });

// ─── Canvas 2K ────────────────────────────────────────────────────────────────
const W     = 2160;
const H     = 2160;
const MX    = 160;
const MY    = 160;
const CX    = W / 2;
const TOTAL = 8;

// ─── Paleta del brief ─────────────────────────────────────────────────────────
const C = {
  white:  "#FFFFFF",
  black:  "#000000",
  dark:   "#1A1A1A",
  mid:    "#888888",
  muted:  "#BBBBBB",
  line:   "#DDDDDD",
};

// Inicializado desde brand.config.json en main()
let HANDLE = "";
const LOGO_PATH = join(ROOT, "brand-assets/logos/ac-logo-on-dark.png");

// ─── Conceptos de fondo por slide ─────────────────────────────────────────────
// Abstractos tipo wallpaper — sin cuadernos, tablets, pantallas ni objetos
// específicos. Texturas, luz, sombra y gradientes premium alineados a la marca.
// Paleta: near-black #050505 · gold #D4AF37 · cream/white.

const SLIDE_DEFS = [
  // 1 — Hook · oscuro · texto centrado
  {
    concept: `
      Abstract matte near-black background with an extremely subtle cross-hatched
      micro-texture, almost invisible. A single diagonal shaft of warm gold light
      (color D4AF37) enters from the upper-right corner and fades before reaching
      the center. Deep crushed shadows. Minimal film grain. Like a premium luxury
      brand campaign background. No objects. No people. No text. Square 1:1.
    `.trim(),
    composition: "Gold light occupies upper-right. Center and left are pure near-black — clear for white centered text.",
    beat: "hook",
  },

  // 2 — El error más común · claro
  {
    concept: `
      Abstract minimal photography: a smooth white plaster or matte concrete wall
      with the softest possible shadow gradient falling from the upper-left. The
      surface has a barely perceptible fine texture — like high-end architectural
      photography. Warm white and ivory tones. Studio quality. No objects, no people,
      no text. Square 1:1.
    `.trim(),
    composition: "Subtle shadow gradient anchors upper-left. Rest of frame is clean warm white.",
    beat: "setup",
  },

  // 3 — Por qué · claro
  {
    concept: `
      Abstract warm cream background: extreme shallow depth of field bokeh wash.
      Several soft out-of-focus specular highlights in warm white and pale gold float
      across the right side of the frame. Left side is clean cream. Dreamy, premium,
      editorial. No objects, no text, no people. Square 1:1.
    `.trim(),
    composition: "Bokeh floats right. Left is clean cream — ideal for left-aligned text.",
    beat: "tension",
  },

  // 4 — En la práctica · gris claro
  {
    concept: `
      Abstract flat-lay of a smooth warm light-gray concrete or stone surface.
      Uniform even studio light, almost shadowless. Slight directional warmth from
      the right. The entire frame is one premium matte texture. Systematic,
      architectural, calm mood. No objects, no people, no text. Square 1:1.
    `.trim(),
    composition: "Uniform texture across the full frame. Slight warm tint on the right half.",
    beat: "insight",
  },

  // 5 — Historia personal · oscuro
  {
    concept: `
      Abstract dark bokeh field: dozens of defocused warm gold and amber light points
      (D4AF37) float on a near-black background, creating a dense galaxy-like pattern.
      Slight directional blur from bottom-left to upper-right. Deep cinematic mood.
      Film grain. No objects, no people, no text. Square 1:1.
    `.trim(),
    composition: "Dense bokeh across full frame. Near-black areas dominate the left third for text.",
    beat: "proof",
  },

  // 6 — La verdad · claro / oscuro split
  {
    concept: `
      Hard-edge abstract split composition: the left half is a smooth warm pure-white
      surface; the right half is a smooth near-black matte surface. The boundary is a
      crisp straight vertical line exactly at the center. No gradient at the seam.
      Both halves have an ultra-fine matte texture. No objects, no people, no text.
      Premium editorial graphic. Square 1:1.
    `.trim(),
    composition: "Left half white (text lives here), right half near-black. Perfect contrast split.",
    beat: "insight",
  },

  // 7 — La lección · claro · texto centrado
  {
    concept: `
      Abstract creamy ivory gradient: top half is pure warm white fading into a very
      pale champagne tone at the bottom. Subtle vignette in the lower corners. Shot as
      a minimalist studio backdrop. No objects, no people, no text. Quiet, confident,
      premium. Square 1:1.
    `.trim(),
    composition: "Clean gradient fills the entire frame. Uniform enough for centered text anywhere.",
    beat: "cta",
  },

  // 8 — CTA · cálido
  {
    concept: `
      Abstract warm amber and gold gradient wash: diffused warm golden-hour light
      fills the frame, transitioning from deep amber in the lower-right to bright
      warm cream in the upper-left. Soft and luminous. No objects, no people, no text.
      Feels like luxury perfume campaign backdrop. Film grain. Square 1:1.
    `.trim(),
    composition: "Bright warm upper-left area accommodates text. Deep amber lower-right adds depth.",
    beat: "cta",
  },

];

// ─── Phase A: fondo CSS/SVG — sin IA, sin API externa ────────────────────────
async function generateBackground(_config, idx) {
  return buildBackground(idx);
}

// ─── Logo: monograma dorado top-right ─────────────────────────────────────────
let _logoBuf = null;
async function addLogo(slideBuffer) {
  if (!_logoBuf) {
    // Escala por altura a 260px, ancho proporcional (900×966 original)
    _logoBuf = await sharp(LOGO_PATH)
      .resize(null, 260, { fit: "inside" })
      .png()
      .toBuffer();
  }
  const { width: lw = 242 } = await sharp(_logoBuf).metadata();
  return sharp(slideBuffer)
    .composite([{ input: _logoBuf, left: W - MX - lw, top: MY, blend: "over" }])
    .png()
    .toBuffer();
}

// ─── Compositar fondo 2K + overlay ────────────────────────────────────────────
async function compose(bgBuf, overlayBuf) {
  const bg2k = await sharp(bgBuf)
    .resize(W, H, { kernel: sharp.kernel.lanczos3 })
    .toBuffer();
  return sharp(bg2k)
    .composite([{ input: overlayBuf, blend: "over" }])
    .png()
    .toBuffer();
}

// ─── Utilitarios SVG ──────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function T(text, x, y, size, weight, color, anchor = "start", italic = false) {
  const style = italic ? ' font-style="italic"' : "";
  return `<text x="${x}" y="${y}" font-family="Montserrat" font-weight="${weight}" font-size="${size}" fill="${esc(color)}" text-anchor="${anchor}"${style}>${esc(text)}</text>`;
}

function HR(y, x1, x2, color, thickness = 4) {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${esc(color)}" stroke-width="${thickness}" stroke-linecap="round"/>`;
}

function makeCursor(startY) {
  let cur = startY;
  return {
    next(size, lhMult = 1.22) {
      const baseline = cur + Math.round(size * 0.78);
      cur += Math.round(size * lhMult);
      return baseline;
    },
    skip(px) { cur += px; },
    get y() { return cur; },
  };
}

function footer(num, textColor) {
  const yFoot = H - MY - 12;
  return [
    T(`${num}/${TOTAL}`, MX,     yFoot, 36, "400", textColor, "start"),
    T(HANDLE,             W - MX, yFoot, 36, "400", textColor, "end"),
  ].join("\n  ");
}

function svgOverlay(fillColor, fillOpacity, ...els) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${fillColor}" fill-opacity="${fillOpacity}"/>
  ${els.join("\n  ")}
</svg>`;
}

async function renderSvg(svgStr) {
  const resvg = new Resvg(svgStr, {
    font: {
      fontDirs:          [FONTS_DIR],
      loadSystemFonts:   false,
      defaultFontFamily: "Montserrat",
    },
  });
  return Buffer.from(resvg.render().asPng());
}

// ─── SLIDES ───────────────────────────────────────────────────────────────────

function slide01() {
  const c  = makeCursor(790);
  const yA = c.next(128);
  c.skip(40);
  const sepY = c.y;
  c.skip(4 + 40);
  const yB = c.next(128);
  c.skip(80);
  const yC = c.next(88);
  return svgOverlay("#050505", 0.55,
    T("No dejes tu trabajo",         CX, yA, 128, "900", C.white, "middle"),
    T("para crear contenido.",        CX, yB, 128, "900", C.white, "middle"),
    HR(sepY, CX - 200, CX + 200,     C.white, 4),
    T("Úsalo para crear contenido.", CX, yC,  88, "700", C.white, "middle"),
    footer(1, C.white),
  );
}

function slide02() {
  const c   = makeCursor(800);
  const yA1 = c.next(84);
  const yA2 = c.next(84);
  const yA3 = c.next(84);
  c.skip(48);
  const yB  = c.next(100);
  c.skip(32);
  const yC  = c.next(56);
  return svgOverlay("#ffffff", 0.72,
    T("La mayoría piensa que para ser",        MX, yA1, 84, "700", C.dark),
    T("creador de contenido",                  MX, yA2, 84, "700", C.dark),
    T("necesita renunciar primero.",            MX, yA3, 84, "700", C.dark),
    T("No es cierto.",                          MX, yB, 100, "900", C.black),
    T("El trabajo es tu ventaja competitiva.", MX, yC,  56, "400", C.mid),
    footer(2, C.dark),
  );
}

function slide03() {
  const c   = makeCursor(770);
  const yA1 = c.next(68);
  const yA2 = c.next(68);
  c.skip(64);
  const yL1 = c.next(72);
  const yL2 = c.next(72);
  const yL3 = c.next(72);
  c.skip(48);
  const yB  = c.next(52);
  return svgOverlay("#ffffff", 0.72,
    T("Tu trabajo te da algo que los",   MX, yA1, 68, "400", C.dark),
    T("creadores full-time no tienen:",  MX, yA2, 68, "400", C.dark),
    T("· Casos concretos.",              MX, yL1, 72, "700", C.black),
    T("· Errores reales.",               MX, yL2, 72, "700", C.black),
    T("· Resultados medibles.",          MX, yL3, 72, "700", C.black),
    T("Eso no se puede inventar.",       MX, yB,  52, "300", C.mid, "start", true),
    footer(3, C.dark),
  );
}

function slide04() {
  const items = [
    "¿Ventas? → Tus mejores y peores cierres = lecciones.",
    "¿Finanzas? → Lo que entiendes que otros no = diferenciador.",
    "¿Emprendedor? → El proceso de construir = el contenido.",
    "¿Marketing? → Tus campañas y errores = valor real.",
  ];
  const c    = makeCursor(862);
  const rows = items.map((_, i) => {
    const y = c.next(56, 1.35);
    if (i < items.length - 1) c.skip(44);
    return y;
  });
  return svgOverlay("#f7f7f7", 0.74,
    ...items.map((text, i) => T(text, MX, rows[i], 56, "400", C.dark)),
    footer(4, C.dark),
  );
}

function slide05() {
  const lines = [
    "Empecé a publicar en medio del proceso.",
    "No cuando lo tenía todo resuelto.",
    "Tenía años construyendo negocios en LATAM,",
    "errores que costaron caro",
    "y aprendizajes que valía la pena compartir.",
    "Empecé por ahí.",
  ];
  const c  = makeCursor(753);
  const ys = lines.map(() => c.next(68, 1.6));
  return svgOverlay("#050505", 0.58,
    ...lines.map((line, i) => T(line, MX, ys[i], 68, "400", C.white)),
    footer(5, C.white),
  );
}

function slide06() {
  const c    = makeCursor(700);
  const yA1  = c.next(68);
  const yA2  = c.next(68);
  c.skip(32);
  const sepY = c.y;
  c.skip(2 + 32);
  const yB1  = c.next(96);
  const yB2  = c.next(96);
  return svgOverlay("#ffffff", 0.72,
    T("El mejor momento para crear contenido", MX, yA1, 68, "400", C.muted),
    T("no es cuando lo dejás todo.",            MX, yA2, 68, "400", C.muted),
    HR(sepY, MX, MX + 320,                     C.line, 2),
    T("Es cuando tenés",                        MX, yB1, 96, "900", C.black),
    T("algo real que decir.",                   MX, yB2, 96, "900", C.black),
    footer(6, C.dark),
  );
}

function slide07() {
  const c   = makeCursor(800);
  const yA  = c.next(144);
  c.skip(40);
  const yB  = c.next(88);
  c.skip(72);
  const yC1 = c.next(56, 1.5);
  const yC2 = c.next(56, 1.5);
  return svgOverlay("#ffffff", 0.72,
    T("Crea ahora.",                          CX, yA,  144, "900", C.black, "middle"),
    T("Con lo que tienes.",                   CX, yB,   88, "700", C.black, "middle"),
    T("La audiencia no quiere perfección.",   CX, yC1,  56, "400", C.mid,  "middle"),
    T("Quiere experiencia real. La tuya.",    CX, yC2,  56, "400", C.mid,  "middle"),
    footer(7, C.dark),
  );
}

function slide08() {
  const c    = makeCursor(730);
  const yQ1  = c.next(76, 1.5);
  const yQ2  = c.next(76, 1.5);
  c.skip(64);
  const yCta = c.next(56);
  c.skip(48);
  const sepY = c.y;
  c.skip(2 + 40);
  const ySig = c.next(48);
  return svgOverlay("#ffffff", 0.72,
    T("¿Cuál es el conocimiento que tienes",          MX, yQ1,  76, "700", C.dark),
    T("y que todavía no has convertido en contenido?", MX, yQ2,  76, "700", C.dark),
    T("Escríbelo en los comentarios.",                 MX, yCta, 56, "400", C.mid),
    HR(sepY, MX, MX + 240,                            C.black, 4),
    T("— Alexander Cast",                              MX, ySig, 48, "300", C.dark, "start", true),
    footer(8, C.dark),
  );
}

// ─── Texto por slide para overlay-copy.json (editable en el editor) ──────────
// Formato compatible con compose-overlay.mjs: headline/body/eyebrow/signature.
// colorScheme: "dark" = texto blanco, "light" = texto oscuro.
const SLIDE_OVERLAY_DEFS = [
  // slide-01 — Hook
  { overlay: { headline: "No dejes tu trabajo para crear contenido.", body: "Úsalo para crear contenido.", colorScheme: "dark",  position: "center", showLogo: true, elements: [] } },
  // slide-02 — El error más común
  { overlay: { eyebrow: "EL ERROR MÁS COMÚN", headline: "No es cierto.", body: "La mayoría piensa que para ser creador de contenido necesita renunciar primero. El trabajo es tu ventaja competitiva.", colorScheme: "light", showLogo: true, elements: [] } },
  // slide-03 — Por qué
  { overlay: { headline: "Tu trabajo te da algo que los creadores full-time no tienen:", body: "· Casos concretos.\n· Errores reales.\n· Resultados medibles.\n\nEso no se puede inventar.", colorScheme: "light", showLogo: true, elements: [] } },
  // slide-04 — En la práctica
  { overlay: { eyebrow: "EN LA PRÁCTICA", body: "¿Ventas? → Tus mejores y peores cierres = lecciones.\n¿Finanzas? → Lo que entiendes que otros no = diferenciador.\n¿Emprendedor? → El proceso de construir = el contenido.\n¿Marketing? → Tus campañas y errores = valor real.", colorScheme: "light", showLogo: true, elements: [] } },
  // slide-05 — Historia personal
  { overlay: { body: "Empecé a publicar en medio del proceso. No cuando lo tenía todo resuelto.\n\nTenía años construyendo negocios en LATAM, errores que costaron caro y aprendizajes que valía la pena compartir.\n\nEmpecé por ahí.", colorScheme: "dark",  showLogo: true, elements: [] } },
  // slide-06 — La verdad
  { overlay: { body: "El mejor momento para crear contenido no es cuando lo dejás todo.", headline: "Es cuando tenés algo real que decir.", colorScheme: "light", showLogo: true, elements: [] } },
  // slide-07 — La lección
  { overlay: { headline: "Crea ahora. Con lo que tienes.", body: "La audiencia no quiere perfección. Quiere experiencia real. La tuya.", colorScheme: "light", position: "center", showLogo: true, elements: [] } },
  // slide-08 — Cierre + CTA
  { overlay: { headline: "¿Cuál es el conocimiento que tienes y que todavía no has convertido en contenido?", body: "Escríbelo en los comentarios.", signature: "— Alexander Cast", colorScheme: "light", showLogo: true, elements: [] } },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const config = await loadConfig();
  HANDLE = brandHandle(config);

  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  console.log(`\n✦ Content Forge — Carrusel tipográfico 2K · v7.2`);
  console.log(`  "No dejes tu trabajo. Úsalo." · 8 slides · 2160×2160`);
  console.log(`  Handle: ${HANDLE}  ·  Fondos CSS/SVG — gradientes · bokeh · grano`);
  console.log(`  Sin IA · sin API · renders locales vía resvg\n`);

  const SLIDES = [
    { name: "Hook"              },
    { name: "El error más común" },
    { name: "Por qué"            },
    { name: "En la práctica"     },
    { name: "Historia personal"  },
    { name: "La verdad"          },
    { name: "La lección"         },
    { name: "Cierre + CTA"       },
  ];

  const manifest = {
    concept:     "no-dejes-tu-trabajo",
    slug:        SLUG,
    date:        new Date().toISOString().slice(0, 10),
    platform:    "ig-carousel",
    resolution:  `${W}x${H}`,
    handle:      HANDLE,
    backgrounds: "CSS/SVG programático — gradientes, bokeh, grano, sin IA",
    generatedBy: "typographic-carousel.mjs v7.2",
    generatedAt: new Date().toISOString(),
    results:     [],
  };

  for (let i = 0; i < SLIDES.length; i++) {
    const num  = String(i + 1).padStart(2, "0");
    const file = `slide-${num}.png`;
    const { name } = SLIDES[i];

    try {
      process.stdout.write(`  ⟳ slide-${num} · fondo IA...`);
      const rawBuf = await generateBackground(config, i);

      // Solo background limpio 2K — sin texto, sin logo
      const bg2k = await sharp(rawBuf)
        .resize(W, H, { kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();
      await writeFile(join(OUT_DIR, file), bg2k);
      console.log(` ✓  —  ${name}`);

      manifest.results.push({
        id:           `slide-${num}`,
        ok:           true,
        path:         join(OUT_DIR, file),
        narrativeBeat: name,
      });
    } catch (err) {
      console.error(`\n  ✗ slide-${num} — ${err.message}`);
      manifest.results.push({ id: `slide-${num}`, ok: false, error: err.message });
    }
  }

  await writeFile(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\n  ✓ manifest.json`);

  // Escribe overlay-copy.json solo si no existe (no sobreescribe ediciones del usuario)
  const overlayCopyPath = join(OUT_DIR, "overlay-copy.json");
  if (!existsSync(overlayCopyPath)) {
    const slides = {};
    SLIDES.forEach((_, i) => {
      slides[`slide-${String(i+1).padStart(2,"0")}`] = SLIDE_OVERLAY_DEFS[i];
    });
    await writeFile(overlayCopyPath, JSON.stringify({ slides }, null, 2));
    console.log(`  ✓ overlay-copy.json  (texto pre-poblado para los 8 slides)`);
  } else {
    console.log(`  ⚠  overlay-copy.json ya existe — conservado sin cambios`);
  }

  console.log(`\n✦ Output: output/social/${SLUG}/`);
  console.log(`  slide-XX.png = background limpio listo para editar en el editor\n`);
}

main().catch(console.error);
