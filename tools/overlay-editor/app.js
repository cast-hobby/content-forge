// Overlay Editor PRO · vanilla JS, sin dependencias.
// Features: drag-drop archivos, upload PNG, Google Fonts, typography tokens, zoom,
//           snapping, undo/redo (Ctrl+Z/Y), keyboard shortcuts, layers panel,
//           resize handles (4 esquinas), drag desde library a canvas.

// ─── Biblioteca de fuentes (Google Fonts preloaded en HTML + Anton+Inter locales)
const FONTS = [
  { name: "Anton", family: "Anton, sans-serif", category: "display" },
  { name: "Bebas Neue", family: "'Bebas Neue', sans-serif", category: "display" },
  { name: "Archivo Black", family: "'Archivo Black', sans-serif", category: "display" },
  { name: "Oswald", family: "Oswald, sans-serif", category: "display" },
  { name: "Unbounded", family: "Unbounded, sans-serif", category: "display" },
  { name: "Syne", family: "Syne, sans-serif", category: "display" },
  { name: "Inter", family: "Inter, 'Inter-Local', sans-serif", category: "sans" },
  { name: "Manrope", family: "Manrope, sans-serif", category: "sans" },
  { name: "DM Sans", family: "'DM Sans', sans-serif", category: "sans" },
  { name: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', sans-serif", category: "sans" },
  { name: "Outfit", family: "Outfit, sans-serif", category: "sans" },
  { name: "Sora", family: "Sora, sans-serif", category: "sans" },
  { name: "Space Grotesk", family: "'Space Grotesk', sans-serif", category: "sans" },
  { name: "Work Sans", family: "'Work Sans', sans-serif", category: "sans" },
  { name: "Poppins", family: "Poppins, sans-serif", category: "sans" },
  { name: "Montserrat", family: "Montserrat, sans-serif", category: "sans" },
  { name: "Raleway", family: "Raleway, sans-serif", category: "sans" },
  { name: "Josefin Sans", family: "'Josefin Sans', sans-serif", category: "sans" },
  { name: "Playfair Display", family: "'Playfair Display', serif", category: "serif" },
  { name: "Cormorant Garamond", family: "'Cormorant Garamond', serif", category: "serif" },
  { name: "Lora", family: "Lora, serif", category: "serif" },
];

// ─── Typography tokens (matching scripts/compose-overlay.mjs)
const TOKENS = {
  "display-xl": { scale: 0.115, font: "Anton", weight: 400, tracking: -2, lineH: 0.91, case: "upper" },
  "display":    { scale: 0.098, font: "Anton", weight: 400, tracking: -2, lineH: 0.91, case: "upper" },
  "display-sm": { scale: 0.082, font: "Anton", weight: 400, tracking: -1.5, lineH: 0.93, case: "upper" },
  "display-xs": { scale: 0.068, font: "Anton", weight: 400, tracking: -0.8, lineH: 0.95, case: "upper" },
  "heading":    { scale: 0.055, font: "Inter", weight: 700, tracking: -0.5, lineH: 1.10, case: "upper" },
  "subheading": { scale: 0.042, font: "Inter", weight: 600, tracking: 0, lineH: 1.25, case: "normal" },
  "body":       { scale: 0.0318, font: "Inter", weight: 400, tracking: 0, lineH: 1.55, case: "normal" },
  "caption":    { scale: 0.0240, font: "Inter", weight: 500, tracking: 0.5, lineH: 1.45, case: "normal" },
  "label":      { scale: 0.0240, font: "Inter", weight: 700, tracking: 4.5, lineH: 1.20, case: "upper" },
  "signature":  { scale: 0.0240, font: "Inter", weight: 600, tracking: 3.5, lineH: 1.20, case: "normal" },
  "micro":      { scale: 0.0190, font: "Inter", weight: 500, tracking: 1.8, lineH: 1.30, case: "upper" },
};

// ─── Style Presets (chips de tipografía 1-click) ──────────────────────
const STYLE_PRESETS = {
  HERO:    { font:"Bebas Neue", size:0.12, weight:400, tracking:-2, uppercase:true,  color:"white", italic:false },
  DISPLAY: { font:"Anton",     size:0.09, weight:400, tracking:-1, uppercase:true,  color:"white", italic:false },
  HEADING: { font:"Oswald",    size:0.06, weight:700, tracking:0,  uppercase:false, color:"white", italic:false },
  BODY:    { font:"Inter",     size:0.032,weight:400, tracking:0,  uppercase:false, color:"white", italic:false },
  GOLD:    { font:"Bebas Neue",size:0.08, weight:400, tracking:-1, uppercase:true,  color:"gold",  italic:false },
  CAPTION: { font:"Inter",     size:0.022,weight:400, tracking:1,  uppercase:false, color:"gray",  italic:false },
  SERIF:   { font:"Playfair Display",size:0.05,weight:700,tracking:0,uppercase:false,color:"white",italic:false },
  LABEL:   { font:"Inter",     size:0.018,weight:600, tracking:3,  uppercase:true,  color:"gray",  italic:false },
};

// ─── State ─────────────────────────────────────────────────────────────
const state = {
  slug: null,
  manifest: null,
  overlayCopy: { slides: {} },
  layoutPlan: { slides: {} },
  currentSlideId: null,
  selected: null,         // { kind, key }
  canvas: null,
  tool: "select",
  zoom: 1,
  history: [],
  historyIdx: -1,
  brandConfig: null,
  palette: { white: "#FFFFFF", primary: "#050505", dark: "#D4AF37", light: "#C9A84C", grayLight: "#BDBCBC", grayDark: "#3D3D3C" },
  _composed: false,      // true después de compose — navegar muestra -final.png
  _showPreview: false,
  _showResult: false,
};

// ─── Utilities ─────────────────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function status(msg, kind = "") {
  const el = $("#status");
  el.textContent = msg;
  el.className = "status visible " + kind;
  clearTimeout(status._t);
  status._t = setTimeout(() => el.classList.remove("visible"), 2400);
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function pushHistory() {
  state.history = state.history.slice(0, state.historyIdx + 1);
  state.history.push({ overlayCopy: clone(state.overlayCopy), layoutPlan: clone(state.layoutPlan) });
  if (state.history.length > 50) state.history.shift();
  state.historyIdx = state.history.length - 1;
  scheduleSvgUpdate();
}

function undo() {
  if (state.historyIdx <= 0) return status("Nada que deshacer");
  state.historyIdx--;
  const snap = state.history[state.historyIdx];
  state.overlayCopy = clone(snap.overlayCopy);
  state.layoutPlan = clone(snap.layoutPlan);
  renderElements(); renderProps(); renderLayers();
  if (_floatKey) updateFloatToolbar(_floatKey);
  scheduleSvgUpdate();
  status("↶ Deshacer");
}

function redo() {
  if (state.historyIdx >= state.history.length - 1) return status("Nada que rehacer");
  state.historyIdx++;
  const snap = state.history[state.historyIdx];
  state.overlayCopy = clone(snap.overlayCopy);
  state.layoutPlan = clone(snap.layoutPlan);
  renderElements(); renderProps(); renderLayers();
  if (_floatKey) updateFloatToolbar(_floatKey);
  scheduleSvgUpdate();
  status("↷ Rehacer");
}

// ─── Fetch helpers ─────────────────────────────────────────────────────
async function api(url, options = {}) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

// ─── Load carousels / brand config ─────────────────────────────────────
async function loadCarousels() {
  const list = await api("/api/carousels");
  const sel = $("#carousel-select");
  sel.innerHTML = '<option value="">— Carga un carrusel —</option>';
  list.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.slug;
    opt.textContent = c.slug + (c.hasOverlay ? " ●" : "");
    sel.appendChild(opt);
  });
}

async function loadBrandConfig() {
  try {
    const cfg = await api("/api/brand-config");
    state.brandConfig = cfg;
    if (cfg.colors) state.palette = { ...state.palette, ...cfg.colors };
  } catch {}
}

// Convierte el overlay-copy del servidor al formato plano que usa el editor.
// Los campos headline/body/signature pueden llegar como objetos {text, x, y, color, ...}
// o como strings simples. Los normalizamos a strings + campos _pos/_color separados.
function normalizeOverlayCopyForEditor(overlayCopy) {
  if (!overlayCopy?.slides) return overlayCopy;
  const txt = (v) => (v && typeof v === "object" ? (v.text || "") : (v || ""));
  const TEXT_FIELDS = ["eyebrow", "headline", "subhead", "body", "signature", "microCopy"];
  for (const [, slideData] of Object.entries(overlayCopy.slides)) {
    if (!slideData?.overlay) continue;
    const ov = slideData.overlay;
    for (const field of TEXT_FIELDS) {
      if (ov[field] && typeof ov[field] === "object") {
        const obj = ov[field];
        // Si hay x/y en el objeto y no existe ya un _pos, usarlos
        if ((obj.x != null || obj.y != null) && !ov[`${field}_pos`]) {
          ov[`${field}_pos`] = { x: obj.x ?? 0.06, y: obj.y ?? 0.06, w: obj.maxWidth ?? 0.88 };
        }
        // Si hay color en el objeto y no existe ya _color, usarlo
        if (obj.color && !ov[`${field}_color`]) {
          ov[`${field}_color`] = obj.color;
        }
        // Reemplazar el campo objeto por el texto plano
        ov[field] = txt(obj);
      }
    }
  }
  return overlayCopy;
}

async function loadCarousel(slug) {
  if (!slug) return;
  const data = await api(`/api/load?slug=${encodeURIComponent(slug)}`);
  state.slug = data.slug;
  state.manifest = data.manifest;
  state.overlayCopy = normalizeOverlayCopyForEditor(data.overlayCopy || { slides: {} });
  state.layoutPlan = data.layoutPlan || { slides: {} };
  state._loadTs = Date.now();
  state._composed = false;        // resetear modo resultado al cargar nuevo carrusel
  state._showPreview = false;
  state._showResult  = false;
  const dl = $("#btn-download");
  if (dl) dl.style.display = "none";
  state.history = []; state.historyIdx = -1;
  // Cargar defaults de fondo CSS para el panel de edición
  try { state._bgDefaults = await api("/api/bg-defaults"); } catch { state._bgDefaults = {}; }
  pushHistory();

  // Ajustar aspect ratio del canvas según resolución del carrusel.
  // Acepta manifest.resolution ("1080x1350") o manifest.target ({ width, height }).
  const res = data.manifest.resolution;
  const tgt = data.manifest.target;
  const [rw, rh] = res
    ? res.split("x").map(Number)
    : tgt?.width && tgt?.height
      ? [tgt.width, tgt.height]
      : [4, 5];
  document.getElementById("canvas").style.aspectRatio = `${rw} / ${rh}`;

  renderSlideList();
  if (data.manifest.results?.length) selectSlide(data.manifest.results[0].id);
  status(`Cargado: ${slug}`, "success");
}

// ─── Assets ────────────────────────────────────────────────────────────
async function loadAssets() {
  const list = await api("/api/brand-assets");
  const grid = $("#asset-list");
  grid.innerHTML = "";
  list.forEach((a) => {
    const div = document.createElement("div");
    div.className = "asset-item";
    div.draggable = true;
    div.innerHTML = `<img src="${a.url}" /><span class="asset-name">${a.name}</span>`;
    div.title = `${a.sub}/${a.file}`;
    div.dataset.asset = a.name;
    div.dataset.sub = a.sub;
    div.addEventListener("click", () => addLogoElement(a));
    div.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/x-asset", JSON.stringify(a));
      e.dataTransfer.effectAllowed = "copy";
    });
    grid.appendChild(div);
  });
}

async function uploadFiles(files) {
  const formData = new FormData();
  for (const f of files) formData.append("file", f);
  const r = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await r.json();
  status(`Subido${data.uploaded?.length > 1 ? "s" : ""}: ${data.uploaded?.length} archivo(s)`, "success");
  await loadAssets();
}

// ─── Fonts ─────────────────────────────────────────────────────────────
let _fontFilter = "";
let _fontCat = "all";
function renderFontList() {
  const ul = $("#font-list");
  ul.innerHTML = "";
  const f = _fontFilter.toLowerCase();
  const previewText = $("#font-preview-text")?.value || "Aa Bb 123";
  FONTS.filter(x => {
    if (_fontCat !== "all" && x.category !== _fontCat) return false;
    if (f && !x.name.toLowerCase().includes(f)) return false;
    return true;
  }).forEach((font) => {
    const li = document.createElement("li");
    li.style.fontFamily = font.family;
    li.textContent = previewText;
    const sp = document.createElement("span");
    sp.className = "font-name";
    sp.textContent = `${font.name} · ${font.category}`;
    li.appendChild(sp);
    li.addEventListener("click", () => applyFontToSelected(font.name));
    ul.appendChild(li);
  });
}

// ─── Library: Simple Icons + Iconify ───────────────────────────────────
let _libMode = "simple";
let _libSearchTimer = null;

async function libSearch(q) {
  const results = $("#lib-results");
  const empty = $("#lib-empty");
  results.innerHTML = "";
  if (!q || q.length < 2) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  const color = ($("#lib-color-text")?.value || "D4AF37").replace("#","");
  try {
    if (_libMode === "simple") {
      const list = await api(`/api/simple-icons/search?q=${encodeURIComponent(q)}`);
      list.forEach((it) => {
        const div = document.createElement("div");
        div.className = "asset-item";
        div.innerHTML = `<img src="/api/simple-icons?slug=${it.slug}&color=${color}" /><span class="asset-name">${it.name}</span>`;
        div.title = it.name;
        div.addEventListener("click", () => importLibAsset({
          name: `simple-${it.slug}`,
          url: `${location.origin}/api/simple-icons?slug=${it.slug}&color=${color}`
        }));
        results.appendChild(div);
      });
    } else {
      const data = await api(`/api/iconify/search?q=${encodeURIComponent(q)}`);
      const icons = data.icons || [];
      icons.slice(0, 40).forEach((iconName) => {
        const div = document.createElement("div");
        div.className = "asset-item";
        div.innerHTML = `<img src="/api/iconify/icon?name=${encodeURIComponent(iconName)}&color=${color}" /><span class="asset-name">${iconName}</span>`;
        div.title = iconName;
        div.addEventListener("click", () => importLibAsset({
          name: iconName.replace(":","-"),
          url: `${location.origin}/api/iconify/icon?name=${encodeURIComponent(iconName)}&color=${color}`
        }));
        results.appendChild(div);
      });
    }
    if (results.children.length === 0) {
      results.innerHTML = '<div class="muted" style="padding:14px; grid-column:1/-1;">Sin resultados</div>';
    }
  } catch (err) {
    status("Error en búsqueda: " + err.message, "error");
  }
}

async function importLibAsset(asset) {
  status("Importando...");
  try {
    const r = await api("/api/import-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(asset)
    });
    await loadAssets();
    status(`Importado: ${r.name}`, "success");
    // Auto-añadir al slide actual
    if (state.currentSlideId) {
      addLogoElement({ name: r.name, sub: "uploads", file: r.file, url: r.url });
    }
  } catch (err) {
    status("Error: " + err.message, "error");
  }
}

// ─── AI Generator ──────────────────────────────────────────────────────

// Cache de plataformas detectadas para el prompt actual
let _detectedPlatforms = [];

async function detectAndRenderPlatforms(prompt) {
  if (!prompt || prompt.length < 3) {
    _detectedPlatforms = [];
    renderDetectedLogos([]);
    return;
  }
  try {
    const r = await fetch(`/api/detect-platforms?text=${encodeURIComponent(prompt)}`);
    if (!r.ok) return;
    const data = await r.json();
    _detectedPlatforms = data.platforms || [];
    renderDetectedLogos(_detectedPlatforms);
  } catch { /* silencioso */ }
}

function renderDetectedLogos(platforms) {
  const bar      = $("#ai-platform-bar");
  const container = $("#ai-detected-logos");
  container.innerHTML = "";

  if (!platforms || platforms.length === 0) {
    bar.style.display = "none";
    return;
  }

  bar.style.display = "block";
  platforms.forEach(p => {
    const badge = document.createElement("span");
    badge.style.cssText =
      "display:inline-flex;align-items:center;gap:4px;padding:3px 8px;" +
      "background:rgba(255,255,255,0.08);border-radius:12px;" +
      "font-size:10px;color:#fff;border:1px solid rgba(255,255,255,0.15)";
    badge.innerHTML = `<img src="${p.iconUrl}" style="width:12px;height:12px;object-fit:contain" onerror="this.style.display='none'" />${p.name}`;
    container.appendChild(badge);
  });
}

async function aiGenerate() {
  const prompt = $("#ai-prompt").value.trim();
  if (!prompt) return status("Escribe un prompt primero", "error");
  const size    = $("#ai-size").value;
  const quality = $("#ai-quality").value;
  const embed   = $("#ai-embed-logos")?.checked ?? true;
  const logos   = embed ? _detectedPlatforms.map(p => p.slug) : [];
  const btn     = $("#ai-generate-btn");

  btn.disabled = true;
  btn.textContent = logos.length > 0
    ? `Generando + incrustando ${logos.length} logo(s)...`
    : "Generando imagen premium...";

  try {
    const r = await api("/api/ai-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, size, quality, logos })
    });
    status(`Generado: ${r.name}`, "success");

    // Guardar logoZone al nivel del slide (no dentro del overlay interno)
    if (r.logoZone && state.currentSlideId) {
      if (!state.overlayCopy.slides) state.overlayCopy.slides = {};
      if (!state.overlayCopy.slides[state.currentSlideId]) state.overlayCopy.slides[state.currentSlideId] = {};
      state.overlayCopy.slides[state.currentSlideId].logoZone = r.logoZone;
    }

    // Añadir al panel de resultados + recargar assets
    const resultsDiv = $("#ai-results");
    const div = document.createElement("div");
    div.className = "asset-item";
    div.innerHTML = `<img src="${r.url}" /><span class="asset-name">${r.name}</span>`;
    div.addEventListener("click", () => addLogoElement({ name: r.name, sub: "uploads", file: r.file, url: r.url }));
    resultsDiv.prepend(div);
    await loadAssets();
  } catch (err) {
    status("Error IA: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Generar imagen";
  }
}

function applyFontToSelected(fontName) {
  if (!state.selected || state.selected.kind !== "text") return status("Selecciona un texto primero", "error");
  const overlay = ensureSlideData(state.currentSlideId);
  const type = state.selected.key;
  overlay[`${type}_font`] = fontName;
  pushHistory();
  renderElements();
  status(`Fuente: ${fontName}`, "success");
}

// ─── Slide list ────────────────────────────────────────────────────────
function renderSlideList() {
  const ul = $("#slide-list");
  ul.innerHTML = "";
  const ts = Date.now();
  (state.manifest.results || []).forEach((r, i) => {
    const li = document.createElement("li");
    li.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;";
    const filename  = r.path ? r.path.split(/[\\/]/).pop() : `${r.id}.png`;
    const finalName = filename.replace(/\.png$/i, "-final.png");
    const finalSrc  = r.ok !== false ? `/slides/${state.slug}/${finalName}?t=${ts}` : "";
    const mainSrc   = r.ok !== false ? `/slides/${state.slug}/${filename}?t=${ts}` : "";
    const img = document.createElement("img");
    img.style.cssText = `width:52px;height:52px;object-fit:cover;border-radius:4px;flex-shrink:0;background:#111;${r.ok === false ? "opacity:0.3;" : ""}`;
    img.onerror = () => { img.onerror = null; img.src = mainSrc; };
    img.src = finalSrc;
    const numSpan = document.createElement("span");
    numSpan.style.cssText = "color:var(--fg-muted);font-size:10px;min-width:16px";
    numSpan.textContent = String(i+1).padStart(2,"0");
    const labelSpan = document.createElement("span");
    labelSpan.style.cssText = "font-size:11px;overflow:hidden;text-overflow:ellipsis;";
    labelSpan.textContent = r.narrativeBeat || r.id;
    li.append(img, numSpan, labelSpan);
    li.dataset.id = r.id;
    li.addEventListener("click", () => selectSlide(r.id));
    if (r.id === state.currentSlideId) li.classList.add("active");
    ul.appendChild(li);
  });
}

// ─── Final result helpers ───────────────────────────────────────────────
function getFinalFilename(id) {
  const result = state.manifest?.results?.find((r) => r.id === id);
  if (!result) return null;
  const fname = result.filename || result.path?.split(/[\\/]/).pop();
  return fname ? fname.replace(/\.png$/i, "-final.png") : null;
}

function showComposedResult(id) {
  state.currentSlideId = id;
  state.selected       = null;
  state._showPreview   = false;
  state._showResult    = true;

  const fname = getFinalFilename(id);
  const ts    = Date.now();

  if (fname) {
    const url = `/slides/${state.slug}/${fname}?t=${ts}`;
    const img = $("#slide-image");
    img.onerror = null;
    img.src = url;
    // Solo la imagen final — sin SVG overlay ni HTML elements
    const svgDiv = $("#slide-overlay-svg");
    const layer  = $("#layer");
    if (svgDiv) svgDiv.style.display = "none";
    if (layer)  layer.style.display  = "none";
    // Botón descarga
    const dl = $("#btn-download");
    if (dl) { dl.href = url; dl.download = fname; dl.style.display = "inline-flex"; }
    $("#canvas-meta").textContent = `${id} · ✅ final · ${fname}`;
  } else {
    // Si no existe -final.png todavía, mostrar el original
    selectSlide(id, false);
    return;
  }

  const result = state.manifest.results.find(r => r.id === id);
  const idx = result ? state.manifest.results.indexOf(result) + 1 : 1;
  $("#slide-indicator").textContent = `${idx} / ${state.manifest.results.length}`;

  renderSlideList();
  renderElements(); renderProps(); renderLayers();
}

// ─── Live SVG render (compositor real, siempre visible) ───────────────
async function updateSvgNow() {
  if (!state.currentSlideId || !state.slug) return;
  if (state._showResult) return;   // en modo resultado el SVG no debe sobreponerse al -final.png
  const container = $("#slide-overlay-svg");
  if (!container) return;
  const slideData  = state.overlayCopy.slides?.[state.currentSlideId] || {};
  const overlayObj = slideData.overlay || {};
  try {
    const r = await fetch("/api/compose-svg", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ slug: state.slug, id: state.currentSlideId, overlay: overlayObj }),
    });
    if (!r.ok) return;
    const svgText = await r.text();
    container.innerHTML = svgText;
    const svgEl = container.querySelector("svg");
    if (svgEl) {
      svgEl.style.width  = "100%";
      svgEl.style.height = "100%";
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
    container.style.display = "";
  } catch { /* silencioso */ }
}

let _svgTimer = null;
function scheduleSvgUpdate() {
  clearTimeout(_svgTimer);
  _svgTimer = setTimeout(updateSvgNow, 280);
}

function refreshOverlaySvg() { updateSvgNow(); }

function applyPreviewMode(_showPreview) {
  // SVG y layer siempre visibles — el modo edición ES el render final
  const svgImg = $("#slide-overlay-svg");
  const layer  = $("#layer");
  if (svgImg) svgImg.style.display = "";
  if (layer)  layer.style.display  = "";
}

function selectSlide(id, showPreview = false) {
  // Si hay compose previo (modo resultado), navegar entre slides sigue mostrando -final.png
  if (state._composed && !showPreview) {
    showComposedResult(id);
    return;
  }
  // Salir del modo resultado al entrar explícitamente en edit/preview
  state._showResult = false;
  const dl = $("#btn-download");
  if (dl) dl.style.display = "none";

  state.currentSlideId = id;
  state.selected = null;
  state._showPreview = showPreview;
  hideFloatToolbar();

  // Si el slide tiene texto pero aún no tiene _pos definido,
  // obtener posiciones calculadas del compositor para WYSIWYG desde el primer render
  (async () => {
    const slideData  = state.overlayCopy.slides?.[id] || {};
    const overlayObj = slideData.overlay || {};
    const hasText = TEXT_KEYS.some(k => overlayObj[k]);
    const hasPos  = TEXT_KEYS.some(k => overlayObj[`${k}_pos`]);
    if (hasText && !hasPos && state.slug) {
      try {
        const r = await fetch(`/api/compute-positions?slug=${encodeURIComponent(state.slug)}&id=${encodeURIComponent(id)}`);
        const data = await r.json();
        if (data.computedPositions && Object.keys(data.computedPositions).length > 0) {
          if (!state.overlayCopy.slides) state.overlayCopy.slides = {};
          if (!state.overlayCopy.slides[id]) state.overlayCopy.slides[id] = {};
          if (!state.overlayCopy.slides[id].overlay) state.overlayCopy.slides[id].overlay = {};
          Object.assign(state.overlayCopy.slides[id].overlay, data.computedPositions);
          if (state.currentSlideId === id) renderElements();
        }
      } catch { /* silencioso */ }
    }
  })();

  renderSlideList();
  const result = state.manifest.results.find((r) => r.id === id);
  if (!result) return;

  // Detectar si el slide tiene PNG generado por IA (WaveSpeed/OpenAI)
  // vs fondo CSS/SVG editable (que tiene "style" o "baseColor" en bg params)
  const slideOc  = state.overlayCopy.slides?.[id];
  const bgParams = slideOc?.bg || {};
  const isCssBg  = "style" in bgParams || "baseColor" in bgParams;

  if (isCssBg) {
    // Fondo CSS/SVG generado en vivo — editable con params
    $("#slide-image").src = `/api/bg-svg?slug=${encodeURIComponent(state.slug)}&id=${encodeURIComponent(id)}&t=${Date.now()}`;
  } else {
    // PNG generado por IA — siempre usar el archivo principal (compose escribe a -final.png,
    // nunca sobreescribe el original)
    const filename = result.filename || (result.path ? result.path.split(/[\\/]/).pop() : null);
    if (filename) {
      $("#slide-image").src = `/slides/${state.slug}/${filename}?t=${Date.now()}`;
    } else {
      $("#slide-image").src = `/api/bg-svg?slug=${encodeURIComponent(state.slug)}&id=${encodeURIComponent(id)}&t=${Date.now()}`;
    }
  }

  // SVG overlay siempre visible — render en vivo del compositor
  applyPreviewMode(false);
  updateSvgNow();

  const idx = state.manifest.results.indexOf(result) + 1;
  $("#slide-indicator").textContent = `${idx} / ${state.manifest.results.length}`;
  const bgType = isCssBg ? "CSS/SVG" : "PNG";
  $("#canvas-meta").textContent = `${id} · ${bgType}`;
  renderElements(); renderProps(); renderLayers();
}

function slideDelta(delta) {
  if (!state.manifest) return;
  const results = state.manifest.results;
  const idx = results.findIndex(r => r.id === state.currentSlideId);
  const newIdx = Math.max(0, Math.min(results.length - 1, idx + delta));
  const newId  = results[newIdx].id;
  // En modo compose navegar muestra -final.png de cada slide
  if (state._composed) { showComposedResult(newId); return; }
  selectSlide(newId);
}

// ─── Background params helpers ─────────────────────────────────────────
function getSlideBg(id) {
  if (!state.overlayCopy.slides) state.overlayCopy.slides = {};
  if (!state.overlayCopy.slides[id]) state.overlayCopy.slides[id] = { overlay: { elements: [] } };
  if (!state.overlayCopy.slides[id].bg) state.overlayCopy.slides[id].bg = {};
  return state.overlayCopy.slides[id].bg;
}

function refreshBg() {
  if (!state.currentSlideId || state._showPreview) return;
  const slideOc  = state.overlayCopy.slides?.[state.currentSlideId];
  const bgParams = slideOc?.bg || {};
  const isCssBg  = "style" in bgParams || "baseColor" in bgParams;
  if (isCssBg) {
    $("#slide-image").src = `/api/bg-svg?slug=${encodeURIComponent(state.slug)}&id=${encodeURIComponent(state.currentSlideId)}&t=${Date.now()}`;
  }
  // Actualizar thumbnail del slide activo en la lista
  const li = $(`[data-id="${state.currentSlideId}"] img`);
  if (li) li.src = `${li.src.split("?")[0]}?t=${Date.now()}`;
}

// ─── Overlay data accessors ────────────────────────────────────────────
function ensureSlideData(id) {
  if (!state.overlayCopy.slides) state.overlayCopy.slides = {};
  if (!state.overlayCopy.slides[id]) state.overlayCopy.slides[id] = { overlay: { elements: [] } };
  if (!state.overlayCopy.slides[id].overlay) state.overlayCopy.slides[id].overlay = { elements: [] };
  if (!state.overlayCopy.slides[id].overlay.elements) state.overlayCopy.slides[id].overlay.elements = [];
  return state.overlayCopy.slides[id].overlay;
}

// ─── Render elements on canvas ─────────────────────────────────────────
const TEXT_KEYS = ["eyebrow", "headline", "subhead", "body", "signature", "microCopy"];

function autoHeadlineToken(text) {
  const w = (text || "").split(/\s+/).filter(Boolean).length;
  if (w <= 3) return TOKENS["display"];
  if (w <= 5) return TOKENS["display-sm"];
  if (w <= 8) return TOKENS["display-xs"];
  return TOKENS["heading"];
}

function tokenFor(textKey, text) {
  if (textKey === "eyebrow")    return TOKENS["label"];
  if (textKey === "headline")   return autoHeadlineToken(text);
  if (textKey === "subhead")    return TOKENS["display-sm"];
  if (textKey === "body")       return TOKENS["body"];
  if (textKey === "signature")  return TOKENS["signature"];
  if (textKey === "microCopy")  return TOKENS["micro"];
  return TOKENS["body"];
}

function renderElements() {
  const layer = $("#layer");
  layer.innerHTML = "";
  if (!state.currentSlideId) return;
  const overlay = ensureSlideData(state.currentSlideId);

  // Empty-state hint si no hay nada en el overlay
  const hasContent = TEXT_KEYS.some(k => overlay[k]) || (overlay.elements || []).length > 0;
  if (!hasContent) {
    const hint = document.createElement("div");
    hint.id = "canvas-empty-hint";
    hint.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;";
    hint.innerHTML = `<div style="text-align:center;background:rgba(0,0,0,0.55);padding:18px 24px;border-radius:8px;border:1px dashed rgba(212,175,55,0.4);color:#e8e8e8;font-size:13px;line-height:1.8;">
      <div style="color:#D4AF37;font-size:22px;margin-bottom:6px;">+</div>
      <b>Canvas vacío</b><br/>
      <span style="color:#8a8a8a;font-size:11px;">Usa la barra de herramientas:<br/>
      <b style="color:#e8e8e8;">T</b> Texto &nbsp;·&nbsp; <b style="color:#e8e8e8;">R</b> Rect &nbsp;·&nbsp; <b style="color:#e8e8e8;">S</b> Scrim &nbsp;·&nbsp; <b style="color:#e8e8e8;">I</b> Imagen<br/>
      <b style="color:#D4AF37;">F</b> Texto libre &nbsp;·&nbsp; <b style="color:#D4AF37;">C</b> Círculo &nbsp;·&nbsp; <b style="color:#D4AF37;">L</b> Línea<br/>
      <b style="color:#D4AF37;">N</b> Número &nbsp;·&nbsp; <b style="color:#D4AF37;">Q</b> Cita &nbsp;·&nbsp; <b style="color:#e8e8e8;">Ctrl+D</b> Duplicar</span>
    </div>`;
    layer.appendChild(hint);
  }

  const canvasRect = $("#canvas").getBoundingClientRect();
  // Color por defecto según colorScheme del slide
  const schemeColor = (overlay.colorScheme === "light") ? "#1A1A1A" : "#FFFFFF";

  TEXT_KEYS.forEach((key) => {
    if (overlay[key]) {
      const colorOverride = overlay[`${key}_color`] || schemeColor;
      const el = makeTextElement(key, overlay[key], overlay[`${key}_pos`], overlay[`${key}_font`], overlay[`${key}_size`], colorOverride, overlay[`${key}_align`], overlay[`${key}_tracking`], overlay[`${key}_weight`], overlay[`${key}_case`], canvasRect, overlay[`${key}_italic`]);
      layer.appendChild(el);
    }
  });

  (overlay.elements || []).forEach((e, idx) => {
    if (e.type === "block") layer.appendChild(makeBlockElement(e, idx));
    else if (e.type === "scrim") layer.appendChild(makeScrimElement(e, idx));
    else if (e.type === "logo" || e.type === "chip" || e.type === "image") layer.appendChild(makeLogoElement(e, idx));
    else if (e.type === "freetext") layer.appendChild(makeFreeTextElement(e, idx));
    else if (e.type === "circle")   layer.appendChild(makeCircleElement(e, idx));
    else if (e.type === "line")     layer.appendChild(makeLineElement(e, idx));
    else if (e.type === "numberbadge") layer.appendChild(makeNumberBadgeElement(e, idx));
    else if (e.type === "quote")    layer.appendChild(makeQuoteElement(e, idx));
    else if (e.type === "richtext") layer.appendChild(makeRichTextElement(e, idx));
  });

  // Reaplicar selección visual
  if (state.selected) {
    const el = findElementNode(state.selected);
    if (el) el.classList.add("selected");
  }
}

function findElementNode(sel) {
  if (sel.kind === "text") return $(`[data-text-key="${sel.key}"]`);
  return $(`[data-idx="${sel.key}"]`);
}

function makeTextElement(key, text, pos, fontOverride, sizeOverride, colorOverride, alignOverride, trackingOverride, weightOverride, caseOverride, canvasRect, italicOverride) {
  const div = document.createElement("div");
  div.className = `el el-text el-text-${key}`;
  div.dataset.kind = "text";
  div.dataset.textKey = key;

  const tok = tokenFor(key, text);
  const font = fontOverride || tok.font;
  const fontEntry = FONTS.find(f => f.name === font) || FONTS[0];
  const sizeRatio = sizeOverride ?? tok.scale;
  const fontSize = Math.round(canvasRect.width * sizeRatio);
  const color = colorOverride || "#FFFFFF";
  const resolved = resolveColor(color);
  const tx = trackingOverride ?? tok.tracking;
  const weight = weightOverride ?? tok.weight;
  const textTransform = (caseOverride ?? tok.case) === "upper" ? "uppercase" : "none";

  div.style.fontFamily = fontEntry.family;
  div.style.fontSize = `${fontSize}px`;
  div.style.fontWeight = weight;
  div.style.color = "transparent";   // ghost: SVG renderiza el texto
  div.dataset.editColor = resolved;  // guardado para el modo edición inline
  div.style.letterSpacing = `${tx}px`;
  div.style.lineHeight = tok.lineH;
  div.style.textTransform = textTransform;
  div.style.textAlign = alignOverride || "left";
  if (italicOverride) div.style.fontStyle = "italic";
  div.textContent = textTransform === "uppercase" ? text.toUpperCase() : text;

  const p = pos || defaultTextPos(key);
  div.style.left = `${p.x * 100}%`;
  div.style.top = `${p.y * 100}%`;
  div.style.maxWidth = `${(p.w ?? 0.88) * 100}%`;

  attachDrag(div, (newPos) => {
    const overlay = ensureSlideData(state.currentSlideId);
    overlay[`${key}_pos`] = { ...(overlay[`${key}_pos`] || { w: 0.88 }), x: newPos.x, y: newPos.y };
  });
  div.addEventListener("click", (e) => { e.stopPropagation(); selectElement({ kind: "text", key }); });
  div.addEventListener("dblclick", (e) => editTextInline(div, key));
  return div;
}

function defaultTextPos(key) {
  if (key === "eyebrow")   return { x: 0.06, y: 0.06, w: 0.88 };
  if (key === "headline")  return { x: 0.06, y: 0.14, w: 0.88 };
  if (key === "subhead")   return { x: 0.06, y: 0.32, w: 0.88 };
  if (key === "body")      return { x: 0.06, y: 0.68, w: 0.80 };
  if (key === "signature") return { x: 0.06, y: 0.88, w: 0.50 };
  if (key === "microCopy") return { x: 0.06, y: 0.94, w: 0.80 };
  return { x: 0.06, y: 0.06, w: 0.88 };
}

function resolveColor(token) {
  if (!token) return state.palette.white;
  const t = String(token).toLowerCase();
  if (t.startsWith("#")) return token;
  const map = {
    white: state.palette.white, primary: state.palette.primary, dark: state.palette.dark,
    gold: state.palette.dark, accent: state.palette.dark, light: state.palette.light,
    gray: state.palette.grayLight, "gray-dark": state.palette.grayDark, black: "#000000",
    terracotta: "#D97856",
  };
  return map[t] || state.palette.white;
}

function makeBlockElement(e, idx) {
  const div = document.createElement("div");
  div.className = "el el-block";
  div.dataset.kind = "element"; div.dataset.idx = idx; div.dataset.type = "block";
  div.style.width = `${(e.w ?? 0.3) * 100}%`;
  div.style.height = `${(e.h ?? 0.2) * 100}%`;
  div.style.left = `${(e.x ?? 0) * 100}%`;
  div.style.top = `${(e.y ?? 0) * 100}%`;
  div.style.opacity = e.opacity ?? 1;
  div.style.background = resolveColor(e.color || "primary");

  attachDrag(div, (p) => {
    state.overlayCopy.slides[state.currentSlideId].overlay.elements[idx].x = p.x;
    state.overlayCopy.slides[state.currentSlideId].overlay.elements[idx].y = p.y;
  });
  addResizeHandles(div, (size) => {
    const arr = state.overlayCopy.slides[state.currentSlideId].overlay.elements;
    arr[idx].w = size.w; arr[idx].h = size.h;
  });
  div.addEventListener("click", (ev) => { ev.stopPropagation(); selectElement({ kind: "element", key: idx }); });
  return div;
}

function makeScrimElement(e, idx) {
  const div = document.createElement("div");
  div.className = `el el-scrim-${e.position || "bottom"}`;
  div.dataset.kind = "element"; div.dataset.idx = idx; div.dataset.type = "scrim";
  const h = (e.height ?? 0.4) * 100;
  div.style.width = "100%"; div.style.left = "0";
  if (e.position === "top") { div.style.top = "0"; div.style.height = `${h}%`; }
  else if (e.position === "full") { div.style.top = "0"; div.style.height = "100%"; }
  else { div.style.top = `${100-h}%`; div.style.height = `${h}%`; }
  div.addEventListener("click", (ev) => { ev.stopPropagation(); selectElement({ kind: "element", key: idx }); });
  return div;
}

function makeLogoElement(e, idx) {
  const div = document.createElement("div");
  div.className = "el el-logo";
  div.dataset.kind = "element"; div.dataset.idx = idx; div.dataset.type = e.type || "logo";
  div.style.width = `${(e.scale ?? 0.20) * 100}%`;
  if (typeof e.x === "number" && typeof e.y === "number") {
    div.style.left = `${e.x * 100}%`; div.style.top = `${e.y * 100}%`;
  } else {
    const pad = 6;
    if (e.position === "top-left")    { div.style.left = `${pad}%`; div.style.top = `${pad}%`; }
    else if (e.position === "top-right") { div.style.right = `${pad}%`; div.style.top = `${pad}%`; }
    else if (e.position === "bottom-left") { div.style.left = `${pad}%`; div.style.bottom = `${pad}%`; }
    else { div.style.right = `${pad}%`; div.style.bottom = `${pad}%`; }
  }
  const img = document.createElement("img");
  const sub = e.sub || (e.asset?.startsWith("ac-") ? "logos" : "tools");
  const filename = e.file || `${e.asset}.png`;
  img.src = `/assets/${sub}/${filename}`;
  div.appendChild(img);

  attachDrag(div, (p) => {
    const arr = state.overlayCopy.slides[state.currentSlideId].overlay.elements;
    arr[idx].x = p.x; arr[idx].y = p.y; delete arr[idx].position;
  });
  addResizeHandles(div, (size) => {
    const arr = state.overlayCopy.slides[state.currentSlideId].overlay.elements;
    arr[idx].scale = Math.max(0.04, Math.min(1, size.w));
  }, "width-only");
  div.addEventListener("click", (ev) => { ev.stopPropagation(); selectElement({ kind: "element", key: idx }); });
  return div;
}

function makeFreeTextElement(e, idx) {
  const div = document.createElement("div");
  div.className = "el el-freetext";
  div.dataset.kind = "element"; div.dataset.idx = idx; div.dataset.type = "freetext";
  const canvasRect = $("#canvas").getBoundingClientRect();
  const fontEntry = FONTS.find(f => f.name === e.font) || FONTS.find(f => f.name === "Inter") || FONTS[0];
  const fontSize = Math.round(canvasRect.width * (e.size ?? 0.04));
  div.style.left = `${(e.x ?? 0.1) * 100}%`;
  div.style.top  = `${(e.y ?? 0.1) * 100}%`;
  div.style.maxWidth = `${(e.w ?? 0.8) * 100}%`;
  div.style.fontFamily = fontEntry.family;
  div.style.fontSize = `${fontSize}px`;
  div.style.fontWeight = e.weight ?? 400;
  div.style.color = resolveColor(e.color || "white");
  div.style.letterSpacing = `${e.tracking ?? 0}px`;
  div.style.lineHeight = e.lineH ?? 1.4;
  div.style.textTransform = e.uppercase ? "uppercase" : "none";
  div.style.textAlign = e.align ?? "left";
  div.style.opacity = e.opacity ?? 1;
  if (e.rotation) div.style.transform = `rotate(${e.rotation}deg)`;
  if (e.italic) div.style.fontStyle = "italic";
  if (e.textDecoration && e.textDecoration !== "none") div.style.textDecoration = e.textDecoration;
  if (e.shadow) div.style.textShadow = "2px 2px 8px rgba(0,0,0,0.8)";
  if (e.bg) {
    div.style.background = resolveColor(e.bg) + Math.round((e.bgOpacity ?? 0.7) * 255).toString(16).padStart(2,"0");
    div.style.padding = `2px ${e.bgPad ?? 4}px`;
    div.style.borderRadius = "3px";
  }
  div.textContent = e.uppercase ? (e.text || "Texto libre").toUpperCase() : (e.text || "Texto libre");
  attachDrag(div, (p) => {
    const arr = state.overlayCopy.slides[state.currentSlideId].overlay.elements;
    arr[idx].x = p.x; arr[idx].y = p.y;
  });
  addResizeHandles(div, (size) => {
    state.overlayCopy.slides[state.currentSlideId].overlay.elements[idx].w = size.w;
  }, "width-only");
  div.addEventListener("click", (ev) => { ev.stopPropagation(); selectElement({ kind: "element", key: idx }); });
  div.addEventListener("dblclick", () => editElementTextInline(div, idx, "text"));
  return div;
}

function makeCircleElement(e, idx) {
  const div = document.createElement("div");
  div.className = "el el-circle";
  div.dataset.kind = "element"; div.dataset.idx = idx; div.dataset.type = "circle";
  div.style.left = `${(e.x ?? 0.30) * 100}%`;
  div.style.top  = `${(e.y ?? 0.22) * 100}%`;
  div.style.width  = `${(e.w ?? 0.40) * 100}%`;
  div.style.height = `${(e.h ?? 0.32) * 100}%`;
  div.style.opacity = e.opacity ?? 1;
  div.style.border = `${e.strokeWidth ?? 2}px solid ${resolveColor(e.stroke || e.fill || "gold")}`;
  div.style.background = resolveColor(e.fill || "gold") + Math.round((e.fillOpacity ?? 0.12) * 255).toString(16).padStart(2,"0");
  attachDrag(div, (p) => {
    const arr = state.overlayCopy.slides[state.currentSlideId].overlay.elements;
    arr[idx].x = p.x; arr[idx].y = p.y;
  });
  addResizeHandles(div, (size) => {
    const arr = state.overlayCopy.slides[state.currentSlideId].overlay.elements;
    arr[idx].w = size.w; arr[idx].h = size.h;
  });
  div.addEventListener("click", (ev) => { ev.stopPropagation(); selectElement({ kind: "element", key: idx }); });
  return div;
}

function makeLineElement(e, idx) {
  const div = document.createElement("div");
  div.className = "el el-line";
  div.dataset.kind = "element"; div.dataset.idx = idx; div.dataset.type = "line";
  div.style.left = `${(e.x ?? 0.08) * 100}%`;
  div.style.top  = `${(e.y ?? 0.5) * 100}%`;
  div.style.width = `${(e.length ?? 0.84) * 100}%`;
  div.style.height = `${e.thickness ?? 2}px`;
  div.style.background = resolveColor(e.color || "gold");
  div.style.opacity = e.opacity ?? 0.8;
  if (e.angle) div.style.transform = `rotate(${e.angle}deg)`;
  attachDrag(div, (p) => {
    const arr = state.overlayCopy.slides[state.currentSlideId].overlay.elements;
    arr[idx].x = p.x; arr[idx].y = p.y;
  });
  addResizeHandles(div, (size) => {
    state.overlayCopy.slides[state.currentSlideId].overlay.elements[idx].length = size.w;
  }, "width-only");
  div.addEventListener("click", (ev) => { ev.stopPropagation(); selectElement({ kind: "element", key: idx }); });
  return div;
}

function makeNumberBadgeElement(e, idx) {
  const div = document.createElement("div");
  div.className = "el el-numberbadge";
  div.dataset.kind = "element"; div.dataset.idx = idx; div.dataset.type = "numberbadge";
  const canvasRect = $("#canvas").getBoundingClientRect();
  const fontSize = Math.round(canvasRect.width * (e.size ?? 0.13));
  div.style.left = `${(e.x ?? 0.08) * 100}%`;
  div.style.top  = `${(e.y ?? 0.08) * 100}%`;
  div.style.fontSize = `${fontSize}px`;
  div.style.color = resolveColor(e.color || "gold");
  div.style.opacity = e.opacity ?? 0.15;
  div.textContent = e.number ?? "01";
  attachDrag(div, (p) => {
    const arr = state.overlayCopy.slides[state.currentSlideId].overlay.elements;
    arr[idx].x = p.x; arr[idx].y = p.y;
  });
  div.addEventListener("click", (ev) => { ev.stopPropagation(); selectElement({ kind: "element", key: idx }); });
  return div;
}

function makeQuoteElement(e, idx) {
  const div = document.createElement("div");
  div.className = "el el-quote";
  div.dataset.kind = "element"; div.dataset.idx = idx; div.dataset.type = "quote";
  const canvasRect = $("#canvas").getBoundingClientRect();
  const fontEntry = FONTS.find(f => f.name === e.font) || FONTS.find(f => f.name === "Inter") || FONTS[0];
  const fontSize = Math.round(canvasRect.width * (e.size ?? 0.032));
  const barColor = resolveColor(e.barColor || "gold");
  div.style.left = `${(e.x ?? 0.10) * 100}%`;
  div.style.top  = `${(e.y ?? 0.40) * 100}%`;
  div.style.maxWidth = `${(e.w ?? 0.76) * 100}%`;
  div.style.fontFamily = fontEntry.family;
  div.style.fontSize = `${fontSize}px`;
  div.style.fontWeight = e.weight ?? 400;
  div.style.color = resolveColor(e.color || "white");
  div.style.lineHeight = e.lineH ?? 1.55;
  div.style.opacity = e.opacity ?? 1;
  div.style.borderLeft = `${e.barWidth ?? 3}px solid ${barColor}`;
  div.style.paddingLeft = "12px";
  div.textContent = e.text || "Cita aquí...";
  attachDrag(div, (p) => {
    const arr = state.overlayCopy.slides[state.currentSlideId].overlay.elements;
    arr[idx].x = p.x; arr[idx].y = p.y;
  });
  addResizeHandles(div, (size) => {
    state.overlayCopy.slides[state.currentSlideId].overlay.elements[idx].w = size.w;
  }, "width-only");
  div.addEventListener("click", (ev) => { ev.stopPropagation(); selectElement({ kind: "element", key: idx }); });
  div.addEventListener("dblclick", () => editElementTextInline(div, idx, "text"));
  return div;
}

function makeRichTextElement(e, idx) {
  const div = document.createElement("div");
  div.className = "el el-richtext";
  div.dataset.kind = "element"; div.dataset.idx = idx; div.dataset.type = "richtext";
  const canvasW = $("#canvas").getBoundingClientRect().width;
  div.style.left = `${(e.x ?? 0.08) * 100}%`;
  div.style.top  = `${(e.y ?? 0.20) * 100}%`;
  div.style.maxWidth = `${(e.w ?? 0.84) * 100}%`;
  div.style.opacity = e.opacity ?? 1;
  div.style.lineHeight = e.lineH ?? 1.5;

  // Construir runs via DOM API — sin innerHTML para evitar XSS
  (e.runs || []).forEach(r => {
    const fontEntry = FONTS.find(f => f.name === r.font) || FONTS[0];
    const fsPx = Math.round(canvasW * (r.size ?? 0.04));
    const col  = resolveColor(r.color || "white");
    const bgHex = r.bg ? resolveColor(r.bg) : "";
    const bgAlpha = bgHex ? Math.round((r.bgOpacity ?? 0.7) * 255).toString(16).padStart(2,"0") : "";
    // Split por líneas para preservar saltos de línea sin innerHTML
    const rawText = r.uppercase ? (r.text || "").toUpperCase() : (r.text || "");
    // Trim trailing empty segment produced by a trailing \n — it adds unwanted blank line
    const allSegs = rawText.split("\n");
    const segments = allSegs[allSegs.length - 1] === "" ? allSegs.slice(0, -1) : allSegs;
    segments.forEach((seg, si) => {
      const span = document.createElement("span");
      span.style.fontFamily  = fontEntry.family;
      span.style.fontSize    = `${fsPx}px`;
      span.style.fontWeight  = r.weight ?? 400;
      span.style.color       = col;
      span.style.letterSpacing = `${r.tracking ?? 0}px`;
      if (r.italic) span.style.fontStyle = "italic";
      if (r.textDecoration && r.textDecoration !== "none") span.style.textDecoration = r.textDecoration;
      if (bgHex) { span.style.background = `${bgHex}${bgAlpha}`; span.style.padding = `2px ${r.bgPad ?? 4}px`; span.style.borderRadius = "3px"; }
      span.textContent = seg;
      div.appendChild(span);
      if (si < segments.length - 1) div.appendChild(document.createElement("br"));
    });
  });

  attachDrag(div, (p) => {
    const arr = state.overlayCopy.slides[state.currentSlideId].overlay.elements;
    arr[idx].x = p.x; arr[idx].y = p.y;
  });
  addResizeHandles(div, (size) => {
    state.overlayCopy.slides[state.currentSlideId].overlay.elements[idx].w = size.w;
  }, "width-only");
  div.addEventListener("click", (ev) => { ev.stopPropagation(); selectElement({ kind: "element", key: idx }); });
  return div;
}

// ─── Drag & Resize ─────────────────────────────────────────────────────
function attachDrag(el, onMove) {
  el.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("resize-handle")) return;
    if (e.target.isContentEditable) return;
    e.preventDefault();
    const canvas = $("#canvas").getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startLeft = parseFloat(el.style.left) || 0;
    const startTop = parseFloat(el.style.top) || 0;
    const onMouseMove = (ev) => {
      const dx = ((ev.clientX - startX) / canvas.width) * 100;
      const dy = ((ev.clientY - startY) / canvas.height) * 100;
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      // Snapping: centro, bordes, safe zones (6% margen)
      const snaps = [0, 6, 25, 50, 75, 94, 100];
      for (const s of snaps) {
        if (Math.abs(newLeft - s) < 1.5) newLeft = s;
        if (Math.abs(newTop - s) < 1.5) newTop = s;
      }
      newLeft = Math.max(0, Math.min(95, newLeft));
      newTop = Math.max(0, Math.min(95, newTop));
      el.style.left = `${newLeft}%`;
      el.style.top = `${newTop}%`;
      onMove({ x: +(newLeft/100).toFixed(4), y: +(newTop/100).toFixed(4) });
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      pushHistory();
      renderProps();
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}

function addResizeHandles(el, onResize, mode) {
  const corners = ["se"]; // por ahora solo esquina inferior-derecha
  corners.forEach((c) => {
    const h = document.createElement("div");
    h.className = `resize-handle ${c}`;
    el.appendChild(h);
    h.addEventListener("mousedown", (e) => {
      e.preventDefault(); e.stopPropagation();
      const canvas = $("#canvas").getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const startW = parseFloat(el.style.width) || 50;
      const startH = parseFloat(el.style.height) || 20;
      const onMove = (ev) => {
        const dx = ((ev.clientX - startX) / canvas.width) * 100;
        const dy = ((ev.clientY - startY) / canvas.height) * 100;
        const newW = Math.max(3, Math.min(100, startW + dx));
        const newH = Math.max(2, Math.min(100, startH + dy));
        el.style.width = `${newW}%`;
        if (mode !== "width-only") el.style.height = `${newH}%`;
        onResize({ w: +(newW/100).toFixed(4), h: +(newH/100).toFixed(4) });
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        pushHistory();
        renderProps();
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  });
}

// ─── Inline text editing ───────────────────────────────────────────────
function editTextInline(div, key) {
  // Mostrar texto durante edición (color real visible sobre fondo oscuro semitransparente)
  div.classList.add("is-editing");
  div.style.color = div.dataset.editColor || "#ffffff";
  div.contentEditable = "true";
  div.focus();
  const range = document.createRange();
  range.selectNodeContents(div);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);
  const onBlur = () => {
    div.contentEditable = "false";
    div.classList.remove("is-editing");
    div.style.color = "transparent";
    const overlay = ensureSlideData(state.currentSlideId);
    overlay[key] = div.innerText;
    div.removeEventListener("blur", onBlur);
    pushHistory();
    renderLayers();
  };
  div.addEventListener("blur", onBlur);
}

// Edición inline de texto en elementos[] (freetext, quote)
function editElementTextInline(div, idx, prop) {
  div.classList.add("is-editing");
  div.contentEditable = "true";
  div.focus();
  const range = document.createRange();
  range.selectNodeContents(div);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);
  const onBlur = () => {
    div.contentEditable = "false";
    div.classList.remove("is-editing");
    const overlay = ensureSlideData(state.currentSlideId);
    overlay.elements[idx][prop] = div.innerText;
    div.removeEventListener("blur", onBlur);
    pushHistory();
    renderElements();
    renderLayers();
  };
  div.addEventListener("blur", onBlur);
}

// ─── Selection ─────────────────────────────────────────────────────────
function selectElement(sel) {
  state.selected = sel;
  $$(".el").forEach((n) => n.classList.remove("selected"));
  const node = findElementNode(sel);
  if (node) node.classList.add("selected");
  renderProps();
  renderLayers();
  if (sel?.kind === "text") {
    updateFloatToolbar(sel.key);
    positionFloatToolbar(node);
  } else {
    hideFloatToolbar();
  }
}

// ─── Background CSS/SVG panel ──────────────────────────────────────────
const BG_FIELDS = [
  { key: "base",      label: "Color base",    hint: "Color principal del fondo" },
  { key: "base2",     label: "Color 2°",      hint: "Extremo del gradiente o lado derecho" },
  { key: "accent",    label: "Acento",        hint: "Color de brillo / bokeh / shaft" },
];

function renderBgPanel(form) {
  const bg = getSlideBg(state.currentSlideId);
  const slideIdx = state.manifest.results.findIndex(r => r.id === state.currentSlideId);

  // Leer defaults del servidor (guardado en state._bgDefaults)
  const defaults = (state._bgDefaults || {})[slideIdx] || {};

  const styleLabel = document.createElement("div");
  styleLabel.style.cssText = "font-size:10px;color:var(--fg-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;";
  styleLabel.textContent = defaults.style || `slide-${String(slideIdx+1).padStart(2,"0")}`;
  form.appendChild(styleLabel);

  BG_FIELDS.forEach(({ key, label, hint }) => {
    const current = bg[key] || defaults[key] || "#D4AF37";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:10px;";
    row.innerHTML = `
      <input type="color" value="${current}" style="width:36px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:2px;background:var(--bg-input);" title="${hint}"/>
      <div style="flex:1;">
        <div style="font-size:11px;font-weight:600;">${label}</div>
        <input type="text" value="${current}" maxlength="7" style="font-family:monospace;font-size:11px;width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:3px;padding:2px 5px;color:var(--fg);"/>
      </div>`;
    const colorPicker = row.querySelector("input[type=color]");
    const textInput   = row.querySelector("input[type=text]");

    const applyColor = (val) => {
      if (!/^#[0-9a-fA-F]{6}$/.test(val)) return;
      bg[key] = val;
      colorPicker.value = val;
      textInput.value = val;
      pushHistory();
      refreshBg();
    };

    colorPicker.addEventListener("input",  (e) => applyColor(e.target.value));
    textInput.addEventListener("change",   (e) => applyColor(e.target.value));
    textInput.addEventListener("keydown",  (e) => { if (e.key === "Enter") applyColor(e.target.value); });
    form.appendChild(row);
  });

  // Intensity slider
  const intensity = bg.intensity ?? defaults.intensity ?? 0.5;
  const sliderRow = document.createElement("div");
  sliderRow.style.cssText = "margin-bottom:12px;";
  sliderRow.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;font-weight:600;">Intensidad del efecto</span>
      <span id="intensity-val" style="font-size:11px;color:var(--fg-muted);">${Math.round(intensity*100)}%</span>
    </div>
    <input type="range" min="0" max="1" step="0.01" value="${intensity}" style="width:100%;"/>`;
  const slider = sliderRow.querySelector("input[type=range]");
  const valLabel = sliderRow.querySelector("#intensity-val");
  slider.addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    bg.intensity = v;
    valLabel.textContent = `${Math.round(v*100)}%`;
    pushHistory();
    refreshBg();
  });
  form.appendChild(sliderRow);

  // Botón reset
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "↺ Restablecer defaults";
  resetBtn.style.cssText = "width:100%;margin-top:4px;padding:6px;font-size:11px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;cursor:pointer;color:var(--fg);";
  resetBtn.addEventListener("click", () => {
    state.overlayCopy.slides[state.currentSlideId].bg = {};
    pushHistory();
    refreshBg();
    renderProps();
  });
  form.appendChild(resetBtn);
}

// ─── Props panel ───────────────────────────────────────────────────────
function renderProps() {
  const empty = $("#props-empty");
  const form = $("#props-form");
  const overlay = ensureSlideData(state.currentSlideId);
  if (!state.selected) {
    // Panel de fondo CSS/SVG editable
    if (state.currentSlideId) {
      empty.style.display = "none";
      form.style.display = "flex";
      form.innerHTML = "";
      $("#props-title").textContent = "FONDO CSS";
      renderBgPanel(form);
    } else {
      empty.style.display = "block";
      form.style.display = "none";
      $("#props-title").textContent = "PROPIEDADES";
    }
    return;
  }
  empty.style.display = "none";
  form.style.display = "flex";
  form.innerHTML = "";

  if (state.selected.kind === "text") {
    const key = state.selected.key;
    $("#props-title").textContent = key.toUpperCase();

    // Content
    form.appendChild(group("Texto",
      propField("Contenido", "textarea", overlay[key] || "", (v) => {
        overlay[key] = v; renderElements();
      })
    ));

    // Typography
    const tokDef = tokenFor(key, overlay[key]);
    const fontCurrent = overlay[`${key}_font`] || tokDef.font;
    const fontSelect = propFontPicker("Fuente", fontCurrent, (v) => {
      overlay[`${key}_font`] = v; renderElements(); pushHistory();
      updateFloatToolbar(key);
    });
    const sizeCurrent = overlay[`${key}_size`] ?? tokDef.scale;
    const sizeSlider = propSizeSlider(key, sizeCurrent, overlay);
    const weightCurrent = overlay[`${key}_weight`] ?? tokDef.weight;
    const weightOpts = [300, 400, 500, 600, 700, 800, 900];
    const weightSelect = propSelect("Peso", weightOpts, weightCurrent, (v) => {
      overlay[`${key}_weight`] = +v; renderElements();
    });
    const typoGroup = group("Tipografía", fontSelect, sizeSlider, weightSelect);

    const trackCurrent = overlay[`${key}_tracking`] ?? tokDef.tracking;
    const trackField = propField("Letter spacing (px)", "number", trackCurrent, (v) => {
      overlay[`${key}_tracking`] = +v; renderElements();
    }, 0.5);
    typoGroup.appendChild(trackField);

    // Case
    const caseCurrent = overlay[`${key}_case`] ?? tokDef.case;
    const caseBtns = btnGroup("Caps", [{v:"normal",l:"Aa"},{v:"upper",l:"AA"}], caseCurrent, (v) => {
      overlay[`${key}_case`] = v; renderElements();
    });
    typoGroup.appendChild(caseBtns);

    // Color palette — default matches SVG renderer default per key
    const colorDefault = key === "body" || key === "microCopy" ? "gray" : key === "signature" ? "gold" : "white";
    const colorCurrent = overlay[`${key}_color`] || colorDefault;
    typoGroup.appendChild(propColorPalette(key, colorCurrent, overlay));

    // Align
    const alignCurrent = overlay[`${key}_align`] || "left";
    const alignBtns = btnGroup("Alinear", [{v:"left",l:"◧"},{v:"center",l:"▥"},{v:"right",l:"◨"}], alignCurrent, (v) => {
      overlay[`${key}_align`] = v; renderElements();
    });
    typoGroup.appendChild(alignBtns);

    typoGroup.appendChild(btnGroup("Italic", [{v:false,l:"Aa"},{v:true,l:"I"}], overlay[`${key}_italic`] ?? false, (v) => {
      overlay[`${key}_italic`] = v === "true" || v === true; renderElements(); scheduleSvgUpdate();
    }));
    typoGroup.appendChild(btnGroup("Sombra", [{v:false,l:"No"},{v:true,l:"Sí"}], overlay[`${key}_shadow`] ?? false, (v) => {
      overlay[`${key}_shadow`] = v === "true" || v === true; scheduleSvgUpdate();
    }));

    form.appendChild(typoGroup);

    // Position
    const posCurrent = overlay[`${key}_pos`] || defaultTextPos(key);
    const posGroup = group("Posición",
      row(
        propField("X", "number", posCurrent.x, (v) => { overlay[`${key}_pos`] = { ...overlay[`${key}_pos`], x: +v }; renderElements(); }, 0.01),
        propField("Y", "number", posCurrent.y, (v) => { overlay[`${key}_pos`] = { ...overlay[`${key}_pos`], y: +v }; renderElements(); }, 0.01),
      ),
      propField("Ancho (w)", "number", posCurrent.w ?? 0.88, (v) => { overlay[`${key}_pos`] = { ...overlay[`${key}_pos`], w: +v }; renderElements(); }, 0.01),
    );
    form.appendChild(posGroup);

    form.appendChild(propBgColorPalette(key, overlay));

    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete";
    delBtn.textContent = "🗑 Eliminar texto";
    delBtn.addEventListener("click", () => {
      delete overlay[key];
      delete overlay[`${key}_pos`]; delete overlay[`${key}_font`]; delete overlay[`${key}_size`];
      delete overlay[`${key}_color`]; delete overlay[`${key}_align`]; delete overlay[`${key}_tracking`];
      delete overlay[`${key}_weight`]; delete overlay[`${key}_case`];
      delete overlay[`${key}_italic`]; delete overlay[`${key}_shadow`];
      delete overlay[`${key}_bg`]; delete overlay[`${key}_bgOpacity`]; delete overlay[`${key}_bgPad`];
      delete overlay[`${key}_textDecoration`];
      state.selected = null;
      pushHistory();
      renderElements(); renderProps(); renderLayers();
    });
    form.appendChild(delBtn);

  } else if (state.selected.kind === "element") {
    const idx = state.selected.key;
    const e = overlay.elements[idx];
    if (!e) return;
    $("#props-title").textContent = `${e.type.toUpperCase()} · ${idx}`;

    if (e.type === "block") {
      form.appendChild(group("Dimensiones",
        row(
          propField("X", "number", e.x, (v) => { e.x = +v; renderElements(); }, 0.01),
          propField("Y", "number", e.y, (v) => { e.y = +v; renderElements(); }, 0.01),
        ),
        row(
          propField("W", "number", e.w, (v) => { e.w = +v; renderElements(); }, 0.01),
          propField("H", "number", e.h, (v) => { e.h = +v; renderElements(); }, 0.01),
        )
      ));
      const resolved = resolveColor(e.color || "primary");
      const cr = document.createElement("div");
      cr.className = "color-row";
      const cp = document.createElement("input");
      cp.type = "color"; cp.value = resolved;
      cp.addEventListener("input", () => { e.color = cp.value; renderElements(); });
      const ct = document.createElement("input");
      ct.type = "text"; ct.value = e.color || "primary";
      ct.addEventListener("change", () => { e.color = ct.value; renderElements(); });
      cr.appendChild(cp); cr.appendChild(ct);
      form.appendChild(group("Estilo",
        wrapLabel("Color", cr),
        propField("Opacity", "number", e.opacity ?? 1, (v) => { e.opacity = +v; renderElements(); }, 0.05),
      ));
    }
    if (e.type === "scrim") {
      form.appendChild(group("Scrim",
        propSelect("Posición", ["bottom","top","full"], e.position || "bottom", (v) => { e.position = v; renderElements(); }),
        propField("Altura (ratio)", "number", e.height ?? 0.4, (v) => { e.height = +v; renderElements(); }, 0.05),
      ));
    }
    if (e.type === "logo" || e.type === "chip" || e.type === "image") {
      form.appendChild(group("Logo / Imagen",
        propField("Asset", "text", e.asset || "", (v) => { e.asset = v; renderElements(); }),
        propSelect("Carpeta", ["logos","tools","uploads","mascots"], e.sub || "logos", (v) => { e.sub = v; renderElements(); }),
        propField("Scale (ancho ratio)", "number", e.scale ?? 0.20, (v) => { e.scale = +v; renderElements(); }, 0.02),
        row(
          propField("X", "number", e.x ?? 0.05, (v) => { e.x = +v; renderElements(); }, 0.01),
          propField("Y", "number", e.y ?? 0.05, (v) => { e.y = +v; renderElements(); }, 0.01),
        ),
      ));
    }

    if (e.type === "freetext") {
      // — Presets rápidos —
      const presetRow = document.createElement("div");
      presetRow.className = "preset-chips";
      Object.entries(STYLE_PRESETS).forEach(([name, preset]) => {
        const chip = document.createElement("button");
        chip.type = "button"; chip.className = "preset-chip"; chip.textContent = name;
        chip.addEventListener("click", () => {
          Object.assign(e, preset); renderElements(); pushHistory();
          renderProps();
        });
        presetRow.appendChild(chip);
      });
      form.appendChild(presetRow);

      const fontCurrent = e.font || "Inter";
      form.appendChild(group("Texto libre",
        propField("Contenido", "textarea", e.text || "", (v) => { e.text = v; renderElements(); }),
        propFontPicker("Fuente", fontCurrent, (v) => { e.font = v; renderElements(); pushHistory(); }),
        propSizeSliderEl(idx, "size", e.size ?? 0.04),
        propColorSwatchEl(idx, "color", e.color || "white"),
      ));
      form.appendChild(group("Estilo tipográfico",
        propField("Peso", "number", e.weight ?? 400, (v) => { e.weight = +v; renderElements(); }, 100),
        propField("Tracking (px)", "number", e.tracking ?? 0, (v) => { e.tracking = +v; renderElements(); }, 0.5),
        propField("Line-height", "number", e.lineH ?? 1.4, (v) => { e.lineH = +v; renderElements(); }, 0.05),
        btnGroup("Alinear", [{v:"left",l:"◧"},{v:"center",l:"▥"},{v:"right",l:"◨"}], e.align || "left", (v) => { e.align = v; renderElements(); }),
        btnGroup("Caps", [{v:false,l:"Aa"},{v:true,l:"AA"}], e.uppercase ?? false, (v) => { e.uppercase = v === "true" || v === true; renderElements(); }),
        btnGroup("Italic", [{v:false,l:"Aa"},{v:true,l:"I"}], e.italic ?? false, (v) => { e.italic = v === "true" || v === true; renderElements(); }),
        btnGroup("Decorado", [{v:"none",l:"—"},{v:"underline",l:"U̲"},{v:"line-through",l:"S̶"}], e.textDecoration || "none", (v) => { e.textDecoration = v; renderElements(); }),
        btnGroup("Sombra", [{v:false,l:"No"},{v:true,l:"Sí"}], e.shadow ?? false, (v) => { e.shadow = v === "true" || v === true; renderElements(); }),
        propField("Opacity", "number", e.opacity ?? 1, (v) => { e.opacity = +v; renderElements(); }, 0.05),
        propField("Rotación (°)", "number", e.rotation ?? 0, (v) => { e.rotation = +v; renderElements(); }, 1),
      ));
      form.appendChild(group("Fondo de texto (highlight)",
        propColorSwatchEl(idx, "bg", e.bg || "", "Color fondo"),
        propField("Opac. fondo", "number", e.bgOpacity ?? 0.7, (v) => { e.bgOpacity = +v; renderElements(); }, 0.05),
        propField("Padding (px)", "number", e.bgPad ?? 4, (v) => { e.bgPad = +v; renderElements(); }, 1),
      ));
      form.appendChild(group("Posición",
        row(
          propField("X", "number", e.x ?? 0.1, (v) => { e.x = +v; renderElements(); }, 0.01),
          propField("Y", "number", e.y ?? 0.1, (v) => { e.y = +v; renderElements(); }, 0.01),
        ),
        propField("Ancho (w)", "number", e.w ?? 0.8, (v) => { e.w = +v; renderElements(); }, 0.01),
      ));
    }

    if (e.type === "circle") {
      form.appendChild(group("Círculo / Elipse",
        row(
          propField("X", "number", e.x ?? 0.30, (v) => { e.x = +v; renderElements(); }, 0.01),
          propField("Y", "number", e.y ?? 0.22, (v) => { e.y = +v; renderElements(); }, 0.01),
        ),
        row(
          propField("Ancho (w)", "number", e.w ?? 0.40, (v) => { e.w = +v; renderElements(); }, 0.01),
          propField("Alto (h)", "number", e.h ?? 0.32, (v) => { e.h = +v; renderElements(); }, 0.01),
        ),
      ));
      form.appendChild(group("Estilo",
        propColorSwatchEl(idx, "fill", e.fill || "gold", "Relleno"),
        propField("Opacidad relleno", "number", e.fillOpacity ?? 0.12, (v) => { e.fillOpacity = +v; renderElements(); }, 0.05),
        propColorSwatchEl(idx, "stroke", e.stroke || "gold", "Borde"),
        propField("Grosor borde (px)", "number", e.strokeWidth ?? 2, (v) => { e.strokeWidth = +v; renderElements(); }, 1),
        propField("Opacity", "number", e.opacity ?? 1, (v) => { e.opacity = +v; renderElements(); }, 0.05),
      ));
    }

    if (e.type === "line") {
      form.appendChild(group("Línea",
        row(
          propField("X", "number", e.x ?? 0.08, (v) => { e.x = +v; renderElements(); }, 0.01),
          propField("Y", "number", e.y ?? 0.5, (v) => { e.y = +v; renderElements(); }, 0.01),
        ),
        propField("Largo (ratio ancho)", "number", e.length ?? 0.84, (v) => { e.length = +v; renderElements(); }, 0.01),
        propField("Grosor (px)", "number", e.thickness ?? 2, (v) => { e.thickness = +v; renderElements(); }, 1),
        propField("Ángulo (°)", "number", e.angle ?? 0, (v) => { e.angle = +v; renderElements(); }, 1),
        propColorSwatchEl(idx, "color", e.color || "gold"),
        propField("Opacity", "number", e.opacity ?? 0.8, (v) => { e.opacity = +v; renderElements(); }, 0.05),
      ));
    }

    if (e.type === "numberbadge") {
      form.appendChild(group("Número decorativo",
        propField("Número", "text", e.number ?? "01", (v) => { e.number = v; renderElements(); }),
        propSizeSliderEl(idx, "size", e.size ?? 0.13, 0.40),
        propColorSwatchEl(idx, "color", e.color || "gold"),
        propField("Opacity", "number", e.opacity ?? 0.15, (v) => { e.opacity = +v; renderElements(); }, 0.05),
        row(
          propField("X", "number", e.x ?? 0.08, (v) => { e.x = +v; renderElements(); }, 0.01),
          propField("Y", "number", e.y ?? 0.08, (v) => { e.y = +v; renderElements(); }, 0.01),
        ),
      ));
    }

    if (e.type === "quote") {
      const fontCurrent = e.font || "Inter";
      form.appendChild(group("Cita con barra",
        propField("Texto", "textarea", e.text || "", (v) => { e.text = v; renderElements(); }),
        propFontPicker("Fuente", fontCurrent, (v) => { e.font = v; renderElements(); pushHistory(); }),
        propSizeSliderEl(idx, "size", e.size ?? 0.032),
        propColorSwatchEl(idx, "color", e.color || "white", "Color texto"),
      ));
      form.appendChild(group("Barra lateral",
        propColorSwatchEl(idx, "barColor", e.barColor || "gold", "Color barra"),
        propField("Grosor barra (px)", "number", e.barWidth ?? 3, (v) => { e.barWidth = +v; renderElements(); }, 1),
      ));
      form.appendChild(group("Posición",
        row(
          propField("X", "number", e.x ?? 0.10, (v) => { e.x = +v; renderElements(); }, 0.01),
          propField("Y", "number", e.y ?? 0.40, (v) => { e.y = +v; renderElements(); }, 0.01),
        ),
        propField("Ancho (w)", "number", e.w ?? 0.76, (v) => { e.w = +v; renderElements(); }, 0.01),
        propField("Opacity", "number", e.opacity ?? 1, (v) => { e.opacity = +v; renderElements(); }, 0.05),
      ));
    }

    if (e.type === "richtext") {
      form.appendChild(group("Texto Rico — Posición",
        row(
          propField("X", "number", e.x ?? 0.08, (v) => { e.x = +v; renderElements(); }, 0.01),
          propField("Y", "number", e.y ?? 0.20, (v) => { e.y = +v; renderElements(); }, 0.01),
        ),
        propField("Ancho (w)", "number", e.w ?? 0.84, (v) => { e.w = +v; renderElements(); }, 0.01),
        propField("Line-height global", "number", e.lineH ?? 1.5, (v) => { e.lineH = +v; renderElements(); }, 0.05),
        propField("Opacity", "number", e.opacity ?? 1, (v) => { e.opacity = +v; renderElements(); }, 0.05),
      ));

      // Editor de runs
      const runs = e.runs || [];
      const runsContainer = document.createElement("div");
      runsContainer.className = "richtext-runs";

      function renderRunsList() {
        runsContainer.innerHTML = "";
        runs.forEach((r, ri) => {
          const runBlock = document.createElement("div");
          runBlock.className = "run-block";
          const runHeader = document.createElement("div");
          runHeader.className = "run-header";
          runHeader.innerHTML = `<span class="run-num">Run ${ri + 1}</span>`;
          const delRun = document.createElement("button");
          delRun.type = "button"; delRun.textContent = "🗑"; delRun.className = "run-del";
          delRun.addEventListener("click", () => { runs.splice(ri, 1); e.runs = runs; renderElements(); pushHistory(); renderRunsList(); });
          runHeader.appendChild(delRun);
          runBlock.appendChild(runHeader);

          // Textarea
          const ta = document.createElement("textarea");
          ta.rows = 2; ta.value = r.text || ""; ta.style.width="100%";
          ta.addEventListener("input", () => { r.text = ta.value; renderElements(); });
          ta.addEventListener("blur",  () => pushHistory());
          runBlock.appendChild(ta);

          // Font picker mini
          const fpWrap = propFontPicker("Fuente", r.font || "Inter", (v) => { r.font = v; renderElements(); pushHistory(); });
          runBlock.appendChild(fpWrap);

          // Size slider
          const canvasW = state.canvas?.offsetWidth || 540;
          const szSlider = document.createElement("div");
          const szLabel = document.createElement("label"); szLabel.textContent = "Tamaño";
          const szRow = document.createElement("div"); szRow.style.cssText = "display:grid;grid-template-columns:1fr 40px;gap:4px;align-items:center;";
          const szRange = document.createElement("input"); szRange.type="range"; szRange.min=0.01; szRange.max=0.20; szRange.step=0.002; szRange.value=r.size??0.04; szRange.className="size-range";
          const szPx = document.createElement("span"); szPx.className="size-px-label"; szPx.textContent=`${Math.round(canvasW*(r.size??0.04))}px`;
          szRange.addEventListener("input", () => { r.size=+szRange.value; szPx.textContent=`${Math.round(canvasW*r.size)}px`; renderElements(); scheduleSvgUpdate(); });
          szRange.addEventListener("change", () => pushHistory());
          szRow.appendChild(szRange); szRow.appendChild(szPx);
          szSlider.appendChild(szLabel); szSlider.appendChild(szRow);
          runBlock.appendChild(szSlider);

          // Color swatch
          const swatches = document.createElement("div");
          swatches.className = "color-swatches";
          COLOR_SWATCHES.forEach(({token, hex, label: cl}) => {
            const chip = document.createElement("button"); chip.type="button"; chip.className="color-chip"; chip.style.background=hex; chip.title=cl;
            if (r.color===token||r.color===hex) chip.classList.add("active");
            chip.addEventListener("click", () => { r.color=token; renderElements(); pushHistory(); chip.classList.add("active"); });
            swatches.appendChild(chip);
          });
          const swLabel = document.createElement("label"); swLabel.textContent = "Color";
          runBlock.appendChild(swLabel); runBlock.appendChild(swatches);

          // Style toggles
          const styleRow = document.createElement("div"); styleRow.style.cssText="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;";
          [
            ["B", () => { r.weight = r.weight >= 700 ? 400 : 700; renderElements(); pushHistory(); }],
            ["I", () => { r.italic = !r.italic; renderElements(); pushHistory(); }],
            ["U̲", () => { r.textDecoration = r.textDecoration==="underline" ? "none" : "underline"; renderElements(); pushHistory(); }],
            ["AA", () => { r.uppercase = !r.uppercase; renderElements(); pushHistory(); }],
          ].forEach(([label, fn]) => {
            const b = document.createElement("button"); b.type="button"; b.textContent=label; b.className="ft-btn"; b.style.cssText="height:24px;padding:0 6px;font-size:11px;";
            b.addEventListener("click", fn);
            styleRow.appendChild(b);
          });
          runBlock.appendChild(styleRow);

          // BG highlight
          const bgRow = document.createElement("div"); bgRow.style.cssText="display:flex;gap:6px;align-items:center;margin-top:4px;";
          const bgLabel = document.createElement("label"); bgLabel.textContent="Fondo:"; bgLabel.style.fontSize="10px";
          const bgPicker = document.createElement("input"); bgPicker.type="color"; bgPicker.value=resolveColor(r.bg||"white"); bgPicker.style.cssText="width:24px;height:24px;cursor:pointer;border-radius:4px;border:none;";
          const bgOpIn = document.createElement("input"); bgOpIn.type="number"; bgOpIn.min=0; bgOpIn.max=1; bgOpIn.step=0.05; bgOpIn.value=r.bgOpacity??0; bgOpIn.style.cssText="width:46px;";
          bgOpIn.placeholder="0=sin fondo";
          bgPicker.addEventListener("input", () => { r.bg=bgPicker.value; r.bgOpacity=+bgOpIn.value||0.7; renderElements(); scheduleSvgUpdate(); });
          bgOpIn.addEventListener("input", () => { r.bgOpacity=+bgOpIn.value; renderElements(); scheduleSvgUpdate(); });
          bgPicker.addEventListener("change", () => pushHistory());
          bgOpIn.addEventListener("blur", () => pushHistory());
          bgRow.appendChild(bgLabel); bgRow.appendChild(bgPicker); bgRow.appendChild(bgOpIn);
          runBlock.appendChild(bgRow);

          // Gap after run (espaciado entre bloques)
          const gapRow = document.createElement("div"); gapRow.style.cssText="display:flex;gap:6px;align-items:center;margin-top:4px;";
          const gapLabel = document.createElement("label"); gapLabel.textContent="Gap tras run:"; gapLabel.style.fontSize="10px";
          const gapIn = document.createElement("input"); gapIn.type="number"; gapIn.min=0; gapIn.max=0.1; gapIn.step=0.005; gapIn.value=r.gapAfter??0; gapIn.style.cssText="width:54px;"; gapIn.title="Espacio entre este run y el siguiente (ratio de alto)";
          gapIn.addEventListener("input", () => { r.gapAfter=+gapIn.value; renderElements(); scheduleSvgUpdate(); });
          gapIn.addEventListener("blur", () => pushHistory());
          gapRow.appendChild(gapLabel); gapRow.appendChild(gapIn);
          runBlock.appendChild(gapRow);

          runsContainer.appendChild(runBlock);
        });

        // Botón añadir run
        const addRun = document.createElement("button");
        addRun.type = "button"; addRun.textContent = "+ Añadir run"; addRun.className = "btn-add-run";
        addRun.addEventListener("click", () => {
          runs.push({ text: "Nuevo run", font: "Inter", size: 0.04, weight: 400, color: "white", tracking: 0, italic: false, textDecoration: "none" });
          e.runs = runs; renderElements(); pushHistory(); renderRunsList();
        });
        runsContainer.appendChild(addRun);
      }
      renderRunsList();
      form.appendChild(runsContainer);
    }

    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete";
    delBtn.textContent = "🗑 Eliminar elemento";
    delBtn.addEventListener("click", () => {
      overlay.elements.splice(idx, 1);
      state.selected = null;
      pushHistory();
      renderElements(); renderProps(); renderLayers();
    });
    form.appendChild(delBtn);
  }
}

function group(label, ...children) {
  const g = document.createElement("div");
  g.className = "group";
  const l = document.createElement("div");
  l.className = "group-label"; l.textContent = label;
  g.appendChild(l);
  children.forEach(c => c && g.appendChild(c));
  return g;
}
function row(...children) {
  const r = document.createElement("div");
  r.className = "row";
  children.forEach(c => c && r.appendChild(c));
  return r;
}
function wrapLabel(label, inputEl) {
  const w = document.createElement("div");
  const l = document.createElement("label"); l.textContent = label;
  w.appendChild(l); w.appendChild(inputEl);
  return w;
}
function propField(label, type, value, onChange, step) {
  const w = document.createElement("div");
  const l = document.createElement("label"); l.textContent = label;
  let i;
  if (type === "textarea") { i = document.createElement("textarea"); i.value = value || ""; }
  else { i = document.createElement("input"); i.type = type; i.value = value ?? ""; if (step) i.step = step; }
  i.addEventListener("input", () => { onChange(i.value); scheduleSvgUpdate(); });
  i.addEventListener("blur",  () => pushHistory());
  w.appendChild(l); w.appendChild(i);
  return w;
}
function propSelect(label, options, value, onChange) {
  const w = document.createElement("div");
  const l = document.createElement("label"); l.textContent = label;
  const s = document.createElement("select");
  options.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o; opt.textContent = o;
    if (String(o) === String(value)) opt.selected = true;
    s.appendChild(opt);
  });
  s.addEventListener("change", () => { onChange(s.value); pushHistory(); });
  w.appendChild(l); w.appendChild(s);
  return w;
}
function propFontPicker(label, currentFontName, onChange) {
  const w = document.createElement("div");
  w.className = "font-picker-wrap";
  const l = document.createElement("label"); l.textContent = label;
  w.appendChild(l);

  const currentFont = FONTS.find(f => f.name === currentFontName) || FONTS[0];
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "font-picker-trigger";
  trigger.style.fontFamily = currentFont.family;
  trigger.innerHTML = `<span class="fp-preview">Aa Bb Cc</span><span class="fp-name">${currentFont.name}</span><span class="fp-caret">▾</span>`;

  const dropdown = document.createElement("div");
  dropdown.className = "font-picker-dropdown";
  dropdown.style.display = "none";

  // Search input dentro del dropdown
  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Buscar fuente...";
  search.className = "font-picker-search";
  dropdown.appendChild(search);

  // Lista
  const list = document.createElement("ul");
  list.className = "font-picker-list";
  dropdown.appendChild(list);

  function renderList(filter = "") {
    list.innerHTML = "";
    const f = filter.toLowerCase();
    FONTS.filter(fn => !f || fn.name.toLowerCase().includes(f)).forEach((font) => {
      const li = document.createElement("li");
      li.style.fontFamily = font.family;
      li.innerHTML = `<span class="fp-sample">Aa Bb Cc 123</span><span class="fp-meta">${font.name} · ${font.category}</span>`;
      if (font.name === currentFontName) li.classList.add("active");
      li.addEventListener("click", (e) => {
        e.stopPropagation();
        currentFontName = font.name;
        trigger.style.fontFamily = font.family;
        $(".fp-name", trigger).textContent = font.name;
        onChange(font.name);
        dropdown.style.display = "none";
        renderList(search.value);
      });
      list.appendChild(li);
    });
  }
  renderList();

  search.addEventListener("input", (e) => renderList(e.target.value));
  search.addEventListener("click", (e) => e.stopPropagation());

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display === "block";
    // Cerrar otros dropdowns abiertos
    $$(".font-picker-dropdown").forEach(d => d.style.display = "none");
    dropdown.style.display = isOpen ? "none" : "block";
    if (!isOpen) setTimeout(() => search.focus(), 50);
  });

  // Cerrar al click fuera
  document.addEventListener("click", () => dropdown.style.display = "none");
  dropdown.addEventListener("click", (e) => e.stopPropagation());

  w.appendChild(trigger);
  w.appendChild(dropdown);
  return w;
}

// ─── propSizeSlider ────────────────────────────────────────────────────
function propSizeSlider(key, sizeCurrent, overlay) {
  const canvasW = state.canvas?.offsetWidth || 540;
  const w = document.createElement("div");
  const l = document.createElement("label"); l.textContent = "Tamaño";
  const row = document.createElement("div");
  row.style.cssText = "display:grid;grid-template-columns:1fr 44px;gap:6px;align-items:center;";
  const range = document.createElement("input");
  range.type = "range"; range.min = 0.01; range.max = 0.20; range.step = 0.002;
  range.value = sizeCurrent;
  range.className = "size-range";
  const px = document.createElement("span");
  px.className = "size-px-label";
  px.textContent = `${Math.round(canvasW * sizeCurrent)}px`;
  range.addEventListener("input", () => {
    const v = +range.value;
    overlay[`${key}_size`] = v;
    px.textContent = `${Math.round(canvasW * v)}px`;
    renderElements();
    scheduleSvgUpdate();
  });
  range.addEventListener("blur",   () => pushHistory());
  range.addEventListener("change", () => pushHistory());
  row.appendChild(range); row.appendChild(px);
  w.appendChild(l); w.appendChild(row);
  return w;
}

// ─── propColorPalette ──────────────────────────────────────────────────
const COLOR_SWATCHES = [
  { token: "white",      hex: "#FFFFFF", label: "Blanco" },
  { token: "gold",       hex: "#D4AF37", label: "Dorado" },
  { token: "gray",       hex: "#BDBCBC", label: "Gris"   },
  { token: "black",      hex: "#050505", label: "Negro"  },
  { token: "terracotta", hex: "#D97856", label: "Terrac" },
];
function propColorPalette(key, colorCurrent, overlay) {
  const w = document.createElement("div");
  const l = document.createElement("label"); l.textContent = "Color";
  const swatchRow = document.createElement("div");
  swatchRow.className = "color-swatches";

  // Hidden native color picker for custom
  const hiddenPicker = document.createElement("input");
  hiddenPicker.type = "color";
  hiddenPicker.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none;";
  hiddenPicker.value = resolveColor(colorCurrent);

  let activeChip = null;
  function setActive(chip) {
    if (activeChip) activeChip.classList.remove("active");
    activeChip = chip;
    if (chip) chip.classList.add("active");
  }

  COLOR_SWATCHES.forEach(({ token, hex, label }) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "color-chip";
    chip.title = label;
    chip.style.background = hex;
    if (colorCurrent === token || colorCurrent === hex) setActive(chip);
    chip.addEventListener("click", () => {
      overlay[`${key}_color`] = token;
      renderElements(); pushHistory();
      setActive(chip);
      hiddenPicker.value = hex;
    });
    swatchRow.appendChild(chip);
  });

  // Custom chip
  const customChip = document.createElement("button");
  customChip.type = "button";
  customChip.className = "color-chip color-chip-custom";
  customChip.title = "Color personalizado";
  const isCustom = !COLOR_SWATCHES.find(s => s.token === colorCurrent || s.hex === colorCurrent);
  if (isCustom) {
    customChip.style.background = resolveColor(colorCurrent);
    setActive(customChip);
  }
  customChip.innerHTML = `<span style="font-size:14px;line-height:1">+</span>`;
  customChip.addEventListener("click", () => hiddenPicker.click());

  hiddenPicker.addEventListener("input", () => {
    overlay[`${key}_color`] = hiddenPicker.value;
    customChip.style.background = hiddenPicker.value;
    renderElements(); scheduleSvgUpdate();
    setActive(customChip);
  });
  hiddenPicker.addEventListener("change", () => pushHistory());

  swatchRow.appendChild(customChip);
  swatchRow.appendChild(hiddenPicker);
  w.appendChild(l); w.appendChild(swatchRow);
  return w;
}

// ─── Clipboard (Ctrl+C / Ctrl+V / Ctrl+D) ─────────────────────────────
let _clipboard = null;

// ─── propSizeSliderEl — slider de tamaño para elementos[] ────────────
function propSizeSliderEl(idx, propKey, sizeCurrent, maxVal = 0.30) {
  const canvasW = state.canvas?.offsetWidth || 540;
  const w = document.createElement("div");
  const l = document.createElement("label"); l.textContent = "Tamaño";
  const rowEl = document.createElement("div");
  rowEl.style.cssText = "display:grid;grid-template-columns:1fr 44px;gap:6px;align-items:center;";
  const range = document.createElement("input");
  range.type = "range"; range.min = 0.01; range.max = maxVal; range.step = 0.002;
  range.value = sizeCurrent; range.className = "size-range";
  const px = document.createElement("span");
  px.className = "size-px-label";
  px.textContent = `${Math.round(canvasW * sizeCurrent)}px`;
  range.addEventListener("input", () => {
    const v = +range.value;
    state.overlayCopy.slides[state.currentSlideId].overlay.elements[idx][propKey] = v;
    px.textContent = `${Math.round(canvasW * v)}px`;
    renderElements(); scheduleSvgUpdate();
  });
  range.addEventListener("change", () => pushHistory());
  rowEl.appendChild(range); rowEl.appendChild(px);
  w.appendChild(l); w.appendChild(rowEl);
  return w;
}

// ─── propColorSwatchEl — paleta de color para elementos[] ────────────
function propColorSwatchEl(idx, propKey, colorCurrent, label = "Color") {
  const w = document.createElement("div");
  const l = document.createElement("label"); l.textContent = label;
  const swatchRow = document.createElement("div");
  swatchRow.className = "color-swatches";
  const hiddenPicker = document.createElement("input");
  hiddenPicker.type = "color";
  hiddenPicker.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none;";
  hiddenPicker.value = resolveColor(colorCurrent);

  let activeChip = null;
  function setActive(chip) {
    if (activeChip) activeChip.classList.remove("active");
    activeChip = chip; if (chip) chip.classList.add("active");
  }

  COLOR_SWATCHES.forEach(({ token, hex, label: chipLabel }) => {
    const chip = document.createElement("button");
    chip.type = "button"; chip.className = "color-chip"; chip.title = chipLabel;
    chip.style.background = hex;
    if (colorCurrent === token || colorCurrent === hex) setActive(chip);
    chip.addEventListener("click", () => {
      state.overlayCopy.slides[state.currentSlideId].overlay.elements[idx][propKey] = token;
      renderElements(); pushHistory(); setActive(chip); hiddenPicker.value = hex;
    });
    swatchRow.appendChild(chip);
  });

  const customChip = document.createElement("button");
  customChip.type = "button"; customChip.className = "color-chip color-chip-custom"; customChip.title = "Color personalizado";
  const isCustom = !COLOR_SWATCHES.find(s => s.token === colorCurrent || s.hex === colorCurrent);
  if (isCustom) { customChip.style.background = resolveColor(colorCurrent); setActive(customChip); }
  customChip.innerHTML = `<span style="font-size:14px;line-height:1">+</span>`;
  customChip.addEventListener("click", () => hiddenPicker.click());
  hiddenPicker.addEventListener("input", () => {
    state.overlayCopy.slides[state.currentSlideId].overlay.elements[idx][propKey] = hiddenPicker.value;
    customChip.style.background = hiddenPicker.value;
    renderElements(); scheduleSvgUpdate(); setActive(customChip);
  });
  hiddenPicker.addEventListener("change", () => pushHistory());
  swatchRow.appendChild(customChip); swatchRow.appendChild(hiddenPicker);
  w.appendChild(l); w.appendChild(swatchRow);
  return w;
}

// ─── propBgColorPalette — paleta de fondo para overlay text keys ──────
function propBgColorPalette(key, overlay) {
  const w = document.createElement("div");
  w.className = "group";
  const l = document.createElement("div");
  l.className = "group-label"; l.textContent = "Fondo de texto (highlight)";
  w.appendChild(l);

  const bgCurrent = overlay[`${key}_bg`] || "";
  const swatchRow = document.createElement("div");
  swatchRow.className = "color-swatches";

  const hiddenPicker = document.createElement("input");
  hiddenPicker.type = "color";
  hiddenPicker.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none;";
  hiddenPicker.value = bgCurrent ? resolveColor(bgCurrent) : "#D4AF37";

  let activeChip = null;
  function setActive(chip) {
    if (activeChip) activeChip.classList.remove("active");
    activeChip = chip; if (chip) chip.classList.add("active");
  }

  // Chip "sin fondo"
  const noneChip = document.createElement("button");
  noneChip.type = "button"; noneChip.className = "color-chip"; noneChip.title = "Sin fondo";
  noneChip.style.cssText = "background:#1a1a1a;border:1px dashed #555;font-size:10px;color:#888;";
  noneChip.textContent = "✕";
  if (!bgCurrent) setActive(noneChip);
  noneChip.addEventListener("click", () => {
    delete overlay[`${key}_bg`]; renderElements(); scheduleSvgUpdate(); pushHistory(); setActive(noneChip);
  });
  swatchRow.appendChild(noneChip);

  COLOR_SWATCHES.forEach(({ token, hex, label }) => {
    const chip = document.createElement("button");
    chip.type = "button"; chip.className = "color-chip"; chip.title = label;
    chip.style.background = hex;
    if (bgCurrent === token || bgCurrent === hex) setActive(chip);
    chip.addEventListener("click", () => {
      overlay[`${key}_bg`] = token; renderElements(); scheduleSvgUpdate(); pushHistory();
      setActive(chip); hiddenPicker.value = hex;
    });
    swatchRow.appendChild(chip);
  });

  const customChip = document.createElement("button");
  customChip.type = "button"; customChip.className = "color-chip color-chip-custom"; customChip.title = "Color personalizado";
  const isCustom = bgCurrent && !COLOR_SWATCHES.find(s => s.token === bgCurrent || s.hex === bgCurrent);
  if (isCustom) { customChip.style.background = resolveColor(bgCurrent); setActive(customChip); }
  customChip.innerHTML = `<span style="font-size:14px;line-height:1">+</span>`;
  customChip.addEventListener("click", () => hiddenPicker.click());
  hiddenPicker.addEventListener("input", () => {
    overlay[`${key}_bg`] = hiddenPicker.value;
    customChip.style.background = hiddenPicker.value;
    renderElements(); scheduleSvgUpdate(); setActive(customChip);
  });
  hiddenPicker.addEventListener("change", () => pushHistory());

  swatchRow.appendChild(customChip); swatchRow.appendChild(hiddenPicker);
  w.appendChild(swatchRow);
  w.appendChild(propField("Opacidad fondo", "number", overlay[`${key}_bgOpacity`] ?? 0.7, (v) => {
    overlay[`${key}_bgOpacity`] = +v; scheduleSvgUpdate();
  }, 0.05));
  w.appendChild(propField("Padding (px)", "number", overlay[`${key}_bgPad`] ?? 4, (v) => {
    overlay[`${key}_bgPad`] = +v; scheduleSvgUpdate();
  }, 1));
  return w;
}

// ─── Floating mini-toolbar (Canva style) ───────────────────────────────
let _floatKey = null;  // current text key being edited in float toolbar

function initFloatToolbar() {
  if ($("#float-toolbar")) return;
  const bar = document.createElement("div");
  bar.id = "float-toolbar";

  // Font mini select
  const ftFont = document.createElement("select");
  ftFont.id = "ft-font";
  ftFont.className = "ft-font-select";
  FONTS.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.name; opt.textContent = f.name;
    ftFont.appendChild(opt);
  });
  ftFont.addEventListener("change", () => {
    if (!_floatKey) return;
    const ov = ensureSlideData(state.currentSlideId);
    ov[`${_floatKey}_font`] = ftFont.value;
    renderElements(); pushHistory();
  });

  // Size controls
  const ftSizeDec = document.createElement("button");
  ftSizeDec.type = "button"; ftSizeDec.textContent = "−"; ftSizeDec.className = "ft-btn";
  const ftSizeVal = document.createElement("input");
  ftSizeVal.type = "number"; ftSizeVal.step = 1; ftSizeVal.className = "ft-size-input";
  ftSizeVal.title = "Tamaño (px)";
  const ftSizeInc = document.createElement("button");
  ftSizeInc.type = "button"; ftSizeInc.textContent = "+"; ftSizeInc.className = "ft-btn";

  const canvasW = () => state.canvas?.offsetWidth || 540;
  ftSizeDec.addEventListener("click", () => {
    if (!_floatKey) return;
    const ov = ensureSlideData(state.currentSlideId);
    const tok = tokenFor(_floatKey, ov[_floatKey]);
    const cur = ov[`${_floatKey}_size`] ?? tok.scale;
    ov[`${_floatKey}_size`] = Math.max(0.01, +(cur - 0.004).toFixed(4));
    ftSizeVal.value = Math.round(canvasW() * ov[`${_floatKey}_size`]);
    renderElements(); pushHistory();
  });
  ftSizeInc.addEventListener("click", () => {
    if (!_floatKey) return;
    const ov = ensureSlideData(state.currentSlideId);
    const tok = tokenFor(_floatKey, ov[_floatKey]);
    const cur = ov[`${_floatKey}_size`] ?? tok.scale;
    ov[`${_floatKey}_size`] = Math.min(0.20, +(cur + 0.004).toFixed(4));
    ftSizeVal.value = Math.round(canvasW() * ov[`${_floatKey}_size`]);
    renderElements(); pushHistory();
  });
  ftSizeVal.addEventListener("change", () => {
    if (!_floatKey) return;
    const ov = ensureSlideData(state.currentSlideId);
    const ratio = +(+ftSizeVal.value / canvasW()).toFixed(4);
    ov[`${_floatKey}_size`] = Math.min(0.20, Math.max(0.01, ratio));
    renderElements(); pushHistory();
  });

  // Bold toggle
  const ftBold = document.createElement("button");
  ftBold.type = "button"; ftBold.textContent = "B"; ftBold.className = "ft-btn ft-bold";
  ftBold.title = "Negrita";
  ftBold.addEventListener("click", () => {
    if (!_floatKey) return;
    const ov = ensureSlideData(state.currentSlideId);
    const tok = tokenFor(_floatKey, ov[_floatKey]);
    const cur = ov[`${_floatKey}_weight`] ?? tok.weight;
    ov[`${_floatKey}_weight`] = cur >= 700 ? (tok.weight < 700 ? tok.weight : 400) : 700;
    ftBold.classList.toggle("active", ov[`${_floatKey}_weight`] >= 700);
    renderElements(); pushHistory();
  });

  // Align buttons
  const aligns = [{v:"left",l:"◧"},{v:"center",l:"▥"},{v:"right",l:"◨"}];
  const ftAlignBtns = aligns.map(({v,l}) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = l; b.className = "ft-btn"; b.dataset.align = v;
    b.title = `Alinear ${v}`;
    b.addEventListener("click", () => {
      if (!_floatKey) return;
      const ov = ensureSlideData(state.currentSlideId);
      ov[`${_floatKey}_align`] = v;
      ftAlignBtns.forEach(ab => ab.classList.toggle("active", ab.dataset.align === v));
      renderElements(); pushHistory();
    });
    return b;
  });

  // Color swatch
  const ftColorInput = document.createElement("input");
  ftColorInput.type = "color";
  ftColorInput.className = "ft-color-swatch";
  ftColorInput.title = "Color de texto";
  ftColorInput.addEventListener("input", () => {
    if (!_floatKey) return;
    const ov = ensureSlideData(state.currentSlideId);
    ov[`${_floatKey}_color`] = ftColorInput.value;
    renderElements(); scheduleSvgUpdate();
  });
  ftColorInput.addEventListener("change", () => pushHistory());

  // Italic toggle
  const ftItalic = document.createElement("button");
  ftItalic.type = "button"; ftItalic.textContent = "I"; ftItalic.className = "ft-btn ft-italic";
  ftItalic.style.fontStyle = "italic"; ftItalic.title = "Cursiva";
  ftItalic.addEventListener("click", () => {
    if (!_floatKey) return;
    const ov = ensureSlideData(state.currentSlideId);
    ov[`${_floatKey}_italic`] = !ov[`${_floatKey}_italic`];
    ftItalic.classList.toggle("active", !!ov[`${_floatKey}_italic`]);
    renderElements(); pushHistory();
  });

  // Underline toggle
  const ftUnderline = document.createElement("button");
  ftUnderline.type = "button"; ftUnderline.textContent = "U"; ftUnderline.className = "ft-btn ft-underline";
  ftUnderline.style.textDecoration = "underline"; ftUnderline.title = "Subrayar";
  ftUnderline.addEventListener("click", () => {
    if (!_floatKey) return;
    const ov = ensureSlideData(state.currentSlideId);
    const cur = ov[`${_floatKey}_textDecoration`] || "none";
    ov[`${_floatKey}_textDecoration`] = cur === "underline" ? "none" : "underline";
    ftUnderline.classList.toggle("active", ov[`${_floatKey}_textDecoration`] === "underline");
    renderElements(); pushHistory();
  });

  // Assemble
  const sep = () => { const s = document.createElement("span"); s.className = "ft-sep"; return s; };
  bar.appendChild(ftFont);
  bar.appendChild(sep());
  bar.appendChild(ftSizeDec);
  bar.appendChild(ftSizeVal);
  bar.appendChild(ftSizeInc);
  bar.appendChild(sep());
  bar.appendChild(ftBold);
  bar.appendChild(ftItalic);
  bar.appendChild(ftUnderline);
  bar.appendChild(sep());
  ftAlignBtns.forEach(b => bar.appendChild(b));
  bar.appendChild(sep());
  bar.appendChild(ftColorInput);

  // Stop propagation so clicks don't deselect the element
  bar.addEventListener("mousedown", e => e.stopPropagation());
  bar.addEventListener("click",     e => e.stopPropagation());

  const canvas = $("#canvas");
  if (canvas) canvas.appendChild(bar);
}

function updateFloatToolbar(key) {
  const bar = $("#float-toolbar");
  if (!bar) return;
  _floatKey = key;
  const ov  = ensureSlideData(state.currentSlideId);
  const tok = tokenFor(key, ov[key]);
  const canvasW = state.canvas?.offsetWidth || 540;

  const ftFont = $("#ft-font", bar);
  if (ftFont) ftFont.value = ov[`${key}_font`] || tok.font;

  const ftSizeVal = bar.querySelector(".ft-size-input");
  if (ftSizeVal) {
    const ratio = ov[`${key}_size`] ?? tok.scale;
    ftSizeVal.value = Math.round(canvasW * ratio);
  }

  const ftBold = bar.querySelector(".ft-bold");
  if (ftBold) {
    const w = ov[`${key}_weight`] ?? tok.weight;
    ftBold.classList.toggle("active", w >= 700);
  }

  const ftItalic = bar.querySelector(".ft-italic");
  if (ftItalic) ftItalic.classList.toggle("active", !!ov[`${key}_italic`]);

  const ftUnderline = bar.querySelector(".ft-underline");
  if (ftUnderline) ftUnderline.classList.toggle("active", (ov[`${key}_textDecoration`] || "none") === "underline");

  const align = ov[`${key}_align`] || "left";
  bar.querySelectorAll("[data-align]").forEach(b => {
    b.classList.toggle("active", b.dataset.align === align);
  });

  const ftColor = bar.querySelector(".ft-color-swatch");
  if (ftColor) ftColor.value = resolveColor(ov[`${key}_color`] || "white");
}

function positionFloatToolbar(textEl) {
  const bar = $("#float-toolbar");
  if (!bar || !textEl) return;
  const canvasEl = $("#canvas");
  if (!canvasEl) return;
  const cRect = canvasEl.getBoundingClientRect();
  const eRect = textEl.getBoundingClientRect();
  const left = Math.max(4, eRect.left - cRect.left);
  const top  = eRect.top - cRect.top;
  bar.style.left = `${left}px`;
  bar.style.top  = `${top}px`;
  bar.classList.add("visible");
}

function hideFloatToolbar() {
  const bar = $("#float-toolbar");
  if (bar) { bar.classList.remove("visible"); }
  _floatKey = null;
}

function btnGroup(label, options, value, onChange) {
  const w = document.createElement("div");
  const l = document.createElement("label"); l.textContent = label;
  const g = document.createElement("div"); g.className = "btn-group";
  options.forEach(o => {
    const b = document.createElement("button");
    b.textContent = o.l; b.dataset.v = o.v;
    if (o.v === value) b.classList.add("active");
    b.addEventListener("click", () => {
      [...g.children].forEach(c => c.classList.remove("active"));
      b.classList.add("active");
      onChange(o.v);
      pushHistory();
    });
    g.appendChild(b);
  });
  w.appendChild(l); w.appendChild(g);
  return w;
}

// ─── Layers panel ──────────────────────────────────────────────────────
function renderLayers() {
  const ul = $("#layer-list");
  ul.innerHTML = "";
  if (!state.currentSlideId) return;
  const overlay = ensureSlideData(state.currentSlideId);

  TEXT_KEYS.forEach((key) => {
    if (overlay[key]) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="layer-type">T</span><span class="layer-preview">${(overlay[key] || "").slice(0, 30)}</span>`;
      li.addEventListener("click", () => selectElement({ kind: "text", key }));
      if (state.selected?.kind === "text" && state.selected.key === key) li.classList.add("selected");
      ul.appendChild(li);
    }
  });
  const LAYER_ICONS = { block:"▮", scrim:"▨", logo:"🖼", chip:"🏷", image:"🖼", freetext:"F", circle:"●", line:"╱", numberbadge:"#", quote:"❝", richtext:"Aa+" };
  (overlay.elements || []).forEach((e, idx) => {
    const li = document.createElement("li");
    const icon = LAYER_ICONS[e.type] || e.type.slice(0,3).toUpperCase();
    const preview = e.type === "richtext"
      ? (e.runs?.[0]?.text || "richtext").toString().slice(0, 28)
      : (e.text || e.number || e.asset || e.color || e.position || "—");
    li.innerHTML = `<span class="layer-type">${icon}</span><span class="layer-preview">${preview.toString().slice(0,28)}</span>`;
    li.addEventListener("click", () => selectElement({ kind: "element", key: idx }));
    if (state.selected?.kind === "element" && state.selected.key === idx) li.classList.add("selected");
    ul.appendChild(li);
  });
}

// ─── Add elements via toolbar ──────────────────────────────────────────
function addTextOfType() {
  const overlay = ensureSlideData(state.currentSlideId);
  const empty = TEXT_KEYS.find(k => !overlay[k]);
  const key = empty || "headline";
  overlay[key] = overlay[key] || `Nuevo ${key}`;
  pushHistory();
  renderElements(); renderLayers();
  selectElement({ kind: "text", key });
}

function addBlock() {
  const overlay = ensureSlideData(state.currentSlideId);
  const idx = overlay.elements.length;
  overlay.elements.push({ type: "block", x: 0.1, y: 0.3, w: 0.4, h: 0.25, color: "primary", opacity: 1 });
  pushHistory();
  renderElements(); renderLayers();
  selectElement({ kind: "element", key: idx });
}

function addScrim() {
  const overlay = ensureSlideData(state.currentSlideId);
  const idx = overlay.elements.length;
  overlay.elements.push({ type: "scrim", position: "bottom", height: 0.30, color: "#050505" });
  pushHistory();
  renderElements(); renderLayers();
  selectElement({ kind: "element", key: idx });
}

function addLogoElement(asset) {
  if (!state.currentSlideId) return status("Selecciona un slide primero", "error");
  const overlay = ensureSlideData(state.currentSlideId);
  const idx = overlay.elements.length;
  overlay.elements.push({
    type: "logo",
    asset: asset.name,
    file: asset.file,   // nombre con extensión real (.jpg, .png, .svg…)
    sub: asset.sub,
    x: 0.05, y: 0.05, scale: 0.20
  });
  pushHistory();
  renderElements(); renderLayers();
  selectElement({ kind: "element", key: idx });
  status(`Añadido: ${asset.name}`, "success");
}

function addFreeText() {
  const overlay = ensureSlideData(state.currentSlideId);
  const idx = overlay.elements.length;
  overlay.elements.push({ type: "freetext", text: "Texto libre", font: "Inter", size: 0.040, weight: 400, color: "white", tracking: 0, lineH: 1.4, uppercase: false, align: "left", x: 0.10, y: 0.20, w: 0.80, opacity: 1 });
  pushHistory(); renderElements(); renderLayers();
  selectElement({ kind: "element", key: idx });
}

function addCircle() {
  const overlay = ensureSlideData(state.currentSlideId);
  const idx = overlay.elements.length;
  // w=0.40, h=0.32 produce un círculo visual en canvas 4:5 (540×675px)
  overlay.elements.push({ type: "circle", x: 0.30, y: 0.22, w: 0.40, h: 0.32, fill: "gold", fillOpacity: 0.12, stroke: "gold", strokeWidth: 2, opacity: 1 });
  pushHistory(); renderElements(); renderLayers();
  selectElement({ kind: "element", key: idx });
}

function addLine() {
  const overlay = ensureSlideData(state.currentSlideId);
  const idx = overlay.elements.length;
  overlay.elements.push({ type: "line", x: 0.08, y: 0.50, length: 0.84, angle: 0, color: "gold", thickness: 2, opacity: 0.8 });
  pushHistory(); renderElements(); renderLayers();
  selectElement({ kind: "element", key: idx });
}

function addNumberBadge() {
  const overlay = ensureSlideData(state.currentSlideId);
  const idx = overlay.elements.length;
  overlay.elements.push({ type: "numberbadge", number: "01", font: "Anton", size: 0.13, color: "gold", x: 0.06, y: 0.06, opacity: 0.15 });
  pushHistory(); renderElements(); renderLayers();
  selectElement({ kind: "element", key: idx });
}

function addQuote() {
  const overlay = ensureSlideData(state.currentSlideId);
  const idx = overlay.elements.length;
  overlay.elements.push({ type: "quote", text: "Cita aquí...", font: "Inter", size: 0.032, weight: 400, color: "white", barColor: "gold", barWidth: 3, x: 0.10, y: 0.40, w: 0.76, lineH: 1.55, opacity: 1 });
  pushHistory(); renderElements(); renderLayers();
  selectElement({ kind: "element", key: idx });
}

function addRichText() {
  const overlay = ensureSlideData(state.currentSlideId);
  const idx = overlay.elements.length;
  overlay.elements.push({
    type: "richtext", x: 0.08, y: 0.20, w: 0.84, lineH: 1.5, opacity: 1,
    runs: [
      { text: "TÍTULO\n", font: "Bebas Neue", size: 0.08, weight: 400, color: "gold", tracking: -1, uppercase: true, italic: false, textDecoration: "none" },
      { text: "Cuerpo de texto aquí.", font: "Inter", size: 0.032, weight: 400, color: "white", tracking: 0, uppercase: false, italic: false, textDecoration: "none" },
    ]
  });
  pushHistory(); renderElements(); renderLayers();
  selectElement({ kind: "element", key: idx });
}

// ─── Tool selection ────────────────────────────────────────────────────
function setTool(tool) {
  state.tool = tool;
  $$(".tool-rail .tool").forEach(b => b.classList.remove("active"));
  const btn = $(`.tool-rail .tool[data-tool="${tool}"]`);
  if (btn) btn.classList.add("active");

  if (tool === "text") addTextOfType();
  else if (tool === "block") addBlock();
  else if (tool === "scrim") addScrim();
  else if (tool === "image") $(".tabs .tab[data-tab='assets']").click();
  else if (tool === "freetext") addFreeText();
  else if (tool === "circle") addCircle();
  else if (tool === "line") addLine();
  else if (tool === "number") addNumberBadge();
  else if (tool === "quote") addQuote();
  else if (tool === "richtext") addRichText();
}

// ─── Zoom ──────────────────────────────────────────────────────────────
function setZoom(z) {
  state.zoom = Math.max(0.25, Math.min(2, z));
  $("#canvas").style.transform = `scale(${state.zoom})`;
  $("#zoom-value").textContent = `${Math.round(state.zoom * 100)}%`;
}

// ─── Align ─────────────────────────────────────────────────────────────
function alignSelected(dir) {
  if (!state.selected) return;
  const overlay = ensureSlideData(state.currentSlideId);
  if (state.selected.kind === "text") {
    overlay[`${state.selected.key}_align`] = dir;
  } else {
    const e = overlay.elements[state.selected.key];
    if (e.type === "block" || e.type === "logo") {
      const w = e.w ?? e.scale ?? 0.2;
      if (dir === "left") e.x = 0.06;
      else if (dir === "center") e.x = (1 - w) / 2;
      else if (dir === "right") e.x = 1 - w - 0.06;
    }
  }
  pushHistory();
  renderElements();
}

// ─── Save / Compose ────────────────────────────────────────────────────
async function save() {
  if (!state.slug) return;
  await api("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: state.slug, overlayCopy: state.overlayCopy, layoutPlan: state.layoutPlan })
  });
  status("Guardado ✓", "success");
  // Refrescar overlay SVG para que el preview WYSIWYG refleje los cambios
  refreshOverlaySvg();
}

async function compose() {
  if (!state.slug) return;
  const btn = $("#btn-compose");
  btn.disabled = true;
  btn.textContent = "⏳ Guardando...";
  status("Guardando cambios antes de componer...");
  // Guardar siempre antes de componer para que _pos editados lleguen al compositor
  await save();
  btn.textContent = "⏳ Componiendo...";
  status("Componiendo...");
  try {
    const r = await api("/api/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: state.slug })
    });
    if (r.code === 0) {
      status("✅ Compose OK — navega entre slides para ver y descargar", "success");
      state._composed = true;
      showComposedResult(state.currentSlideId);
    } else {
      status("Compose falló · revisa consola", "error");
      console.error(r.stderr);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "▶ Compose";
  }
}

// ─── Keyboard ──────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.target.isContentEditable || ["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
  const meta = e.ctrlKey || e.metaKey;
  if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
  else if (meta && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); }
  else if (meta && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  else if (meta && e.key.toLowerCase() === "d") {
    e.preventDefault();
    if (state.selected?.kind === "element") {
      const overlay = ensureSlideData(state.currentSlideId);
      const original = overlay.elements[state.selected.key];
      if (!original) return;
      const copy = clone(original);
      copy.x = +(((copy.x ?? 0.1) + 0.03)).toFixed(4);
      copy.y = +(((copy.y ?? 0.1) + 0.03)).toFixed(4);
      const newIdx = overlay.elements.length;
      overlay.elements.push(copy);
      pushHistory(); renderElements(); renderLayers();
      selectElement({ kind: "element", key: newIdx });
      status("Duplicado ✓");
    }
  }
  else if (meta && e.key.toLowerCase() === "c") {
    if (state.selected) {
      const overlay = ensureSlideData(state.currentSlideId);
      if (state.selected.kind === "element") {
        _clipboard = { kind: "element", data: clone(overlay.elements[state.selected.key]) };
      } else if (state.selected.kind === "text") {
        const key = state.selected.key;
        const snap = {};
        snap[key] = overlay[key];
        ["font","size","color","align","tracking","weight","case","pos"].forEach(p => {
          if (overlay[`${key}_${p}`] != null) snap[`${key}_${p}`] = overlay[`${key}_${p}`];
        });
        _clipboard = { kind: "text", key, data: clone(snap) };
      }
      status("Copiado ✓");
    }
  }
  else if (meta && e.key.toLowerCase() === "v") {
    if (_clipboard && state.currentSlideId) {
      const overlay = ensureSlideData(state.currentSlideId);
      if (_clipboard.kind === "element") {
        const copy = clone(_clipboard.data);
        copy.x = +(((copy.x ?? 0.1) + 0.03)).toFixed(4);
        copy.y = +(((copy.y ?? 0.1) + 0.03)).toFixed(4);
        const newIdx = overlay.elements.length;
        overlay.elements.push(copy);
        pushHistory(); renderElements(); renderLayers();
        selectElement({ kind: "element", key: newIdx });
      } else if (_clipboard.kind === "text") {
        const key = _clipboard.key;
        const empty = TEXT_KEYS.find(k => !overlay[k] && k !== key) || key;
        overlay[empty] = _clipboard.data[key] || "Texto copiado";
        ["font","size","color","align","tracking","weight","case","pos"].forEach(p => {
          if (_clipboard.data[`${key}_${p}`] != null)
            overlay[`${empty}_${p}`] = _clipboard.data[`${key}_${p}`];
        });
        pushHistory(); renderElements(); renderLayers();
        selectElement({ kind: "text", key: empty });
      }
      status("Pegado ✓");
    }
  }
  else if (e.key === "Delete" || e.key === "Backspace") {
    if (state.selected) {
      const overlay = ensureSlideData(state.currentSlideId);
      if (state.selected.kind === "text") {
        const key = state.selected.key;
        delete overlay[key];
        ["font","size","color","align","tracking","weight","case","pos"].forEach(p => delete overlay[`${key}_${p}`]);
      } else {
        overlay.elements.splice(state.selected.key, 1);
      }
      state.selected = null;
      pushHistory();
      renderElements(); renderProps(); renderLayers();
    }
  }
  else if (e.key === "v" || e.key === "V") setTool("select");
  else if (e.key === "t" || e.key === "T") setTool("text");
  else if (e.key === "r" || e.key === "R") setTool("block");
  else if (e.key === "s" || e.key === "S") setTool("scrim");
  else if (e.key === "i" || e.key === "I") setTool("image");
  else if (e.key === "f" || e.key === "F") setTool("freetext");
  else if (e.key === "c" || e.key === "C") setTool("circle");
  else if (e.key === "l" || e.key === "L") setTool("line");
  else if (e.key === "n" || e.key === "N") setTool("number");
  else if (e.key === "q" || e.key === "Q") setTool("quote");
  else if (e.key === "x" || e.key === "X") setTool("richtext");
  else if (e.key === "ArrowLeft") slideDelta(-1);
  else if (e.key === "ArrowRight") slideDelta(1);
});

// ─── Drop files en el canvas ───────────────────────────────────────────
function setupDropzone() {
  const dz = $("#upload-dropzone");
  const input = $("#upload-input");
  dz.addEventListener("click", () => input.click());
  input.addEventListener("change", (e) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
  });
  ["dragover","dragenter"].forEach(ev => {
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("active"); });
  });
  ["dragleave","drop"].forEach(ev => {
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("active"); });
  });
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  });

  // Drop en canvas: desde explorer o desde el asset grid
  const canvas = $("#canvas");
  canvas.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
  canvas.addEventListener("drop", async (e) => {
    e.preventDefault();
    const assetData = e.dataTransfer.getData("application/x-asset");
    if (assetData) {
      const asset = JSON.parse(assetData);
      const canvasRect = canvas.getBoundingClientRect();
      const x = (e.clientX - canvasRect.left) / canvasRect.width;
      const y = (e.clientY - canvasRect.top) / canvasRect.height;
      const overlay = ensureSlideData(state.currentSlideId);
      const idx = overlay.elements.length;
      overlay.elements.push({ type: "logo", asset: asset.name, file: asset.file, sub: asset.sub, x: +x.toFixed(4), y: +y.toFixed(4), scale: 0.20 });
      pushHistory();
      renderElements(); renderLayers();
      selectElement({ kind: "element", key: idx });
      return;
    }
    if (e.dataTransfer.files?.length) {
      await uploadFiles(e.dataTransfer.files);
    }
  });
}

// ─── Init ──────────────────────────────────────────────────────────────
function init() {
  state.canvas = $("#canvas");

  // Tabs
  $$(".tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tabs .tab").forEach(t => t.classList.remove("active"));
      $$(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      $(`.tab-content[data-tab-content="${tab.dataset.tab}"]`).classList.add("active");
    });
  });

  // Toolbar
  $$(".tool-rail .tool[data-tool]").forEach(btn => {
    btn.addEventListener("click", () => setTool(btn.dataset.tool));
  });
  $("#btn-align-left").addEventListener("click", () => alignSelected("left"));
  $("#btn-align-center").addEventListener("click", () => alignSelected("center"));
  $("#btn-align-right").addEventListener("click", () => alignSelected("right"));

  // Zoom
  $("#zoom-in").addEventListener("click", () => setZoom(state.zoom + 0.1));
  $("#zoom-out").addEventListener("click", () => setZoom(state.zoom - 0.1));
  $("#zoom-fit").addEventListener("click", () => setZoom(1));

  // Header buttons
  $("#btn-undo").addEventListener("click", undo);
  $("#btn-redo").addEventListener("click", redo);
  $("#btn-save").addEventListener("click", save);
  $("#btn-compose").addEventListener("click", compose);

  // Slide nav
  $("#slide-prev").addEventListener("click", () => slideDelta(-1));
  $("#slide-next").addEventListener("click", () => slideDelta(1));
  $("#btn-preview-toggle").addEventListener("click", () => {
    if (!state.currentSlideId) return;
    // Desde modo resultado (después de compose) → volver a modo edición en vivo
    if (state._composed) {
      state._composed = false;
      selectSlide(state.currentSlideId, false);
    }
  });

  // Carousel select
  $("#carousel-select").addEventListener("change", (e) => loadCarousel(e.target.value));

  // Canvas click deselects
  $("#canvas-wrap").addEventListener("click", (e) => {
    if (e.target.id === "canvas-wrap" || e.target.id === "canvas-outer" || e.target.id === "canvas") {
      state.selected = null;
      $$(".el").forEach(n => n.classList.remove("selected"));
      hideFloatToolbar();
      renderProps(); renderLayers();
    }
  });

  // Font search + categoría + preview text
  $("#font-search").addEventListener("input", (e) => { _fontFilter = e.target.value; renderFontList(); });
  $$(".font-cat").forEach((b) => {
    b.addEventListener("click", () => {
      $$(".font-cat").forEach(c => c.classList.remove("active"));
      b.classList.add("active");
      _fontCat = b.dataset.cat;
      renderFontList();
    });
  });
  $("#font-preview-text").addEventListener("input", () => renderFontList());

  // Library tabs (Simple Icons / Iconify)
  $$(".lib-tab").forEach((b) => {
    b.addEventListener("click", () => {
      $$(".lib-tab").forEach(c => c.classList.remove("active"));
      b.classList.add("active");
      _libMode = b.dataset.lib;
      libSearch($("#lib-search").value);
    });
  });
  $("#lib-search").addEventListener("input", (e) => {
    clearTimeout(_libSearchTimer);
    _libSearchTimer = setTimeout(() => libSearch(e.target.value), 280);
  });
  // Color sync
  const libColor = $("#lib-color");
  const libColorText = $("#lib-color-text");
  libColor.addEventListener("input", () => {
    libColorText.value = libColor.value.replace("#","").toUpperCase();
    libSearch($("#lib-search").value);
  });
  libColorText.addEventListener("change", () => {
    const v = libColorText.value.replace("#","");
    if (/^[a-f0-9]{6}$/i.test(v)) { libColor.value = "#" + v; libSearch($("#lib-search").value); }
  });

  // AI generate + detección automática de plataformas mientras se escribe
  $("#ai-generate-btn").addEventListener("click", aiGenerate);
  let _aiPromptTimer;
  $("#ai-prompt").addEventListener("input", (e) => {
    clearTimeout(_aiPromptTimer);
    _aiPromptTimer = setTimeout(() => detectAndRenderPlatforms(e.target.value.trim()), 500);
  });

  setupDropzone();
  renderFontList();
  loadBrandConfig();
  loadCarousels();
  loadAssets();
  initFloatToolbar();
}

document.addEventListener("DOMContentLoaded", init);
