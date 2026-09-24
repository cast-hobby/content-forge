#!/usr/bin/env node
// setup.mjs — Wizard de primera configuración de Content Forge.
//
// Hace ~10 preguntas interactivas al usuario y genera:
//   - brand.config.json     (la fuente de verdad de la marca)
//   - .env.local            (con OPENAI_API_KEY y GEMINI_API_KEY)
//   - brand-assets/         (preparada para logos y fotos del personaje)
//
// Si el usuario activa character consistency, al final invoca analyze-character.mjs
// que usa Gemini Vision para generar brand-assets/character/character.md.

import { writeFile, mkdir, access, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import prompts from "prompts";
import pc from "picocolors";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONFIG_PATH = join(ROOT, "brand.config.json");
const ENV_PATH = join(ROOT, ".env.local");
const CHARACTER_DIR = join(ROOT, "brand-assets", "character");

// ─── Header ────────────────────────────────────────────────────────────
function printHeader() {
  console.log("");
  console.log(pc.bold(pc.yellow("  ⚡ CONTENT FORGE")));
  console.log(pc.dim("  by UGC Colombia × Kreoon · hecho por Alexander Cast"));
  console.log("");
  console.log(pc.dim("  Un estudio editorial en tu terminal."));
  console.log(pc.dim("  Vamos a configurar tu marca en ~3 minutos."));
  console.log("");
  console.log(pc.dim("  ─────────────────────────────────────────────────────────────"));
  console.log("");
}

function printSection(n, total, title) {
  console.log("");
  console.log(pc.bold(pc.cyan(`  ${n}/${total} · ${title}`)));
  console.log("");
}

function printSuccess(msg) {
  console.log(pc.green(`  ✓ ${msg}`));
}

function printInfo(msg) {
  console.log(pc.dim(`  ${msg}`));
}

function printWarn(msg) {
  console.log(pc.yellow(`  ⚠ ${msg}`));
}

// ─── Validaciones ──────────────────────────────────────────────────────
function isValidHex(s) {
  return /^#[0-9a-fA-F]{6}$/.test(s.trim());
}

function normalizeHex(s) {
  return s.trim().toUpperCase();
}

function isValidHandle(s) {
  return /^@?[a-zA-Z0-9._]{1,30}$/.test(s.trim());
}

function normalizeHandle(s) {
  const cleaned = s.trim().replace(/^@/, "");
  return `@${cleaned}`;
}

function isValidGeminiKey(s) {
  return /^AIzaSy[A-Za-z0-9_-]{33}$/.test(s.trim());
}

function isValidOpenAIKey(s) {
  const cleaned = s.trim();
  // Soporta tanto sk-... clásicas como sk-proj-... (project-scoped) y sk-svcacct-... (service account).
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(cleaned);
}

function contrastRatio(hex1, hex2) {
  // WCAG relative luminance.
  const lum = (hex) => {
    const rgb = hex.match(/#(..)(..)(..)/).slice(1).map((c) => parseInt(c, 16) / 255);
    const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = lum(hex1);
  const l2 = lum(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ─── Cadence defaults por idioma ───────────────────────────────────────
const DEFAULT_CADENCE = {
  "ig-carousel": { preferredDays: ["Tue", "Thu", "Sat"], preferredHour: "19:00" },
  "reel": { preferredDays: ["Mon", "Wed", "Fri"], preferredHour: "20:00" },
  "story": { preferredDays: ["daily"], preferredHour: "09:00" },
  "linkedin": { preferredDays: ["Tue", "Thu"], preferredHour: "08:00" },
};

// ─── Voice templates ───────────────────────────────────────────────────
const VOICE_TEMPLATES = {
  "friendly-expert": {
    styleDescription: "Amiga que sabe. Directa pero cálida. Nunca moraliza, nunca usa 'tienes que'.",
    forbiddenPhrases: ["hola familia", "mi gente linda", "te va a cambiar la vida", "dale like si", "no te lo pierdas"],
    preferredPhrases: ["La verdad es que...", "Esto funciona porque...", "Nadie te dice que...", "Después de ver..."],
  },
  "authority": {
    styleDescription: "Autoridad sin arrogancia. Opinión fuerte respaldada con datos.",
    forbiddenPhrases: ["hola familia", "crack", "te va a encantar", "hazme caso"],
    preferredPhrases: ["Después de X años en esto...", "El problema real es...", "La industria no va a decírtelo..."],
  },
  "provocateur": {
    styleDescription: "Reframe directo. Provoca pensamiento. Corto, punzante, sin relleno.",
    forbiddenPhrases: ["hola familia", "te va a gustar", "es obvio que", "todos sabemos"],
    preferredPhrases: ["Esto va a molestar a alguien:", "La verdad incómoda:", "Nadie quiere escucharlo, pero..."],
  },
  "educator-calm": {
    styleDescription: "Educador calmado. Claridad por encima de todo. Estructura paso a paso.",
    forbiddenPhrases: ["hola familia", "increíble", "brutal", "insane"],
    preferredPhrases: ["Vamos por partes.", "Primero lo primero:", "Para entender esto..."],
  },
};

// ─── Main wizard ───────────────────────────────────────────────────────
async function main() {
  printHeader();

  // Detectar si ya existe config.
  if (existsSync(CONFIG_PATH)) {
    const confirm = await prompts({
      type: "confirm",
      name: "overwrite",
      message: "Ya existe un brand.config.json. ¿Quieres sobrescribirlo?",
      initial: false,
    });
    if (!confirm.overwrite) {
      console.log(pc.dim("\n  Cancelado. Tu configuración actual queda intacta.\n"));
      process.exit(0);
    }
  }

  // 1. Nombre de marca
  printSection(1, 10, "¿Cuál es el nombre de tu marca o marca personal?");
  const q1 = await prompts({
    type: "text",
    name: "name",
    message: "Nombre:",
    validate: (v) => v.trim().length > 0 || "No puede estar vacío",
  });

  // 2. Tagline
  printSection(2, 10, "Una frase que resuma qué haces (tagline)");
  printInfo("Ejemplo: 'Acompaño a fundadores D2C a crear UGC que convierte'");
  const q2 = await prompts({
    type: "text",
    name: "tagline",
    message: "Tagline:",
    validate: (v) => v.trim().length > 5 || "Mínimo 5 caracteres",
  });

  // 3. Tipo de marca
  printSection(3, 10, "¿Qué tipo de marca es?");
  const q3 = await prompts({
    type: "select",
    name: "type",
    message: "Tipo:",
    choices: [
      { title: "Marca personal (tú eres el rostro)", value: "personal" },
      { title: "Agencia / servicio (equipo)", value: "agency" },
      { title: "Producto / ecommerce", value: "product" },
      { title: "SaaS / software", value: "saas" },
      { title: "Otro", value: "other" },
    ],
  });

  // 4. Industria
  printSection(4, 10, "Industria o nicho");
  const q4 = await prompts({
    type: "select",
    name: "industry",
    message: "Industria:",
    choices: [
      { title: "Coaching / Educación", value: "coaching" },
      { title: "Ecommerce / Retail", value: "ecommerce" },
      { title: "SaaS / Tech", value: "saas" },
      { title: "Salud / Fitness", value: "health" },
      { title: "Lifestyle / Creador", value: "lifestyle" },
      { title: "Finanzas / Inversión", value: "finance" },
      { title: "Marketing / Agencia", value: "marketing" },
      { title: "Otro", value: "other" },
    ],
  });

  // 5. Handle
  printSection(5, 10, "Tu handle oficial de Instagram");
  printInfo("Este es el ÚNICO @ que aparecerá en tu contenido público");
  const q5 = await prompts({
    type: "text",
    name: "handle",
    message: "Handle (con o sin @):",
    validate: (v) => isValidHandle(v) || "Formato inválido (solo letras, números, _ o .)",
    format: (v) => normalizeHandle(v),
  });

  // 6. Colores
  printSection(6, 10, "Colores de marca");
  printInfo("Tres hex codes. Si no tienes una paleta definida, elige: primario vibrante, oscuro, claro.");
  const q6a = await prompts({
    type: "text",
    name: "primary",
    message: "Color primario (ej. #F9B334):",
    validate: (v) => isValidHex(v) || "Formato hex inválido (debe ser #XXXXXX)",
    format: (v) => normalizeHex(v),
  });
  const q6b = await prompts({
    type: "text",
    name: "dark",
    message: "Color oscuro (ej. #000000):",
    validate: (v) => isValidHex(v) || "Formato hex inválido",
    format: (v) => normalizeHex(v),
  });
  const q6c = await prompts({
    type: "text",
    name: "light",
    message: "Color claro (ej. #F5F5F0):",
    validate: (v) => isValidHex(v) || "Formato hex inválido",
    format: (v) => normalizeHex(v),
  });

  // Validar contraste
  const contrastDarkLight = contrastRatio(q6b.dark, q6c.light);
  if (contrastDarkLight < 7) {
    printWarn(`Contraste oscuro/claro = ${contrastDarkLight.toFixed(1)}:1 (ideal >7:1 para titulares). Si se ve poco legible, considera ajustar.`);
  } else {
    printSuccess(`Contraste oscuro/claro = ${contrastDarkLight.toFixed(1)}:1 ✓ WCAG AAA`);
  }

  // 7. Logo
  printSection(7, 10, "Logo");
  printInfo("Necesitas 2 variantes del logo en PNG con fondo transparente:");
  printInfo("  - darkVariant: logo que se ve bien sobre FONDOS OSCUROS o fotos");
  printInfo("  - lightVariant: logo que se ve bien sobre FONDOS CLAROS (crema/blanco)");
  printInfo("  Copia tus PNGs a la carpeta brand-assets/ con esos nombres exactos.");
  const q7 = await prompts([
    {
      type: "text",
      name: "darkVariant",
      message: "Path del logo para fondos oscuros (default brand-assets/logo-dark.png):",
      initial: "brand-assets/logo-dark.png",
    },
    {
      type: "text",
      name: "lightVariant",
      message: "Path del logo para fondos claros (default brand-assets/logo-light.png):",
      initial: "brand-assets/logo-light.png",
    },
  ]);

  // 8. Voz
  printSection(8, 10, "Voz de marca");
  printInfo("Esto define cómo Claude redacta los headlines y captions.");
  const q8 = await prompts({
    type: "select",
    name: "voice",
    message: "Estilo de voz:",
    choices: [
      { title: "Amiga que sabe (cálido, directo, sin moralizar)", value: "friendly-expert" },
      { title: "Autoridad (profesional, respaldado en datos)", value: "authority" },
      { title: "Provocador (reframe, punzante)", value: "provocateur" },
      { title: "Educador calmado (claridad, paso a paso)", value: "educator-calm" },
    ],
  });

  // 9. Character consistency
  printSection(9, 10, "Consistencia de personaje (marca personal)");
  printInfo("Si eres marca personal o tienes un personaje fijo, el sistema puede mantener tu rostro consistente");
  printInfo("en todas las imágenes generadas usando fotos tuyas como referencia.");
  const q9 = await prompts({
    type: "select",
    name: "characterMode",
    message: "¿Quieres consistencia de personaje?",
    choices: [
      { title: "No, cada imagen es independiente", value: "off" },
      { title: "Sí, soy marca personal y quiero aparecer yo", value: "personal" },
      { title: "Sí, tengo un personaje/mascota de marca recurrente", value: "mascot" },
    ],
  });

  let characterConfig = { enabled: false, mode: "off" };
  if (q9.characterMode !== "off") {
    const q9b = await prompts({
      type: "text",
      name: "name",
      message: `¿Nombre del personaje? (ej. "${q1.name.split(" ")[0]}"):`,
      initial: q1.name.split(" ")[0],
    });
    characterConfig = {
      enabled: true,
      mode: q9.characterMode,
      name: q9b.name,
      referenceImages: [],
      descriptionFile: "brand-assets/character/character.md",
      useInSlides: "auto",
      maxRefsPerCall: 4,
    };
    printSuccess(`Character mode activado: "${q9b.name}"`);
    printInfo(`Te pediré las fotos en un momento.`);
  }

  // 10. API keys (WaveSpeed + OpenAI + Gemini)
  printSection(10, 10, "API keys — WaveSpeed (premium) + OpenAI (fallback) + Gemini (character swap)");
  printInfo("Content Forge usa generación de imágenes en 2 proveedores:");
  printInfo("  · WaveSpeed flux-dev (RECOMENDADO) — calidad premium, rápido.");
  printInfo("  · OpenAI gpt-image-2 — fallback si no tienes WaveSpeed.");
  printInfo("  · Gemini 2.5 Flash Image — swap de personaje con tus refs.");
  printInfo("");
  printInfo("WaveSpeed (recomendado): obtén tu key en https://wavespeed.ai");
  printInfo("  Pulsa Enter para omitir si usarás OpenAI como proveedor.");
  const q10ws = await prompts({
    type: "password",
    name: "apiKey",
    message: "Pega tu WAVESPEED_API_KEY (o Enter para omitir):",
  });

  printInfo("");
  printInfo("OpenAI (fallback): obtén tu key en https://platform.openai.com/api-keys");
  printInfo("  IMPORTANTE: verifica tu organización en platform.openai.com/settings/organization/general");
  printInfo("  (requisito obligatorio de OpenAI para usar gpt-image-2). Pulsa Enter para omitir si usas WaveSpeed.");
  const q10a = await prompts({
    type: "password",
    name: "apiKey",
    message: "Pega tu OPENAI_API_KEY (o Enter para omitir):",
  });

  printInfo("");
  printInfo("Gemini: obtén tu key gratis en https://aistudio.google.com/apikey");
  printInfo("  Empieza con 'AIzaSy...' y tiene 39 caracteres en total.");
  const q10b = await prompts({
    type: "password",
    name: "apiKey",
    message: "Pega tu GEMINI_API_KEY:",
    validate: (v) => isValidGeminiKey(v) || "Formato inválido (debe ser AIzaSy... de 39 chars)",
  });

  printInfo("");
  printInfo("Apify (opcional): solo necesario si quieres usar `clone-from-url`");
  printInfo("  para recrear carruseles virales con tu imagen.");
  printInfo("  Obtén tu token en https://console.apify.com/account/integrations");
  printInfo("  Empieza con 'apify_api_...'. Pulsa Enter para omitir.");
  const q10c = await prompts({
    type: "password",
    name: "apiKey",
    message: "Pega tu APIFY_API_TOKEN (o Enter para omitir):",
  });

  // Detectar país + timezone
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Bogota";

  // ─── Construir brand.config.json ────────────────────────────────────
  console.log("");
  console.log(pc.dim("  ─────────────────────────────────────────────────────────────"));
  console.log("");
  console.log(pc.bold("  Configurando Content Forge para " + pc.yellow(q1.name) + "..."));
  console.log("");

  const config = {
    $schema: "./brand.config.schema.json",
    brand: {
      name: q1.name,
      tagline: q2.tagline,
      type: q3.type,
      industry: q4.industry,
      handle: q5.handle,
      country: "Colombia",
      timezone: localTimezone,
      primaryLanguage: "es",
    },
    colors: {
      primary: q6a.primary,
      dark: q6b.dark,
      light: q6c.light,
      grayDark: "#3D3D3C",
      grayLight: "#BDBCBC",
      white: "#FFFFFF",
    },
    fonts: {
      display: "Anton",
      sans: "Inter",
    },
    logo: {
      darkVariant: q7.darkVariant,
      lightVariant: q7.lightVariant,
      clearspaceRatio: 0.022,
    },
    voice: {
      style: q8.voice,
      ...VOICE_TEMPLATES[q8.voice],
    },
    character: characterConfig,
    content: {
      defaultPlatform: "ig-carousel",
      defaultSlideCount: 10,
      pillarMix: {
        educativo: 0.35,
        bts: 0.20,
        casos: 0.15,
        debate: 0.15,
        estrategico: 0.15,
      },
      cadence: DEFAULT_CADENCE,
    },
    output: {
      baseDir: "output/social",
      keepRawBackup: true,
      showFooter: false,
      footerText: "made with content-forge",
      calendarDir: "output/calendar",
    },
    hashtags: {
      niche: [],
      mid: [],
      broad: [],
      _comment: "Edita brand.config.json para añadir tus hashtags. Mínimo 5 nicho + 10 medio + 5 amplio = 20 total.",
    },
    leadMagnet: {
      name: "",
      url: "",
      bioLinkLabel: "Link en bio",
    },
    meta: {
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      setupCompletedAt: new Date().toISOString(),
    },
  };

  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
  printSuccess(`brand.config.json escrito en ${CONFIG_PATH}`);

  const envLines = [];
  if (q10ws?.apiKey) envLines.push(`WAVESPEED_API_KEY=${q10ws.apiKey.trim()}`);
  if (q10a?.apiKey)  envLines.push(`OPENAI_API_KEY=${q10a.apiKey.trim()}`);
  envLines.push(`GEMINI_API_KEY=${q10b.apiKey}`);
  if (q10c?.apiKey)  envLines.push(`APIFY_API_TOKEN=${q10c.apiKey.trim()}`);
  envLines.push("");
  await writeFile(ENV_PATH, envLines.join("\n"), "utf8");
  const providers = [q10ws?.apiKey && "WaveSpeed", q10a?.apiKey && "OpenAI", "Gemini", q10c?.apiKey && "Apify"].filter(Boolean);
  printSuccess(`.env.local escrito con: ${providers.join(" + ")}`);

  // Crear directorios
  await mkdir(join(ROOT, "brand-assets"), { recursive: true });
  await mkdir(CHARACTER_DIR, { recursive: true });
  await mkdir(join(ROOT, "output", "social"), { recursive: true });
  await mkdir(join(ROOT, "output", "calendar"), { recursive: true });
  await mkdir(join(ROOT, "drafts"), { recursive: true });
  printSuccess(`Directorios de trabajo preparados (output/, drafts/)`);

  // Validar logos (warn si faltan)
  const darkLogoPath = join(ROOT, q7.darkVariant);
  const lightLogoPath = join(ROOT, q7.lightVariant);
  if (!existsSync(darkLogoPath)) {
    printWarn(`Logo no encontrado: ${q7.darkVariant} — colócalo ahí antes de generar contenido.`);
  }
  if (!existsSync(lightLogoPath)) {
    printWarn(`Logo no encontrado: ${q7.lightVariant} — colócalo ahí antes de generar contenido.`);
  }

  // Character analysis
  if (characterConfig.enabled) {
    console.log("");
    console.log(pc.bold(pc.cyan("  🧬 Configurando character consistency")));
    console.log("");
    printInfo(`Coloca 3-10 fotos tuyas en: ${CHARACTER_DIR}`);
    printInfo(`Ver ${join("brand-assets", "character", "README.md")} para la guía de qué subir.`);
    console.log("");
    const confirmAnalyze = await prompts({
      type: "confirm",
      name: "ready",
      message: "¿Ya copiaste las fotos? (s para analizarlas ahora, n para hacerlo después con 'npm run analyze-character')",
      initial: false,
    });
    if (confirmAnalyze.ready) {
      console.log("");
      printInfo("Analizando fotos con Gemini Vision...");
      await runNode("scripts/analyze-character.mjs");
    } else {
      printInfo("Cuando tengas las fotos, corre: npm run analyze-character");
    }
  }

  // ─── Despedida ───────────────────────────────────────────────────────
  console.log("");
  console.log(pc.dim("  ─────────────────────────────────────────────────────────────"));
  console.log("");
  console.log(pc.bold(pc.green("  🚀 Listo. Content Forge está configurado.")));
  console.log("");
  console.log(pc.bold("  Próximos pasos:"));
  console.log("");
  console.log(`    1. Abre Claude Code apuntando a esta carpeta`);
  console.log(`    2. En el chat, escribe tu primer pedido. Ejemplos:`);
  console.log("");
  console.log(pc.dim(`       "hazme un carrusel educativo sobre [tu tema]"`));
  console.log(pc.dim(`       "un reel para TikTok con este hook: [hook]"`));
  console.log(pc.dim(`       "un post de LinkedIn sobre [tu tema]"`));
  console.log("");
  console.log(`    3. Di "sí" cuando Claude te pregunte si genera`);
  console.log(`    4. Espera ~5 min → recibe todo listo para publicar`);
  console.log("");
  console.log(pc.dim("  Documentación: ./docs/getting-started.md"));
  console.log(pc.dim("  Ajustar config: edita brand.config.json directamente"));
  console.log("");
  console.log(pc.yellow("  Content Forge es un regalo de Alexander Cast · UGC Colombia × Kreoon."));
  console.log(pc.dim("  Si te sirve, compártelo con otros creadores ✨"));
  console.log("");
}

function runNode(script) {
  return new Promise((ok, ko) => {
    const child = spawn(process.execPath, [join(ROOT, script)], {
      stdio: "inherit",
      cwd: ROOT,
    });
    child.on("exit", (code) => (code === 0 ? ok() : ko(new Error(`${script} exited ${code}`))));
  });
}

main().catch((err) => {
  console.error(pc.red("\n  Error:"), err?.message ?? err);
  process.exit(1);
});
