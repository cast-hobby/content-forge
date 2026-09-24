#!/usr/bin/env node
// Overlay Editor PRO — servidor local sin dependencias.
// Sirve UI + fuentes reales (Anton, Inter) + endpoints REST para persistir y componer.

import { createServer } from "node:http";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [[m[1], m[2]]] : a.startsWith("--") ? [[a.slice(2), true]] : [];
  })
);
const PORT = parseInt(args.port || "4321", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
};

function mime(path) { return MIME[extname(path).toLowerCase()] || "application/octet-stream"; }

async function listCarousels() {
  const base = resolve(ROOT, "output/social");
  if (!existsSync(base)) return [];
  const entries = await readdir(base);
  const out = [];
  for (const e of entries) {
    const p = join(base, e);
    const s = await stat(p);
    if (s.isDirectory()) {
      const hasManifest = existsSync(join(p, "manifest.json"));
      const hasOverlay = existsSync(join(p, "overlay-copy.json"));
      out.push({ slug: e, path: p, hasManifest, hasOverlay });
    }
  }
  return out;
}

async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }

async function serveFile(res, filePath) {
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const data = await readFile(filePath);
  res.writeHead(200, { "Content-Type": mime(filePath), "Cache-Control": "no-cache" });
  res.end(data);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" });
  res.end(JSON.stringify(body, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const buf = Buffer.concat(chunks);
  if (!buf.length) return null;
  try { return JSON.parse(buf.toString("utf8")); } catch { return null; }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    // ─── API ───────────────────────────────────────────────────────
    if (url.pathname === "/api/carousels") return sendJson(res, 200, await listCarousels());

    if (url.pathname === "/api/brand-config") {
      const p = resolve(ROOT, "brand.config.json");
      if (!existsSync(p)) return sendJson(res, 404, { error: "brand.config.json not found" });
      return sendJson(res, 200, await readJson(p));
    }

    if (url.pathname === "/api/load") {
      const slug = url.searchParams.get("slug");
      if (!slug) return sendJson(res, 400, { error: "missing slug" });
      const dir = resolve(ROOT, "output/social", slug);
      const manifestPath = join(dir, "manifest.json");
      if (!existsSync(manifestPath)) return sendJson(res, 404, { error: "manifest.json not found" });
      const manifest = await readJson(manifestPath);
      const overlayPath = join(dir, "overlay-copy.json");
      const layoutPath = join(dir, "layout-plan.json");
      const overlayCopy = existsSync(overlayPath) ? await readJson(overlayPath) : { slides: {} };
      const layoutPlan = existsSync(layoutPath) ? await readJson(layoutPath) : { slides: {} };
      return sendJson(res, 200, { slug, dir, manifest, overlayCopy, layoutPlan });
    }

    // ─── Default params de cada fondo CSS ──────────────────────────
    if (url.pathname === "/api/bg-defaults") {
      const { DEFAULT_PARAMS } = await import("../../scripts/css-backgrounds.mjs");
      return sendJson(res, 200, DEFAULT_PARAMS);
    }

    // ─── Compose SVG overlay en vivo (WYSIWYG) ────────────────────
    // GET: lee overlay-copy.json del disco (carga inicial)
    // POST: usa overlay enviado en el body (edición en tiempo real, sin escritura a disco)
    if (url.pathname === "/api/compose-svg") {
      const isPost = req.method === "POST";
      let slug, id, postedOverlay;

      if (isPost) {
        const body = await readBody(req);
        slug = body?.slug; id = body?.id; postedOverlay = body?.overlay;
      } else {
        slug = url.searchParams.get("slug");
        id   = url.searchParams.get("id");
      }
      if (!slug || !id) return sendJson(res, 400, { error: "slug e id requeridos" });

      const dir          = resolve(ROOT, "output/social", slug);
      const layoutPath   = join(dir, "layout-plan.json");
      const configPath   = resolve(ROOT, "brand.config.json");
      const manifestPath = join(dir, "manifest.json");

      const layoutPlan  = existsSync(layoutPath)  ? await readJson(layoutPath)  : { slides: {} };
      const config      = existsSync(configPath)  ? await readJson(configPath)  : {};
      const manifest    = existsSync(manifestPath)? await readJson(manifestPath): {};
      const rawLayout   = layoutPlan.slides?.[id];
      const width       = manifest.target?.width  || 1080;
      const height      = manifest.target?.height || 1350;

      const { normalizeOverlay, buildProOverlaySvg } = await import("../../scripts/compose-overlay.mjs");

      let overlay;
      const TYPO_PROPS = ["pos", "color", "font", "size", "weight", "tracking", "case", "align"];
      const TEXT_KEYS  = ["headline", "body", "eyebrow", "signature", "microCopy"];

      function mergeTypo(src, target) {
        for (const k of TEXT_KEYS)
          for (const p of TYPO_PROPS) {
            const key = `${k}_${p}`;
            if (src[key] != null) target[key] = src[key];
          }
      }

      if (isPost && postedOverlay) {
        // Render en vivo: overlay viene del estado en memoria del editor (ya tiene _pos + _font etc.)
        overlay = normalizeOverlay({ overlay: postedOverlay });
        mergeTypo(postedOverlay, overlay);
      } else {
        // GET: leer desde disco
        const overlayPath = join(dir, "overlay-copy.json");
        if (!existsSync(overlayPath)) {
          res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-cache" });
          return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`);
        }
        const overlayCopy = await readJson(overlayPath);
        const rawSlide = overlayCopy.slides?.[id];
        overlay = normalizeOverlay(rawSlide);
        mergeTypo(rawSlide?.overlay || rawSlide || {}, overlay);
      }

      const result = buildProOverlaySvg({
        width, height, overlay,
        layout:   rawLayout,
        palette:  config.colors || {},
        logoZone: null,
      });

      res.writeHead(200, {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      return res.end(result.svg);
    }

    // ─── Posiciones calculadas por el compositor (para WYSIWYG inicial) ──
    if (url.pathname === "/api/compute-positions") {
      const slug = url.searchParams.get("slug");
      const id   = url.searchParams.get("id");
      if (!slug || !id) return sendJson(res, 400, { error: "slug e id requeridos" });

      const dir         = resolve(ROOT, "output/social", slug);
      const overlayPath = join(dir, "overlay-copy.json");
      const layoutPath  = join(dir, "layout-plan.json");
      const configPath  = resolve(ROOT, "brand.config.json");
      const manifestPath = join(dir, "manifest.json");

      if (!existsSync(overlayPath)) return sendJson(res, 200, { computedPositions: {} });

      const overlayCopy = await readJson(overlayPath);
      const layoutPlan  = existsSync(layoutPath)  ? await readJson(layoutPath)  : { slides: {} };
      const config      = existsSync(configPath)  ? await readJson(configPath)  : {};
      const manifest    = existsSync(manifestPath)? await readJson(manifestPath): {};

      const rawSlide  = overlayCopy.slides?.[id];
      const rawLayout = layoutPlan.slides?.[id];
      const width     = manifest.target?.width  || 1080;
      const height    = manifest.target?.height || 1350;

      const { normalizeOverlay, buildProOverlaySvg } = await import("../../scripts/compose-overlay.mjs");
      const overlay = normalizeOverlay(rawSlide);
      const overlayObj = rawSlide?.overlay || rawSlide || {};
      for (const k of ["headline", "body", "eyebrow", "signature", "microCopy"]) {
        if (overlayObj[`${k}_pos`])   overlay[`${k}_pos`]   = overlayObj[`${k}_pos`];
        if (overlayObj[`${k}_color`]) overlay[`${k}_color`] = overlayObj[`${k}_color`];
      }

      const result = buildProOverlaySvg({ width, height, overlay, layout: rawLayout, palette: config.colors || {}, logoZone: rawSlide?.logoZone || null });
      return sendJson(res, 200, { computedPositions: result.computedPositions });
    }

    // ─── SVG background en vivo con params editables ──────────────
    if (url.pathname === "/api/bg-svg") {
      const slug = url.searchParams.get("slug");
      const id   = url.searchParams.get("id");
      if (!slug || !id) return sendJson(res, 400, { error: "slug e id requeridos" });

      // Leer params del overlay-copy.json si existen
      const overlayPath = resolve(ROOT, "output/social", slug, "overlay-copy.json");
      let bgParams = {};
      if (existsSync(overlayPath)) {
        const oc = await readJson(overlayPath);
        bgParams = oc.slides?.[id]?.bg || {};
      }

      // Determinar índice del slide por id (slide-01 → 0, slide-02 → 1, ...)
      const m = id.match(/(\d+)$/);
      const idx = m ? parseInt(m[1], 10) - 1 : 0;

      const { buildSvg } = await import("../../scripts/css-backgrounds.mjs");
      const svg = buildSvg(idx, bgParams);
      res.writeHead(200, {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      return res.end(svg);
    }

    if (url.pathname === "/api/save" && req.method === "POST") {
      const body = await readBody(req);
      if (!body?.slug) return sendJson(res, 400, { error: "missing slug" });
      const dir = resolve(ROOT, "output/social", body.slug);
      if (body.overlayCopy) await writeFile(join(dir, "overlay-copy.json"), JSON.stringify(body.overlayCopy, null, 2));
      if (body.layoutPlan)  await writeFile(join(dir, "layout-plan.json"),  JSON.stringify(body.layoutPlan,  null, 2));
      return sendJson(res, 200, { saved: true, dir });
    }

    if (url.pathname === "/api/compose" && req.method === "POST") {
      const body = await readBody(req);
      if (!body?.slug) return sendJson(res, 400, { error: "missing slug" });
      const { spawn } = await import("node:child_process");
      const child = spawn("npm", ["run", "compose", "--", `--dir=output/social/${body.slug}`], { cwd: ROOT, shell: true });
      let stdout = "", stderr = "";
      child.stdout.on("data", (d) => stdout += d.toString());
      child.stderr.on("data", (d) => stderr += d.toString());
      child.on("exit", (code) => sendJson(res, 200, { code, stdout, stderr }));
      return;
    }

    // ─── Static slide images ───────────────────────────────────────
    if (url.pathname.startsWith("/slides/")) {
      const rel = url.pathname.slice("/slides/".length);
      const filePath = resolve(ROOT, "output/social", rel);
      if (!filePath.startsWith(resolve(ROOT, "output/social"))) return sendJson(res, 403, { error: "forbidden" });
      return serveFile(res, filePath);
    }

    if (url.pathname.startsWith("/assets/")) {
      const rel = url.pathname.slice("/assets/".length);
      const filePath = resolve(ROOT, "brand-assets", rel);
      if (!filePath.startsWith(resolve(ROOT, "brand-assets"))) return sendJson(res, 403, { error: "forbidden" });
      return serveFile(res, filePath);
    }

    if (url.pathname.startsWith("/fonts/")) {
      const rel = url.pathname.slice("/fonts/".length);
      const filePath = resolve(ROOT, "scripts/fonts", rel);
      if (!filePath.startsWith(resolve(ROOT, "scripts/fonts"))) return sendJson(res, 403, { error: "forbidden" });
      return serveFile(res, filePath);
    }

    if (url.pathname === "/api/brand-assets") {
      const list = [];
      for (const sub of ["logos", "tools", "uploads", "mascots", "character"]) {
        const p = resolve(ROOT, "brand-assets", sub);
        if (!existsSync(p)) continue;
        const files = await readdir(p);
        for (const f of files) {
          if (/\.(png|jpg|jpeg|svg|webp)$/i.test(f)) {
            list.push({ sub, file: f, url: `/assets/${sub}/${f}`, name: f.replace(/\.[^.]+$/,"") });
          }
        }
      }
      return sendJson(res, 200, list);
    }

    // ─── Simple Icons (logos de marcas) ────────────────────────────
    // Devuelve SVG del logo por slug. Ej: /api/simple-icons?slug=claude&color=D97856
    if (url.pathname === "/api/simple-icons") {
      const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9.-]/g, "");
      const color = (url.searchParams.get("color") || "").replace(/[^a-f0-9]/gi, "");
      if (!slug) return sendJson(res, 400, { error: "slug required" });
      const upstream = color ? `https://cdn.simpleicons.org/${slug}/${color}` : `https://cdn.simpleicons.org/${slug}`;
      try {
        const r = await fetch(upstream);
        if (!r.ok) return sendJson(res, 404, { error: "not found in Simple Icons" });
        const svg = await r.text();
        res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "max-age=3600" });
        return res.end(svg);
      } catch (err) { return sendJson(res, 502, { error: String(err.message) }); }
    }

    // Búsqueda por prefijo en Simple Icons (descarga el catálogo oficial, cachea)
    if (url.pathname === "/api/simple-icons/search") {
      const q = (url.searchParams.get("q") || "").toLowerCase().trim();
      if (!q || q.length < 2) return sendJson(res, 200, []);
      try {
        if (!server._siCatalog) {
          const r = await fetch("https://raw.githubusercontent.com/simple-icons/simple-icons/master/_data/simple-icons.json");
          const data = await r.json();
          server._siCatalog = (data.icons || data).map(i => ({
            name: i.title,
            slug: i.slug || i.title.toLowerCase().replace(/[^a-z0-9]+/g, ""),
            hex: i.hex
          }));
        }
        const results = server._siCatalog
          .filter(i => i.name.toLowerCase().includes(q) || i.slug.includes(q))
          .slice(0, 40);
        return sendJson(res, 200, results);
      } catch (err) { return sendJson(res, 502, { error: String(err.message) }); }
    }

    // ─── Iconify (200k+ iconos generales) ──────────────────────────
    // Búsqueda: /api/iconify/search?q=cloud
    if (url.pathname === "/api/iconify/search") {
      const q = (url.searchParams.get("q") || "").trim();
      if (!q || q.length < 2) return sendJson(res, 200, { icons: [] });
      try {
        const r = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=40`);
        const data = await r.json();
        return sendJson(res, 200, data);
      } catch (err) { return sendJson(res, 502, { error: String(err.message) }); }
    }

    // Obtener SVG de un icono: /api/iconify/icon?name=tabler:cloud&color=D4AF37
    if (url.pathname === "/api/iconify/icon") {
      const name = url.searchParams.get("name");
      const color = url.searchParams.get("color") || "D4AF37";
      if (!name) return sendJson(res, 400, { error: "name required" });
      try {
        const [set, icon] = name.split(":");
        const r = await fetch(`https://api.iconify.design/${set}/${icon}.svg?color=%23${color}`);
        const svg = await r.text();
        res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "max-age=3600" });
        return res.end(svg);
      } catch (err) { return sendJson(res, 502, { error: String(err.message) }); }
    }

    // ─── Import logo/icon → PNG local (para usarlo en compose) ─────
    if (url.pathname === "/api/import-library" && req.method === "POST") {
      const body = await readBody(req);
      if (!body?.url || !body?.name) return sendJson(res, 400, { error: "missing url or name" });
      const { mkdir } = await import("node:fs/promises");
      const uploadsDir = resolve(ROOT, "brand-assets/uploads");
      await mkdir(uploadsDir, { recursive: true });
      try {
        const r = await fetch(body.url);
        const buffer = Buffer.from(await r.arrayBuffer());
        const safeName = body.name.replace(/[^a-zA-Z0-9._-]/g, "_") + (body.url.includes(".svg") ? ".svg" : ".png");

        // Si es SVG, convertir a PNG con sharp para mejor compatibilidad con compose
        let finalBuffer = buffer;
        let finalName = safeName;
        if (body.url.includes(".svg") || buffer.toString("utf8", 0, 100).includes("<svg")) {
          const sharp = (await import("sharp")).default;
          finalBuffer = await sharp(buffer).resize({ width: 800 }).png().toBuffer();
          finalName = safeName.replace(/\.svg$/, ".png");
        }
        const outPath = join(uploadsDir, finalName);
        await writeFile(outPath, finalBuffer);
        return sendJson(res, 200, {
          file: finalName, sub: "uploads",
          url: `/assets/uploads/${finalName}`,
          name: finalName.replace(/\.[^.]+$/, "")
        });
      } catch (err) { return sendJson(res, 502, { error: String(err.message) }); }
    }

    // ─── Memory system ─────────────────────────────────────────────
    if (url.pathname === "/api/memory" && req.method === "GET") {
      const p = resolve(ROOT, "memory.json");
      if (!existsSync(p)) return sendJson(res, 404, { error: "memory.json not found" });
      return sendJson(res, 200, await readJson(p));
    }

    if (url.pathname === "/api/memory" && req.method === "POST") {
      const body = await readBody(req);
      if (!body) return sendJson(res, 400, { error: "invalid body" });
      body.lastUpdated = new Date().toISOString().slice(0, 10);
      await writeFile(resolve(ROOT, "memory.json"), JSON.stringify(body, null, 2));
      return sendJson(res, 200, { ok: true });
    }

    // ─── Detección de plataformas en un texto ──────────────────────
    if (url.pathname === "/api/detect-platforms" && req.method === "GET") {
      const text = url.searchParams.get("text") || "";
      try {
        const { detectPlatforms } = await import("../../scripts/platforms-registry.mjs");
        const platforms = detectPlatforms(text);
        return sendJson(res, 200, { platforms });
      } catch (err) {
        return sendJson(res, 502, { error: String(err?.message || err) });
      }
    }

    // ─── Generador IA de imágenes (WaveSpeed / OpenAI fallback) ────
    if (url.pathname === "/api/ai-generate" && req.method === "POST") {
      const body = await readBody(req);
      if (!body?.prompt) return sendJson(res, 400, { error: "prompt required" });
      try {
        const { mkdir } = await import("node:fs/promises");
        const uploadsDir = resolve(ROOT, "brand-assets/uploads");
        await mkdir(uploadsDir, { recursive: true });

        const dotenv = (await import("dotenv")).default;
        dotenv.config({ path: resolve(ROOT, ".env.local") });
        dotenv.config({ path: resolve(ROOT, ".env") });

        const size   = body.size   || "1024x1280";
        const logos  = Array.isArray(body.logos) ? body.logos : [];
        let imgBuffer;

        if (process.env.WAVESPEED_API_KEY) {
          // ── Proveedor: WaveSpeed (flux-dev, calidad premium) ──────
          const { generateImage } = await import("../../scripts/wavespeed-client.mjs");
          imgBuffer = await generateImage(body.prompt, { size });
        } else {
          // ── Fallback: OpenAI gpt-image-2 ─────────────────────────
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI();
          const r = await openai.images.generate({
            model:      "gpt-image-2",
            prompt:     body.prompt,
            size,
            quality:    body.quality || "high",
            moderation: "low",
            n:          1,
          });
          const b64 = r?.data?.[0]?.b64_json;
          if (!b64) throw new Error("OpenAI no devolvió imagen");
          imgBuffer = Buffer.from(b64, "base64");
        }

        // ── Incrustar logos de plataformas (si se solicitaron) ──────
        let logoZone = null;
        if (logos.length > 0) {
          const { compositePlatformLogos } = await import("../../scripts/logo-compositor.mjs");
          const result = await compositePlatformLogos(imgBuffer, logos);
          imgBuffer = result.buffer;
          logoZone  = result.logoZone;
        }

        const timestamp = Date.now();
        const filename  = `ai-${timestamp}.png`;
        const outPath   = join(uploadsDir, filename);
        await writeFile(outPath, imgBuffer);

        return sendJson(res, 200, {
          file: filename, sub: "uploads",
          url:  `/assets/uploads/${filename}`,
          name: filename.replace(/\.png$/, ""),
          size,
          logoZone,
        });
      } catch (err) {
        console.error("AI generate error:", err);
        return sendJson(res, 502, { error: String(err?.message || err) });
      }
    }

    // ─── Upload de archivos (multipart) ────────────────────────────
    if (url.pathname === "/api/upload" && req.method === "POST") {
      const { mkdir } = await import("node:fs/promises");
      const uploadsDir = resolve(ROOT, "brand-assets/uploads");
      await mkdir(uploadsDir, { recursive: true });

      const chunks = [];
      for await (const c of req) chunks.push(c);
      const buffer = Buffer.concat(chunks);

      // Parser multipart simple (basta para PNG/JPG)
      const boundary = (req.headers["content-type"] || "").split("boundary=")[1];
      if (!boundary) return sendJson(res, 400, { error: "no boundary" });
      const parts = buffer.toString("latin1").split(`--${boundary}`);
      const saved = [];
      for (const part of parts) {
        const m = part.match(/Content-Disposition: form-data; name="[^"]+"; filename="([^"]+)"\r\nContent-Type: ([^\r\n]+)\r\n\r\n([\s\S]+?)\r\n$/);
        if (!m) continue;
        const [, filename, , content] = m;
        const buf = Buffer.from(content, "latin1");
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const outPath = join(uploadsDir, safeName);
        await writeFile(outPath, buf);
        saved.push({ file: safeName, sub: "uploads", url: `/assets/uploads/${safeName}`, name: safeName.replace(/\.[^.]+$/,"") });
      }
      return sendJson(res, 200, { uploaded: saved });
    }

    // ─── UI files ──────────────────────────────────────────────────
    if (url.pathname === "/" || url.pathname === "/index.html") return serveFile(res, join(__dirname, "index.html"));
    if (url.pathname === "/app.js") return serveFile(res, join(__dirname, "app.js"));
    if (url.pathname === "/styles.css") return serveFile(res, join(__dirname, "styles.css"));

    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: String(err?.message ?? err) });
  }
});

server.listen(PORT, () => {
  console.log(`\n🎨 Overlay Editor PRO`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Fuentes: Anton · Inter servidas desde /fonts/`);
  console.log(`   Ctrl+C para detener.\n`);
});
