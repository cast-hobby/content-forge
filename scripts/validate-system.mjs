#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_AGENTS = [
  "content-forge-brief-architect",
  "content-forge-researcher",
  "content-forge-layout-architect",
  "content-forge-character-director",
  "content-forge-copy-overlay",
  "content-forge-visual-qa",
  "content-forge-text-validator",
  "content-forge-caption-writer",
  "content-forge-calendar-publisher",
  "content-forge-clone-analyzer",
];

// Acepta tanto las keys del schema v1 (fonts/content.cadence) como el canónico v2 (typography/cadence)
const REQUIRED_BRAND_KEYS = ["brand", "colors", "logo", "voice", "character", "hashtags"];

let passed = 0;
let failed = 0;

function ok(msg)   { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); passed++; }
function fail(msg) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); failed++; }

console.log("\n\x1b[1mContent Forge v2.0 — Validación del sistema\x1b[0m\n");

// brand.config.json
const brandPath = resolve(ROOT, "brand.config.json");
if (existsSync(brandPath)) {
  try {
    const config = JSON.parse(await readFile(brandPath, "utf-8"));
    const missing = REQUIRED_BRAND_KEYS.filter(k => !(k in config));
    const hasTypo = ("typography" in config) || ("fonts" in config);
    const hasCadence = ("cadence" in config) || ("content" in config && "cadence" in config.content);
    const hasPlatforms = ("platforms" in config) || ("content" in config && "defaultPlatform" in config.content);
    if (missing.length === 0 && hasTypo && hasCadence && hasPlatforms)
      ok("brand.config.json válido (todas las keys presentes)");
    else {
      const issues = [...missing];
      if (!hasTypo) issues.push("typography / fonts");
      if (!hasCadence) issues.push("cadence");
      if (!hasPlatforms) issues.push("platforms");
      fail(`brand.config.json falta: ${issues.join(", ")}`);
    }
  } catch { fail("brand.config.json — error de parse JSON"); }
} else {
  fail("brand.config.json no encontrado — corre: npm run setup");
}

// memory.json
const memPath = resolve(ROOT, "memory.json");
if (existsSync(memPath)) {
  try {
    JSON.parse(await readFile(memPath, "utf-8"));
    ok("memory.json presente y válido");
  } catch { fail("memory.json tiene error de sintaxis JSON"); }
} else {
  fail("memory.json no encontrado — copia memory.json.template");
}

// .env.local
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  const env = await readFile(envPath, "utf-8");
  const hasWaveSpeed = env.includes("WAVESPEED_API_KEY=");
  const hasOpenAI    = env.includes("OPENAI_API_KEY=");
  const hasGemini    = env.includes("GEMINI_API_KEY=");
  if (hasWaveSpeed) ok(".env.local — WAVESPEED_API_KEY configurada (proveedor primario)");
  else if (hasOpenAI) ok(".env.local — OPENAI_API_KEY configurada (fallback activo)");
  else fail(".env.local — sin WAVESPEED_API_KEY ni OPENAI_API_KEY");
  if (hasGemini) ok(".env.local — GEMINI_API_KEY configurada (character swap activo)");
  else console.log(`  \x1b[33m⚠\x1b[0m .env.local — GEMINI_API_KEY ausente (Fase B desactivada)`);
} else {
  fail(".env.local no encontrado — corre: npm run setup");
}

// brand-assets/ structure
const assetsDir = resolve(ROOT, "brand-assets");
if (existsSync(assetsDir)) {
  const entries = await readdir(assetsDir);
  if (entries.length > 0) ok("brand-assets/ estructura OK");
  else fail("brand-assets/ vacío");
} else {
  fail("brand-assets/ no encontrado");
}

// Sub-agentes
const agentsDir = resolve(ROOT, ".claude/agents");
if (existsSync(agentsDir)) {
  const agentFiles = await readdir(agentsDir);
  const present = REQUIRED_AGENTS.filter(a => agentFiles.includes(`${a}.md`));
  const missing  = REQUIRED_AGENTS.filter(a => !agentFiles.includes(`${a}.md`));
  if (missing.length === 0) ok(`Sub-agentes cargados (${present.length}/${REQUIRED_AGENTS.length})`);
  else fail(`Sub-agentes faltantes (${present.length}/${REQUIRED_AGENTS.length}): ${missing.join(", ")}`);
} else {
  fail(".claude/agents/ no encontrado");
}

// Editor server file
if (existsSync(resolve(ROOT, "tools/overlay-editor/server.mjs")))
  ok("Editor server configurado (tools/overlay-editor/server.mjs)");
else
  fail("tools/overlay-editor/server.mjs no encontrado");

// Master Prompt
const promptPath  = resolve(ROOT, ".claude/system-prompt.md");
const promptPath2 = resolve(ROOT, ".claude/system-prompts/v2.0.md");
if (existsSync(promptPath) || existsSync(promptPath2))
  ok("Master Prompt v2.0 activo");
else
  fail("Master Prompt no encontrado (.claude/system-prompt.md)");

// Resultado final
console.log(`\n${"─".repeat(50)}`);
if (failed === 0) {
  console.log(`\x1b[32m\x1b[1m  Sistema listo para producción ✓\x1b[0m  (${passed}/${passed + failed} checks)\n`);
} else {
  console.log(`\x1b[33m\x1b[1m  ${passed} OK · ${failed} problema(s) a resolver\x1b[0m\n`);
  process.exitCode = 1;
}
