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
 * y colores fuera de paleta.
 *
 * Modo dual:
 *   - allowText=false (default): bloquea TODA forma de texto. Úsalo cuando el
 *     slide NO lleva texto integrado y el overlay tipográfico se aplicará después.
 *   - allowText=true: permite exclusivamente el texto autorizado que se pide en
 *     buildTextInImageBlock; sigue bloqueando texto espurio en superficies
 *     ambientales (libros, carteles, pantallas, ropa).
 */
export function buildBrandNegative(config, { allowText = false } = {}) {
  const { colors } = config;
  const offPaletteColors = [
    "#FFD60A", "#FF0080", "#00FF00", "#FF00FF",
  ].filter((c) => c.toUpperCase() !== colors.primary.toUpperCase()).join(", ");

  const textBlock = allowText
    ? `
TEXT RULES (authorized headline/eyebrow only):
Render ONLY the text explicitly specified in the TEXT IN IMAGE block above.
Character-by-character fidelity: do NOT misspell, do NOT paraphrase, do NOT translate.
No other text anywhere — no labels on books, no signs on walls, no text on phone
screens, no prices, no dates, no fake logos of other brands, no watermarks,
no signatures, no handwritten notes, no UI mockups with text.
If a surface would naturally carry text, leave it completely blank.
    `.trim()
    : `
CRITICAL — DO NOT RENDER ANY TEXT OR TYPOGRAPHY INSIDE THE IMAGE:
absolutely no letters, no words, no captions, no headlines, no labels, no UI text,
no numbers, no numerals, no digits, no percentages, no dates, no roman numerals,
no logos, no watermarks, no signatures, no brand marks, no typographic ornaments,
no handwritten text, no signage, no book covers with readable spine, no shop signs,
no phone screens showing readable text, no t-shirts with visible wording.
If a scene would naturally include text, render that surface completely blank.
    `.trim();

  return `
${textBlock}

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
 * Convierte un nombre simbólico de color al hex real del config del usuario.
 */
function resolveColorToken(config, token) {
  const { colors } = config;
  switch (String(token || "").toLowerCase()) {
    case "accent":
    case "primary":
      return colors.primary;
    case "dark":
      return colors.dark;
    case "light":
      return colors.light;
    case "white":
      return colors.white || "#FFFFFF";
    case "gray-dark":
    case "graydark":
      return colors.grayDark;
    case "gray-light":
    case "graylight":
    case "light-muted":
      return colors.grayLight;
    case "auto":
      return "auto (pick the brand palette color with the highest legibility over the local image area — usually light over dark backgrounds and dark over cream)";
    default:
      return token || colors.light;
  }
}

/**
 * Paleta tipográfica expandida. Cada estilo describe familia, peso, tratamiento
 * y carácter. gpt-image-2 interpreta muy bien estas descripciones y reproduce
 * el "look" incluso sin cargar la fuente real.
 *
 * Se permite mezclar hasta 2 familias (p. ej. serif-editorial + mono-callout)
 * en el mismo slide para crear jerarquía visual real.
 */
function describeTypographyStyle(style, config) {
  const displayFont = config.fonts?.display || "Anton";
  const sansFont = config.fonts?.sans || "Inter";
  const s = String(style || "display-medium").toLowerCase();
  switch (s) {
    // ── Display / Headlines ─────────────────────────────────────
    case "display-xl":
      return `enormous bold condensed sans-serif display typeface reminiscent of ${displayFont} Black — extremely tight line-height, massive vertical impact, covers 40-55% of the frame width, uppercase`;
    case "display-large":
      return `large bold condensed uppercase sans-serif display typeface reminiscent of ${displayFont} — tight line-height, strong vertical rhythm, high-impact editorial headline`;
    case "display-medium":
      return `medium bold condensed sans-serif display typeface reminiscent of ${displayFont} — editorial weight, uppercase, balanced tracking`;
    case "display-stacked":
      return `bold condensed sans-serif display stacked line by line, each word or phrase on its own baseline with tight leading (0.92), dramatic vertical rhythm, uppercase`;
    case "display-outline":
      return `bold condensed display typeface rendered as outline only (hollow letters), 1.5-2pt stroke, no fill, uppercase`;

    // ── Serifs ─────────────────────────────────────────────────
    case "serif-editorial":
    case "editorial-serif":
      return `refined high-contrast serif display (think Didone / Bodoni / Playfair Display), mixed case, generous tracking, quiet luxury feel, thin hairlines and strong verticals`;
    case "serif-elegant":
      return `elegant modern serif reminiscent of GT Sectra or Canela — mid-contrast, italic option feels handwritten-editorial, mixed case, long ascenders`;
    case "serif-book":
      return `classic book serif reminiscent of Garamond or Sabon, regular weight, mixed case, generous leading, reads like a quiet editorial magazine`;
    case "serif-italic-quote":
      return `italic serif display (Caslon Italic / Playfair Italic), mixed case, used for a pull quote — the italic angle gives motion and voice`;

    // ── Big numbers / stats ────────────────────────────────────
    case "number-gigante":
    case "stat-number":
      return `enormous condensed sans-serif numeral reminiscent of ${displayFont} Black — occupies 30-50% of the frame width, ultra-tight leading, dramatic weight, no decorative flourishes, reads as the single hero element of the slide`;
    case "number-serif":
      return `enormous serif numeral reminiscent of Didot or Bodoni Poster — elegant high-contrast strokes, occupies 30-45% of the frame width, editorial magazine feel`;

    // ── Labels / eyebrows ──────────────────────────────────────
    case "label-small":
      return `tiny uppercase sans-serif label reminiscent of ${sansFont} SemiBold, wide letter-spacing (0.12em), crisp and geometric`;
    case "label-with-rule":
      return `tiny uppercase sans-serif label with a 1px horizontal rule directly above or below it, wide letter-spacing (0.16em), editorial category marker`;
    case "tag-pill":
      return `small uppercase sans-serif label inside a rounded pill / chip shape, medium weight, tight inner padding, subtle fill`;

    // ── Body / paragraphs ──────────────────────────────────────
    case "body":
    case "body-sans":
      return `medium sans-serif body text reminiscent of ${sansFont} Regular, sentence case, readable 1.4 line-height, left-aligned`;
    case "body-serif":
      return `medium serif body text reminiscent of a literary book typeface, sentence case, 1.45 line-height, left-aligned or justified, editorial long-form feel`;
    case "body-compact":
      return `small tight-leading sans-serif body reminiscent of ${sansFont} Regular 13pt, dense paragraph block, left-aligned`;
    case "lead-paragraph":
      return `mid-size lead paragraph in sans-serif Medium weight — slightly larger than body, relaxed leading, sits right under the headline to amplify it`;

    // ── Captions / attribution ─────────────────────────────────
    case "caption-small":
      return `small sans-serif caption reminiscent of ${sansFont} Regular, sentence case, tight tracking`;
    case "attribution":
      return `small sans-serif attribution preceded by an em-dash ("— Source Name"), italic or regular, muted color, right-aligned if under a pull quote`;

    // ── Mono / callout ─────────────────────────────────────────
    case "mono-callout":
      return `monospace typeface reminiscent of JetBrains Mono / IBM Plex Mono, medium weight, wide tracking — used for code-like callouts or data highlights`;
    case "mono-label":
      return `small monospace label, uppercase, wide letter-spacing — gives a technical / editorial data vibe`;

    // ── Handwritten accents ────────────────────────────────────
    case "handwritten-accent":
      return `short handwritten accent in brush-pen or marker style, imperfect stroke, 3-6 words max — used to annotate or circle a key idea`;
    case "handwritten-underline":
      return `handwritten underline or circle drawn by a marker pen on top of a printed word, slight imperfection, accent color`;

    // ── Decorative / structural ────────────────────────────────
    case "divider-rule":
      return `thin 1px horizontal or vertical rule across the composition, no text, structural separator`;
    case "number-dot-list":
      return `numbered list "01 / 02 / 03" — each item starts with a two-digit numeral in bold sans-serif followed by a short phrase in medium sans-serif, generous vertical spacing between items`;

    default:
      return `sans-serif typeface matching the brand's editorial tone`;
  }
}

/**
 * Bloque de márgenes y safe zones. Se emite SIEMPRE en cada prompt. Evita que
 * el generador pinte texto pegado al borde (problema recurrente de gpt-image-2
 * cuando se le pide "top-left" sin padding explícito).
 *
 * Presets:
 *   - editorial (default) → 8% padding en los 4 lados
 *   - gutter              → 12% padding (carousel magazine feel)
 *   - tight               → 5% padding (feed compact)
 *   - hero                → 10% padding (slides portada)
 */
export function buildMarginBlock(marginPreset = "editorial") {
  const presets = {
    editorial: { pct: 8,  label: "editorial boutique" },
    gutter:    { pct: 12, label: "wide magazine gutter" },
    tight:     { pct: 5,  label: "feed-tight" },
    hero:      { pct: 10, label: "hero cover" },
  };
  const p = presets[marginPreset] || presets.editorial;
  return [
    "",
    "── SAFE MARGINS (non-negotiable) ──",
    `Respect a ${p.label} margin of approximately ${p.pct}% of the frame width on every side (top, bottom, left, right).`,
    `All rendered text, typography and logos must sit comfortably INSIDE this safe area — never touching or crossing the edge of the frame.`,
    `Letters cannot be cropped. Descenders and ascenders must clear the safe line.`,
    `The background photograph can extend to the edge; only text and graphic chrome are constrained.`,
    `If a layout position is "top-left", interpret it as "inside the upper-left safe area" — not against the border.`,
  ].join("\n");
}

/**
 * Traduce un elemento de textPayload.renderInImage en instrucciones literales
 * para el generador, con texto entre comillas y specs tipográficas.
 */
function renderTextElementInstruction({ role, element, config }) {
  if (!element?.text) return null;
  const color = resolveColorToken(config, element.color);
  const typo = describeTypographyStyle(element.style, config);
  const position = element.position || "top-center";
  const maxLines = element.maxLines ? ` · max ${element.maxLines} line(s)` : "";
  const breakHint = element.break_after ? ` · insert a line break immediately after "${element.break_after}"` : "";
  const tracking = element.letterSpacing ? ` · letter-spacing ${element.letterSpacing}` : "";
  const caseHint = element.case ? ` · ${element.case}` : "";
  const italicHint = element.italic ? ` · rendered italic` : "";
  const decoration = element.decoration ? ` · ${element.decoration}` : "";
  return [
    `• ${role.toUpperCase()} — render the exact text: "${element.text}"`,
    `    typography: ${typo}${tracking}${caseHint}${italicHint}${decoration}`,
    `    color: ${color}`,
    `    position: ${position}${maxLines}${breakHint}`,
    `    must be crisp, legible, no spelling drift, no substitutions, no additional words`,
  ].join("\n");
}

/**
 * Elemento "stat" = número gigante + label descriptivo. Muy efectivo en slides
 * de dato duro. Ejemplo: "63%" grande + "no llega al año 1" pequeño debajo.
 */
function renderStatInstruction({ element, config }) {
  if (!element?.number) return null;
  const numColor = resolveColorToken(config, element.numberColor || element.color || "accent");
  const labelColor = resolveColorToken(config, element.labelColor || "light");
  const numStyle = describeTypographyStyle(element.numberStyle || "number-gigante", config);
  const labelStyle = describeTypographyStyle(element.labelStyle || "label-small", config);
  const position = element.position || "center";
  const anchor = element.labelPosition || "below-number";
  return [
    `• STAT — render the huge number: "${element.number}"`,
    `    number typography: ${numStyle}`,
    `    number color: ${numColor}`,
    `    number position: ${position}`,
    element.label ? `    with the supporting label below: "${element.label}"` : "",
    element.label ? `    label typography: ${labelStyle}` : "",
    element.label ? `    label color: ${labelColor}` : "",
    element.label ? `    label anchor: ${anchor} (flush to the number)` : "",
    element.trend ? `    trend indicator: ${element.trend} (arrow or small directional mark)` : "",
    `    the number should dominate the composition — 30-50% of the frame width`,
  ].filter(Boolean).join("\n");
}

/**
 * Pull quote: cita editorial en serif italic + attribution. El tipo de elemento
 * que transforma un slide de "lista de tips" a "editorial de revista".
 */
function renderPullQuoteInstruction({ element, config }) {
  if (!element?.text) return null;
  const quoteColor = resolveColorToken(config, element.color || "light");
  const attrColor = resolveColorToken(config, element.attributionColor || "light-muted");
  const quoteStyle = describeTypographyStyle(element.style || "serif-italic-quote", config);
  const attrStyle = describeTypographyStyle("attribution", config);
  const position = element.position || "center";
  return [
    `• PULL QUOTE — render the opening curly quote “ then the exact quote: "${element.text}" then closing curly quote ”`,
    `    quote typography: ${quoteStyle}`,
    `    quote color: ${quoteColor}`,
    `    position: ${position}`,
    element.attribution ? `    attribution below, right-aligned under the quote: "— ${element.attribution}"` : "",
    element.attribution ? `    attribution typography: ${attrStyle}` : "",
    element.attribution ? `    attribution color: ${attrColor}` : "",
    `    allow generous negative space around the quote — editorial magazine feel`,
  ].filter(Boolean).join("\n");
}

/**
 * Body paragraph — 20-80 palabras en un bloque denso tipográfico. El modelo
 * debe renderizarlo como texto real y legible, no como garabatos.
 */
function renderBodyInstruction({ element, config }) {
  if (!element?.text) return null;
  const color = resolveColorToken(config, element.color || "light");
  const style = describeTypographyStyle(element.style || "body-sans", config);
  const position = element.position || "mid";
  const align = element.align || "left";
  const width = element.widthRatio ? `${element.widthRatio * 100}% of frame width` : "55-65% of frame width";
  return [
    `• BODY — render the exact paragraph verbatim: "${element.text}"`,
    `    typography: ${style}`,
    `    color: ${color}`,
    `    position: ${position} · ${align}-aligned · column width ≈ ${width}`,
    `    preserve every word, every punctuation mark, every accent character`,
    `    use natural line breaks that respect the column width — 5-10 words per line ideal`,
    `    adequate leading (1.4-1.5) so the block breathes`,
  ].join("\n");
}

/**
 * Numbered list: "01 Title · 02 Title · 03 Title" en stack vertical. Ideal
 * para slides de framework o checklist editoriales.
 */
function renderListInstruction({ element, config }) {
  if (!element?.items || !Array.isArray(element.items) || element.items.length === 0) return null;
  const numColor = resolveColorToken(config, element.numberColor || "accent");
  const textColor = resolveColorToken(config, element.color || "light");
  const position = element.position || "mid-left";
  const numberStyle = element.numberStyle || "two-digit";
  const numberFormat = numberStyle === "two-digit"
    ? "two-digit zero-padded numerals (01, 02, 03)"
    : "single-digit plain numerals (1, 2, 3)";
  const itemsBlock = element.items.map((item, i) => {
    const n = String(i + 1).padStart(numberStyle === "two-digit" ? 2 : 1, "0");
    return `      ${n}  ${item}`;
  }).join("\n");
  return [
    `• NUMBERED LIST — render each item verbatim with its numeral prefix:`,
    itemsBlock,
    `    number typography: bold condensed sans-serif, large (120-160% the size of item text), color ${numColor}`,
    `    number format: ${numberFormat}`,
    `    item text typography: medium sans-serif, regular weight, color ${textColor}`,
    `    position: ${position} · vertical stack, generous gap between items (20-30% of item height)`,
    `    total list occupies 55-70% of the vertical space`,
  ].join("\n");
}

/**
 * Callout: caja con texto destacado (dato, regla, advertencia). Visualmente
 * un recuadro con fondo sutil o borde.
 */
function renderCalloutInstruction({ element, config }) {
  if (!element?.text) return null;
  const color = resolveColorToken(config, element.color || "light");
  const borderColor = resolveColorToken(config, element.borderColor || "accent");
  const position = element.position || "mid";
  const variant = element.variant || "outlined";
  const style = describeTypographyStyle(element.style || "body-sans", config);
  return [
    `• CALLOUT BOX — render the exact text inside a ${variant} container: "${element.text}"`,
    `    box: ${variant === "outlined" ? `thin 1.5px border in ${borderColor}, no fill` : `subtle tinted fill in ${borderColor} at 8-12% opacity`} · rounded corners 8-14px · comfortable inner padding`,
    `    text typography: ${style}`,
    `    text color: ${color}`,
    `    position: ${position} · box width 55-75% of frame`,
    `    box sits as an editorial standout — a quiet but unmistakable highlight`,
  ].join("\n");
}

/**
 * Bloque de texto-en-imagen. Ahora soporta: eyebrow, headline, subhead,
 * data_chip, body (párrafo), stat (número gigante), pullQuote, list, callout.
 */
export function buildTextInImageBlock(textPayload, config) {
  if (!textPayload?.renderInImage) return { block: "", hasText: false };
  const r = textPayload.renderInImage;

  const instructions = [
    r.eyebrow && renderTextElementInstruction({ role: "eyebrow", element: r.eyebrow, config }),
    r.headline && renderTextElementInstruction({ role: "headline", element: r.headline, config }),
    r.subhead && renderTextElementInstruction({ role: "subhead", element: r.subhead, config }),
    r.data_chip && renderTextElementInstruction({ role: "data-chip (source)", element: r.data_chip, config }),
    r.stat && renderStatInstruction({ element: r.stat, config }),
    r.pullQuote && renderPullQuoteInstruction({ element: r.pullQuote, config }),
    r.body && renderBodyInstruction({ element: r.body, config }),
    r.list && renderListInstruction({ element: r.list, config }),
    r.callout && renderCalloutInstruction({ element: r.callout, config }),
  ].filter(Boolean);

  if (instructions.length === 0) return { block: "", hasText: false };

  const block = [
    "",
    "── TEXT IN IMAGE (integrate as editorial typography, not pasted labels) ──",
    "The generator must render these elements INSIDE the image as part of the design.",
    "Treat every text element as typography designed by an art director: the composition",
    "reserves deliberate space for it, the lighting respects its legibility, and multiple",
    "elements create real visual hierarchy (contrast between serif and sans, between",
    "display weight and body weight, between accent color and neutral tones).",
    "",
    "Creative freedom with hierarchy:",
    "  - Mix up to 2 type families per slide (e.g. a bold condensed sans display +",
    "    a lighter serif body) to create editorial contrast.",
    "  - Use scale jumps: the headline should be clearly larger than any body or caption.",
    "  - Use color contrast: accent color for 1 highlight element, neutrals for the rest.",
    "  - Respect the SAFE MARGINS block above — no letter touches the frame edge.",
    "",
    ...instructions,
    "",
    "All text must be rendered in-camera with correct kerning, no artifacts, no duplicated",
    "words, no cropped letters. If any element cannot fit inside the safe area at readable",
    "size, reduce its size rather than cropping — legibility always wins over drama.",
  ].join("\n");

  return { block, hasText: true };
}

/**
 * Transforma el sceneSeed del brief en un bloque de "scene bible" que se
 * inyecta en cada slide del mismo carrusel. Asegura coherencia visual:
 * misma luz, misma paleta, mismo prop recurrente, mismo mood.
 */
export function buildSceneSeedBlock(sceneSeed) {
  if (!sceneSeed) return "";
  const lines = [
    "",
    "── SCENE BIBLE (shared across all slides in this carousel — do not deviate) ──",
    sceneSeed.dominantColor && `Dominant color anchor: ${sceneSeed.dominantColor} (must read clearly in the frame).`,
    sceneSeed.secondaryColor && `Secondary tone: ${sceneSeed.secondaryColor}.`,
    sceneSeed.lightAngle && `Light direction: ${sceneSeed.lightAngle}.`,
    sceneSeed.lightIntensity && `Light quality: ${sceneSeed.lightIntensity}.`,
    sceneSeed.mood && `Overall mood: ${sceneSeed.mood}.`,
    sceneSeed.cameraPreference && `Camera / grade: ${sceneSeed.cameraPreference}.`,
    sceneSeed.wardrobeTone && `Wardrobe palette and texture: ${sceneSeed.wardrobeTone}.`,
    sceneSeed.backgroundFamily && `Background family: ${sceneSeed.backgroundFamily}.`,
    sceneSeed.recurringProp && `Recurring prop (appears literal or implied): ${sceneSeed.recurringProp}.`,
    "Treat the entire carousel as one photoshoot session — time of day, wardrobe silhouette and color temperature stay constant unless the brief explicitly breaks the pattern.",
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Construye un prompt final para Fase A (composición con gpt-image-2).
 *
 * En el pipeline de 2 fases:
 *   - Fase A (gpt-image-2): genera la composición editorial con un "placeholder"
 *     humano genérico (no la identidad real). Aprovecha la dirección artística
 *     de OpenAI sin luchar contra el modelo por la cara.
 *   - Fase B (Gemini + refs): reemplaza al placeholder por el personaje real
 *     usando las reference images. Ver swapCharacterGemini() en generate-social.mjs.
 *
 * @param {object} config   - brand.config.json loaded
 * @param {object} opts
 * @param {string} opts.concept         - descripción específica del visual buscado
 * @param {string} [opts.composition]   - notas de composición
 * @param {string} [opts.extra]         - refuerzos adicionales
 * @param {object} [opts.character]     - si el slide usa character, { description, usageHint }
 * @param {object} [opts.sceneSeed]     - scene bible heredada del brief (ver buildSceneSeedBlock)
 * @param {object} [opts.continuity]    - { connectsToPrevious, connectsToNext, narrativeLink }
 * @param {string} [opts.narrativeBeat] - "hook"|"setup"|"tension"|"insight"|"proof"|"cta"
 */
export function buildPrompt(config, {
  concept,
  composition = "",
  extra = "",
  character = null,
  sceneSeed = null,
  continuity = null,
  narrativeBeat = null,
  textPayload = null,
}) {
  const base = buildBrandBase(config);
  const marginPreset = textPayload?.margin || "editorial";
  const marginBlock = buildMarginBlock(marginPreset);
  const textInImage = buildTextInImageBlock(textPayload, config);
  const negative = buildBrandNegative(config, { allowText: textInImage.hasText });
  const sceneBible = buildSceneSeedBlock(sceneSeed);

  let characterInjection = "";
  if (character) {
    // Placeholder demográfico genérico — la identidad exacta se resuelve en Fase B.
    // Si hay sceneSeed con wardrobeTone, amarramos el outfit al tono compartido
    // para que el swap de Fase B no tenga que pelear con ropa incompatible.
    const placeholder = character.placeholder
      || "a person in their 30s, warm natural presence, Latin American vibe, relaxed but confident posture";
    const wardrobeLine = sceneSeed?.wardrobeTone
      ? `Wardrobe must match the scene bible wardrobe palette: ${sceneSeed.wardrobeTone}.`
      : "";
    characterInjection = [
      "",
      "Human subject (placeholder — identity will be refined post-hoc):",
      `The scene features ${placeholder}.`,
      "Render the body, posture, clothing and hands with realism and editorial intention.",
      "Faces can be partially obscured, profile, three-quarter, or shown at a distance — the final identity pass will refine facial features, so prioritize composition, lighting and mood over facial detail.",
      wardrobeLine,
      character.usageHint ? `Pose/context: ${character.usageHint}` : "",
    ].filter(Boolean).join("\n");
  }

  const continuityBlock = continuity
    ? [
        "",
        "Continuity with surrounding slides:",
        continuity.connectsToPrevious && `Previous slide link: ${continuity.connectsToPrevious}.`,
        continuity.connectsToNext && `Next slide link: ${continuity.connectsToNext}.`,
        continuity.narrativeLink && `Narrative role: ${continuity.narrativeLink}.`,
      ].filter(Boolean).join("\n")
    : "";

  const beatBlock = narrativeBeat
    ? `Narrative beat: ${narrativeBeat}. Compose so the viewer intuitively feels this beat without text.`
    : "";

  return [
    base,
    marginBlock,
    sceneBible,
    "",
    "Scene: " + concept,
    composition && "Composition: " + composition,
    beatBlock,
    extra,
    characterInjection,
    continuityBlock,
    textInImage.block,
    "",
    "Negative: " + negative,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Construye el prompt para Fase B (character swap con Gemini + refs).
 *
 * Se le pasa al modelo: imagen base de Fase A + 2-4 refs del personaje real +
 * este prompt. El objetivo es que preserve la composición, iluminación, pose
 * y mood de la imagen base, cambiando solo la identidad facial/corporal por
 * la del personaje de las refs.
 */
export function buildSwapPrompt(config, {
  characterName = "the referenced person",
  usageHint = "",
  preserveText = false,
  authorizedTexts = [],
} = {}) {
  const textRule = preserveText
    ? [
        ``,
        `TEXT PRESERVATION — CRITICAL:`,
        `Image 1 contains rendered editorial typography (headline / eyebrow / data chip).`,
        `Preserve every piece of text EXACTLY as it appears in image 1 — character by`,
        `character, same position, same color, same size, same typography, same tracking.`,
        `Do not re-render the text, do not change kerning, do not move it, do not translate`,
        `or paraphrase, do not delete it, do not introduce new text anywhere.`,
        authorizedTexts.length
          ? `Authorized text content (must remain intact):\n${authorizedTexts.map((t) => `  • "${t}"`).join("\n")}`
          : "",
        ``,
      ].filter(Boolean).join("\n")
    : `\nDo NOT add or render any text, letters, numerals, logos, captions or typography anywhere in the image. Any textual surface must stay blank.\n`;

  return [
    `Task: identity-preserving character swap.`,
    ``,
    `Image 1 is the base composition. Images 2+ show the exact person you must render.`,
    ``,
    `Regenerate image 1 replacing the person in the scene with ${characterName}, whose face, hair, complexion, build and personal style are shown across the reference images (2+).`,
    ``,
    `ABSOLUTE RULES — preserve from image 1 with zero drift:`,
    `  - Composition, framing, crop and aspect ratio`,
    `  - Pose, body language, gesture and hand position`,
    `  - Lighting direction, intensity, color temperature and rim light`,
    `  - Wardrobe silhouette, color palette and texture`,
    `  - Background, props, depth of field and environment`,
    `  - Color grade, contrast, film grain and mood`,
    `  - All rendered text, typography and graphic elements exactly as shown`,
    ``,
    `ABSOLUTE RULES — replace from image 1 using refs:`,
    `  - Facial features, head shape and skin tone`,
    `  - Hair color, length and style`,
    `  - Age, ethnicity and build`,
    `  - The person must match the references at ~100% — no drift in race, age or gender`,
    textRule,
    usageHint ? `Additional context for the pose: ${usageHint}` : "",
    ``,
    `Output: a single photograph, same dimensions and aspect as image 1, premium editorial quality, believable identity consistency with the refs.`,
  ].filter(Boolean).join("\n");
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
