#!/usr/bin/env node
// clone-from-url.mjs — Scraper con Apify + recreación con tu branding.
//
// Workflow:
//   1. Recibe una URL de Instagram, TikTok o LinkedIn.
//   2. Detecta plataforma y selecciona el Apify Actor correcto.
//   3. Llama al run-sync-get-dataset-items endpoint (bloqueante hasta que
//      el scrape termina, o timeout a los 3 min).
//   4. Descarga las imágenes de slides + caption + metadata a:
//        output/clones/YYYYMMDD-<slug>/source/
//   5. Escribe un scrape-manifest.json con todos los datos estructurados.
//   6. (Opcional) Invoca al agente content-forge-clone-analyzer desde Claude
//      Code para que convierta las imágenes en un brief JSON con tu character
//      y tu branding.
//
// Output:
//   output/clones/YYYYMMDD-<slug>/
//     source/
//       slide-01.jpg, slide-02.jpg, ...
//       caption.txt
//       metadata.json
//     scrape-manifest.json
//
// Uso:
//   node scripts/clone-from-url.mjs --url=https://www.instagram.com/p/XYZ/
//   node scripts/clone-from-url.mjs --url=https://www.tiktok.com/@user/video/123
//   node scripts/clone-from-url.mjs --url=https://www.linkedin.com/posts/handle_...

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadEnv({ path: join(ROOT, ".env.local") });

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) {
  console.error("Falta APIFY_API_TOKEN en .env.local.");
  console.error("Obtén tu token en https://console.apify.com/account/integrations");
  console.error("Luego añádelo a tu .env.local (o corre `npm run setup` de nuevo).");
  process.exit(1);
}

const APIFY_BASE = "https://api.apify.com/v2";
const RUN_TIMEOUT_MS = 180_000; // 3 min

// ─── Detección de plataforma ───────────────────────────────────────────
const PLATFORM_ACTORS = {
  instagram: {
    match: /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+/i,
    actor: "apify~instagram-scraper",
    input: (url) => ({
      directUrls: [url],
      resultsType: "posts",
      resultsLimit: 1,
      addParentData: false,
    }),
  },
  tiktok: {
    match: /^https?:\/\/(www\.)?(vm\.)?tiktok\.com\/.+/i,
    actor: "clockworks~tiktok-scraper",
    input: (url) => ({
      postURLs: [url],
      resultsPerPage: 1,
      shouldDownloadVideos: false,
      shouldDownloadCovers: true,
    }),
  },
  linkedin: {
    match: /^https?:\/\/(www\.)?linkedin\.com\/(posts|feed\/update)\/.+/i,
    // Hay varios scrapers populares de LinkedIn; elegimos uno estable.
    actor: "curious_coder~linkedin-post-scraper",
    input: (url) => ({
      urls: [url],
    }),
  },
};

function detectPlatform(url) {
  for (const [name, cfg] of Object.entries(PLATFORM_ACTORS)) {
    if (cfg.match.test(url)) return { name, ...cfg };
  }
  return null;
}

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

function yyyymmdd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ─── Apify call ────────────────────────────────────────────────────────
async function runApifyActor({ actor, input, timeoutMs = RUN_TIMEOUT_MS }) {
  const url = `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_TOKEN)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return await res.json();
}

// ─── Descarga de assets ────────────────────────────────────────────────
async function downloadTo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download HTTP ${res.status} on ${url}`);
  const ab = await res.arrayBuffer();
  await writeFile(destPath, Buffer.from(ab));
}

// ─── Normalizadores por plataforma ─────────────────────────────────────
/**
 * Los Apify actors devuelven shapes distintos. Normalizamos a:
 *   {
 *     platform, url, author, caption, hashtags[],
 *     slides: [{ order, imageUrl, altText? }],
 *     stats: { likes?, comments?, views? },
 *     postedAt, raw
 *   }
 */
function normalizeInstagram(raw) {
  const post = Array.isArray(raw) ? raw[0] : raw;
  if (!post) return null;
  const slides = [];
  if (Array.isArray(post.childPosts) && post.childPosts.length > 0) {
    post.childPosts.forEach((c, i) => {
      if (c.displayUrl) slides.push({ order: i + 1, imageUrl: c.displayUrl, altText: c.alt || null });
    });
  } else if (post.displayUrl) {
    slides.push({ order: 1, imageUrl: post.displayUrl, altText: post.alt || null });
  } else if (post.images && Array.isArray(post.images)) {
    post.images.forEach((u, i) => slides.push({ order: i + 1, imageUrl: u, altText: null }));
  }
  return {
    platform: "instagram",
    url: post.url,
    author: post.ownerUsername ? "@" + post.ownerUsername : null,
    caption: post.caption || "",
    hashtags: post.hashtags || [],
    slides,
    stats: {
      likes: post.likesCount ?? null,
      comments: post.commentsCount ?? null,
      views: post.videoViewCount ?? null,
    },
    postedAt: post.timestamp || null,
    raw: post,
  };
}

function normalizeTikTok(raw) {
  const post = Array.isArray(raw) ? raw[0] : raw;
  if (!post) return null;
  const slides = [];
  const cover = post.covers?.default || post.covers?.origin || post.videoMeta?.coverUrl;
  if (cover) slides.push({ order: 1, imageUrl: cover, altText: null });
  // TikTok carrusel / slideshow:
  if (Array.isArray(post.imageUrls)) {
    post.imageUrls.forEach((u, i) => slides.push({ order: slides.length + 1, imageUrl: u, altText: null }));
  }
  return {
    platform: "tiktok",
    url: post.webVideoUrl || post.url,
    author: post.authorMeta?.name ? "@" + post.authorMeta.name : null,
    caption: post.text || post.desc || "",
    hashtags: (post.hashtags || []).map((h) => h.name ? `#${h.name}` : h).filter(Boolean),
    slides,
    stats: {
      likes: post.diggCount ?? null,
      comments: post.commentCount ?? null,
      views: post.playCount ?? null,
      shares: post.shareCount ?? null,
    },
    postedAt: post.createTimeISO || null,
    raw: post,
  };
}

function normalizeLinkedIn(raw) {
  const post = Array.isArray(raw) ? raw[0] : raw;
  if (!post) return null;
  const slides = [];
  if (Array.isArray(post.images)) {
    post.images.forEach((u, i) => slides.push({ order: i + 1, imageUrl: u, altText: null }));
  } else if (post.imageUrl) {
    slides.push({ order: 1, imageUrl: post.imageUrl, altText: null });
  }
  return {
    platform: "linkedin",
    url: post.url || post.postUrl,
    author: post.authorName || post.actorName || null,
    caption: post.text || post.content || "",
    hashtags: (post.hashtags || []).filter(Boolean),
    slides,
    stats: {
      likes: post.reactions ?? post.likesCount ?? null,
      comments: post.commentsCount ?? null,
    },
    postedAt: post.postedAt || post.date || null,
    raw: post,
  };
}

const NORMALIZERS = {
  instagram: normalizeInstagram,
  tiktok: normalizeTikTok,
  linkedin: normalizeLinkedIn,
};

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (!args.url) {
    console.error("Uso: --url=<instagram|tiktok|linkedin URL>");
    console.error("Ejemplo: node scripts/clone-from-url.mjs --url=https://www.instagram.com/p/ABC123/");
    process.exit(1);
  }

  const platform = detectPlatform(args.url);
  if (!platform) {
    console.error("URL no reconocida. Soportadas: instagram.com/p/* · tiktok.com/* · linkedin.com/posts/*");
    process.exit(1);
  }

  console.log(`[${platform.name}] ejecutando actor ${platform.actor}...`);
  const started = Date.now();
  let raw;
  try {
    raw = await runApifyActor({
      actor: platform.actor,
      input: platform.input(args.url),
    });
  } catch (err) {
    console.error(`Apify falló: ${err?.message ?? err}`);
    process.exit(1);
  }
  const apifyMs = Date.now() - started;
  console.log(`  Apify devolvió ${Array.isArray(raw) ? raw.length : "1"} item(s) en ${(apifyMs / 1000).toFixed(1)}s`);

  const normalized = NORMALIZERS[platform.name](raw);
  if (!normalized) {
    console.error("No se pudo normalizar el resultado del scraper. Revisa raw en el manifest.");
    process.exit(1);
  }

  if (normalized.slides.length === 0) {
    console.warn("⚠ El post no tiene imágenes descargables (puede ser un video sin covers). Guardamos solo caption + metadata.");
  }

  const sourceAuthor = normalized.author ? slugify(normalized.author.replace(/^@/, "")) : "sin-autor";
  const cloneDir = join(ROOT, "output", "clones", `${yyyymmdd()}-${platform.name}-${sourceAuthor}`);
  const sourceDir = join(cloneDir, "source");
  await mkdir(sourceDir, { recursive: true });

  // Descargar todas las imágenes de slides.
  console.log(`Descargando ${normalized.slides.length} slide(s) a ${sourceDir}`);
  for (const s of normalized.slides) {
    const filename = `slide-${String(s.order).padStart(2, "0")}.jpg`;
    try {
      await downloadTo(s.imageUrl, join(sourceDir, filename));
      s.localPath = join("source", filename);
      console.log(`  ✓ ${filename}`);
    } catch (err) {
      console.warn(`  ✗ ${filename}: ${err?.message ?? err}`);
      s.localPath = null;
      s.downloadError = err?.message ?? String(err);
    }
  }

  // Caption + metadata a archivos.
  if (normalized.caption) {
    await writeFile(join(sourceDir, "caption.txt"), normalized.caption, "utf8");
  }
  await writeFile(join(sourceDir, "metadata.json"), JSON.stringify({
    platform: normalized.platform,
    url: normalized.url,
    author: normalized.author,
    hashtags: normalized.hashtags,
    stats: normalized.stats,
    postedAt: normalized.postedAt,
  }, null, 2));

  // Manifest principal.
  const manifestPath = join(cloneDir, "scrape-manifest.json");
  await writeFile(manifestPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    generator: "clone-from-url",
    platform: normalized.platform,
    source_url: normalized.url,
    author: normalized.author,
    caption: normalized.caption,
    hashtags: normalized.hashtags,
    stats: normalized.stats,
    postedAt: normalized.postedAt,
    apify: {
      actor: platform.actor,
      elapsedMs: apifyMs,
    },
    slides: normalized.slides,
    nextStep: "Invoca el agente content-forge-clone-analyzer sobre este directorio para convertirlo en un brief con tu branding.",
  }, null, 2));

  console.log(`\n✓ Clone source listo en ${cloneDir}`);
  console.log(`  Manifest: ${manifestPath}`);
  console.log(`  Caption: ${normalized.caption.length} chars`);
  console.log(`  Hashtags: ${normalized.hashtags.length}`);
  console.log(`  Slides descargados: ${normalized.slides.filter((s) => s.localPath).length}/${normalized.slides.length}`);
  console.log("");
  console.log("Siguiente paso: invoca el agente `content-forge-clone-analyzer`");
  console.log("desde Claude Code sobre este directorio para generar el brief con tu branding.");
}

main().catch((err) => {
  console.error("Fatal:", err?.message ?? err);
  process.exit(1);
});
