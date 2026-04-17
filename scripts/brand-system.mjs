// brand-system.mjs — Core del sistema de marca para Content Forge.
//
// Lee brand.config.json (creado por setup.mjs) y expone:
//   - loadConfig()              → config completa validada
//   - buildPrompt({concept,...}) → prompt para Nanobanana con BRAND_BASE + BRAND_NEGATIVE
//   - resolveLogo(backgroundHint) → path al PNG del logo correcto
//   - brandPalette(), brandFonts() → shortcuts
//
// La marca NO está hardcoded — todo viene del config del usuario.

import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONFIG_PATH = join(ROOT, "brand.config.json");

let cached = null;

/**
 * Carga brand.config.json, valida lo mínimo y cachea.
 */
export async function loadConfig() {
  if (cached) return cached;

  try {
    await access(CONFIG_PATH, constants.R_OK);
  } catch {
    throw new Error(
      `No existe brand.config.json en ${CONFIG_PATH}.\n` +
      `Corre primero: npm run setup`
    );
  }

  const raw = await readFile(CONFIG_PATH, "utf8");
  const config = JSON.parse(raw);

  // Validaciones mínimas
  if (!config.brand?.name) throw new Error("brand.config.json: falta brand.name");
  if (!config.colors?.primary) throw new Error("brand.config.json: falta colors.primary");
  if (!config.logo?.darkVariant) throw new Error("brand.config.json: falta logo.darkVariant");

  cached = config;
  return config;
}

/**
 * Reset del cache (tests, reload en runtime).
 */
export function resetCache() {
  cached = null;
}

/**
 * Construye el BRAND_BASE dinámico a partir del config del usuario.
 * Es el texto que se prepende a cada prompt de Nanobanana para que las
 * imágenes respeten la estética de la marca.
 */
export function buildBrandBase(config) {
  const { colors, brand } = config;
  return `
${brand.name} brand aesthetic: editorial boutique, premium without coldness.
Background color: pure ${colors.dark} editorial dark, or ${colors.light} boutique light for soft compositions.
Accent color: ${colors.primary} (used as deliberate highlight, never overwhelming).
Secondary neutrals: ${colors.grayDark} dark graphite, ${colors.grayLight} soft gray.
Mood: cinematic, documentary, systematized, human, premium, confident.
Lighting: warm directional natural light, rim light in accent color, crushed deep shadows, preserved highlights.
Color grade: slight warm cast, -15% saturation, medium-high contrast, fine film grain.
Composition: minimal, intentional, editorial magazine style, generous negative space.
Texture: matte finish, subtle grain, premium print sensibility.
  `.trim();
}

/**
 * Negative prompt universal — bloquea texto espurio, estilos indeseados
 * y colores fuera de paleta. Se refuerza con colores específicos del usuario.
 */
export function buildBrandNegative(config) {
  const { colors } = config;
  const offPaletteColors = [
    "#FFD60A", "#FF0080", "#00FF00", "#FF00FF",
  ].filter((c) => c.toUpperCase() !== colors.primary.toUpperCase()).join(", ");

  return `
CRITICAL — DO NOT RENDER ANY TEXT OR TYPOGRAPHY INSIDE THE IMAGE:
absolutely no letters, no words, no captions, no headlines, no labels, no UI text,
no numbers, no numerals, no digits, no percentages, no dates, no roman numerals,
no logos, no watermarks, no signatures, no brand marks, no typographic ornaments,
no handwritten text, no signage, no book covers with readable spine, no shop signs,
no phone screens showing readable text, no t-shirts with visible wording.
If a scene would naturally include text, render that surface completely blank.

Style negatives:
no stock photo style, no corporate handshakes, no generic office imagery,
no instagram filters, no 3D render look, no cartoon, no illustration style, no emoji,
no curved organic decorative shapes, no gradient rainbow backgrounds,
no AI-generated fake-looking faces, no oversharpened edges,
no colors outside brand palette (avoid ${offPaletteColors}),
the accent color must be exactly ${colors.primary}.
  `.trim();
}

/**
 * Construye un prompt final para Nanobanana.
 * @param {object} config   - brand.config.json loaded
 * @param {object} opts
 * @param {string} opts.concept      - descripción específica del visual buscado
 * @param {string} [opts.composition] - notas de composición
 * @param {string} [opts.extra]       - refuerzos adicionales
 * @param {object} [opts.character]   - si el slide usa character, { description, usageHint }
 */
export function buildPrompt(config, { concept, composition = "", extra = "", character = null }) {
  const base = buildBrandBase(config);
  const negative = buildBrandNegative(config);

  let characterInjection = "";
  if (character?.description) {
    characterInjection = [
      "",
      "Character consistency:",
      `The scene features the person described below. Keep their facial features, hair, build and style consistent with the reference images attached.`,
      `Character description: ${character.description}`,
      character.usageHint ? `Pose/context: ${character.usageHint}` : "",
    ].filter(Boolean).join("\n");
  }

  return [
    base,
    "",
    "Scene: " + concept,
    composition && "Composition: " + composition,
    extra,
    characterInjection,
    "",
    "Negative: " + negative,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Decide qué variante del logo usar según el fondo del slide.
 * Devuelve path absoluto al PNG.
 */
export function resolveLogo(config, backgroundHint = "dark") {
  const hint = String(backgroundHint).toLowerCase();
  const base = config.logo;

  if (
    hint.includes("cream") ||
    hint.includes("light") ||
    hint.includes("white") ||
    hint === (config.colors.light || "").toLowerCase()
  ) {
    return join(ROOT, base.lightVariant);
  }

  return join(ROOT, base.darkVariant);
}

/**
 * Shortcut: devuelve paleta.
 */
export function brandPalette(config) {
  return { ...config.colors };
}

/**
 * Shortcut: devuelve fuentes.
 */
export function brandFonts(config) {
  return { ...config.fonts };
}

/**
 * Shortcut: devuelve handle oficial (único @ permitido).
 */
export function brandHandle(config) {
  return config.brand.handle;
}

/**
 * Calcula luminancia relativa para WCAG.
 */
export function relativeLuminance(hex) {
  const rgb = hex.match(/#(..)(..)(..)/).slice(1).map((c) => parseInt(c, 16) / 255);
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Ratio de contraste WCAG entre dos hex.
 */
export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Devuelve el color de texto óptimo (dark o light) para un fondo dado.
 */
export function textColorFor(config, backgroundHex) {
  const { dark, light, white } = config.colors;
  const ratioLight = contrastRatio(backgroundHex, light);
  const ratioWhite = contrastRatio(backgroundHex, white);
  const ratioDark = contrastRatio(backgroundHex, dark);
  const best = Math.max(ratioLight, ratioWhite, ratioDark);
  if (best === ratioDark) return dark;
  if (best === ratioWhite) return white;
  return light;
}
