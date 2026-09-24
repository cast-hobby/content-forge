#!/usr/bin/env node
// test-typography.mjs — Preview del Design System v2.0 sin llamadas a API.
//
// Genera output/test-slide-01.png con el overlay del primer slide
// sobre un fondo editorial oscuro con glow dorado.
//
// Uso:
//   node scripts/test-typography.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync }       from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath }    from "node:url";
import sharp                from "sharp";
import { Resvg }            from "@resvg/resvg-js";
import { loadConfig }       from "./brand-system.mjs";
import {
  buildProOverlaySvg,
  renderSvgToPng,
  hexToRgb,
} from "./compose-overlay.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const FONTS_DIR = join(__dirname, "fonts");
const W = 1080, H = 1350;

// ─── Fondo editorial ──────────────────────────────────────────────────
// Simula la composición oscura del slide-01:
//   - Base #050505
//   - Glow dorado difuso en esquina inferior-izquierda (donde estaría Alexander)
//   - Glow secundario sutil en esquina superior-derecha
//   - Ruido/grain simulado con un patrón de líneas muy finos
function buildBackgroundSvg(palette) {
  const gold = palette.dark;
  const bg   = palette.primary;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <!-- Glow principal izquierda-centro (simula rim light del personaje) -->
      <radialGradient id="glow1" cx="18%" cy="72%" r="42%">
        <stop offset="0%"   stop-color="${gold}" stop-opacity="0.32"/>
        <stop offset="40%"  stop-color="${gold}" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="${bg}"   stop-opacity="0"/>
      </radialGradient>
      <!-- Glow secundario superior-derecha -->
      <radialGradient id="glow2" cx="82%" cy="18%" r="30%">
        <stop offset="0%"   stop-color="${gold}" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="${bg}"   stop-opacity="0"/>
      </radialGradient>
      <!-- Vignette de borde -->
      <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
        <stop offset="55%"  stop-color="${bg}" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
      </radialGradient>
    </defs>

    <!-- Base negro profundo -->
    <rect width="${W}" height="${H}" fill="${bg}"/>

    <!-- Glow dorado izquierda -->
    <rect width="${W}" height="${H}" fill="url(#glow1)"/>

    <!-- Glow sutil derecha -->
    <rect width="${W}" height="${H}" fill="url(#glow2)"/>

    <!-- Vignette perimetral -->
    <rect width="${W}" height="${H}" fill="url(#vignette)"/>

    <!-- Placeholder de personaje: silueta oscura difusa en centro-derecha -->
    <ellipse cx="${Math.round(W * 0.62)}" cy="${Math.round(H * 0.58)}"
             rx="${Math.round(W * 0.28)}" ry="${Math.round(H * 0.38)}"
             fill="#000000" opacity="0.20"/>
  </svg>`;
}

// ─── Overlay del slide-01 (diseño pro) ────────────────────────────────
// Este es el overlay que se aplicará:
//   - Chip "IA TOOLS" en top-left
//   - Accent bar entre eyebrow y cuerpo principal
//   - Headline grande en la parte inferior (v1.0 legacy para el test)
//   - Body corto en gris
//   - Signature @alexemprendee con accent bar dorada sobre ella
function buildSlide01Overlay() {
  return {
    // ← Sin sub-objeto `overlay` → usa el path v1.0 legacy
    //   que renderiza todo por SVG para ver el diseño completo
    elements: [
      // Chip "IA TOOLS" con fondo dorado semitransparente
      {
        type:        "chip",
        text:        "IA TOOLS",
        position:    "top-left",
        color:       "gold",
        textColor:   "gold",
        borderColor: "gold",
        scale:       "label",
      },
      // Accent bar en top-left justo sobre el glow
      {
        type:       "accent-bar",
        position:   "bottom-signature-above",
        color:      "gold",
        widthRatio: 0.055,
        thickness:  2.5,
        opacity:    1.0,
      },
    ],
    headline:    "GPT Image 2 cambió las reglas.",
    body:        "El modelo de OpenAI que entiende contexto, edita partes de una imagen y pone texto legible. Eso cambia todo.",
    signature:   "@alexemprendee",
    microCopy:   "",
    position:    "bottom",
    colorScheme: "dark",
    showLogo:    false, // Sin logo en el test (archivo puede no existir)
  };
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  const config  = await loadConfig();
  const palette = config.colors;

  console.log("🎨 Content Forge · Test de tipografía v2.0");
  console.log(`   Canvas: ${W}×${H} · Paleta: ${palette.primary} + ${palette.dark}`);

  // 1. Crear fondo
  const bgSvg  = buildBackgroundSvg(palette);
  const resvgBg = new Resvg(bgSvg, {
    fitTo:      { mode: "width", value: W },
    font:       { fontDirs: [FONTS_DIR], loadSystemFonts: false, defaultFontFamily: "Inter" },
    background: `rgba(${hexToRgb(palette.primary)}, 1)`,
  });
  const bgPng = Buffer.from(resvgBg.render().asPng());
  console.log("   ✓ Fondo generado");

  // 2. Construir overlay SVG
  const overlay    = buildSlide01Overlay();
  const overlaySvg = buildProOverlaySvg({
    width:   W,
    height:  H,
    overlay,
    layout:  null,
    palette,
  });

  // 3. Renderizar overlay a PNG
  const overlayPng = await renderSvgToPng(overlaySvg, W);
  console.log("   ✓ Overlay SVG renderizado");

  // 4. Compositar: fondo + overlay
  const finalPng = await sharp(bgPng)
    .composite([{ input: overlayPng, top: 0, left: 0, blend: "over" }])
    .png({ compressionLevel: 8 })
    .toBuffer();

  // 5. Guardar
  const outDir  = join(ROOT, "output");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "test-slide-01.png");
  await writeFile(outPath, finalPng);

  console.log(`\n✅ Slide de prueba guardado:`);
  console.log(`   ${outPath}`);
  console.log(`\n   Elementos aplicados:`);
  console.log(`   · Chip "IA TOOLS" (Inter Bold, gold pill, top-left)`);
  console.log(`   · Accent bar dorada (decorativa, top-left y sobre signature)`);
  console.log(`   · Headline Anton "${overlay.headline.slice(0, 40)}..."`);
  console.log(`   · Body Inter Regular (gris)`);
  console.log(`   · Signature @alexemprendee (Inter SemiBold, dorado)`);
  console.log(`   · Scrim cinematográfico 4-stop (bottom)`);
  console.log(`\n   Márgenes: ${Math.round(W * 0.080)}px lados · ${Math.round(H * 0.070)}px top · ${Math.round(H * 0.082)}px bottom`);
}

main().catch((err) => { console.error("Fatal:", err?.message ?? err); process.exit(1); });
