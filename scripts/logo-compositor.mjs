// logo-compositor.mjs — Composita logos SVG reales en franja inferior de la imagen
//
// Flujo:
//   1. Recibe imageBuffer + slugs[] de SimpleIcons
//   2. Fetch SVG desde cdn.simpleicons.org → rasteriza a PNG 56×56 con resvg-js
//   3. Crea franja inferior (LOGO_BAR_RATIO de la altura total)
//      → fondo #0A0A0A semitransparente + logos centrados
//   4. Composita sobre imagen original con sharp
//   5. Devuelve { buffer, logoZone: { y, h } } donde y,h ∈ [0,1]

import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

const LOGO_BAR_RATIO = 0.13;      // 13% inferior de la imagen
const LOGO_SIZE      = 52;        // px de cada logo en la franja
const LOGO_GAP       = 28;        // px entre logos
const BAR_PADDING_X  = 36;        // padding horizontal de la franja
const BAR_BG_COLOR   = { r: 10, g: 10, b: 10, alpha: 0.88 };
const ICON_CDN       = "https://cdn.simpleicons.org";
const FETCH_TIMEOUT  = 6_000;

/**
 * @param {Buffer} imageBuffer   Imagen PNG/JPEG generada por AI
 * @param {string[]} slugs       SimpleIcons slugs (ej: ["n8n", "supabase"])
 * @returns {Promise<{ buffer: Buffer, logoZone: { y: number, h: number } }>}
 */
export async function compositePlatformLogos(imageBuffer, slugs) {
  if (!slugs || slugs.length === 0) {
    return { buffer: imageBuffer, logoZone: null };
  }

  const meta   = await sharp(imageBuffer).metadata();
  const imgW   = meta.width;
  const imgH   = meta.height;
  const barH   = Math.round(imgH * LOGO_BAR_RATIO);
  const barY   = imgH - barH;

  // 1. Rasterizar logos a PNG 56×56
  const logoBuffers = await Promise.all(
    slugs.map(slug => fetchAndRasterizeLogo(slug, LOGO_SIZE))
  );
  const validLogos = logoBuffers.filter(Boolean);

  if (validLogos.length === 0) {
    return { buffer: imageBuffer, logoZone: null };
  }

  // 2. Calcular ancho total de logos para centrarlos
  const totalLogosW = validLogos.length * LOGO_SIZE + (validLogos.length - 1) * LOGO_GAP;
  const startX      = Math.max(BAR_PADDING_X, Math.round((imgW - totalLogosW) / 2));

  // 3. Crear franja oscura semitransparente
  const barOverlay = await sharp({
    create: {
      width:      imgW,
      height:     barH,
      channels:   4,
      background: BAR_BG_COLOR,
    }
  }).png().toBuffer();

  // 4. Compositar logos dentro de la franja (posiciones relativas a la franja)
  const logoComposites = validLogos.map((buf, i) => ({
    input: buf,
    left:  startX + i * (LOGO_SIZE + LOGO_GAP),
    top:   Math.round((barH - LOGO_SIZE) / 2),
  }));

  const barWithLogos = await sharp(barOverlay)
    .composite(logoComposites)
    .png()
    .toBuffer();

  // 5. Compositar franja sobre imagen original
  const result = await sharp(imageBuffer)
    .composite([{ input: barWithLogos, left: 0, top: barY }])
    .png()
    .toBuffer();

  return {
    buffer:   result,
    logoZone: { y: barY / imgH, h: LOGO_BAR_RATIO },
  };
}

async function fetchAndRasterizeLogo(slug, size) {
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(`${ICON_CDN}/${slug}/FFFFFF`, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return null;

    const svgText = await res.text();
    if (!svgText.includes("<svg")) return null;

    // Forzar dimensiones en el SVG para que resvg lo respete
    const sized = svgText.replace(
      /<svg([^>]*)>/,
      `<svg$1 width="${size}" height="${size}">`
    );

    const resvg  = new Resvg(sized, { fitTo: { mode: "width", value: size } });
    const pngData = resvg.render();
    return pngData.asPng();
  } catch {
    return null;
  }
}
