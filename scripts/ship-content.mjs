#!/usr/bin/env node
// ship-content.mjs — Orquestador end-to-end de Content Forge.
//
// Pipeline de 8 etapas:
//   1. Brief architect   → drafts/YYYYMMDD-<slug>-brief.json         (sub-agente)
//   2. Generate PNGs base + character refs                             (generate-social.mjs)
//   3. Visual QA         → qa-report.json                             (sub-agente)
//   3.5. Layout analysis → layout-plan.json (image-aware)              (sub-agente)
//   4. Copy overlay      → overlay-copy.json                           (sub-agente)
//   5. Compose overlay   → slide-XX-final.png                          (compose-overlay.mjs)
//   6. Caption writer    → caption.md                                  (sub-agente)
//   7. Calendar publish  → output/calendar/YYYY-MM/YYYYMMDD-<slug>.md  (sub-agente)
//
// Las etapas con sub-agente pausan el script. Claude Code dispara el agente
// correspondiente y reanudas con --from=<N>.
//
// Uso:
//   node scripts/ship-content.mjs --topic="3 errores UGC"
//   node scripts/ship-content.mjs --brief=drafts/xxx.json --from=2
//   node scripts/ship-content.mjs --brief=... --from=4 --dir=output/social/...

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { loadConfig } from "./brand-system.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else if (raw.startsWith("--")) args[raw.slice(2)] = true;
  }
  return args;
}

function yyyymmdd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function runNode(script, args) {
  return new Promise((ok, ko) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: "inherit", cwd: ROOT });
    child.on("exit", (code) => (code === 0 ? ok() : ko(new Error(`${basename(script)} exited ${code}`))));
  });
}

function stageHeader(n, title) {
  const bar = "━".repeat(62);
  console.log(`\n${bar}\nETAPA ${n} · ${title}\n${bar}`);
}

function requestAgent({ agent, input, output, instructions }) {
  console.log(`\n┌─ SUB-AGENTE REQUERIDO ─────────────────────────────`);
  console.log(`│ Agent:   ${agent}`);
  console.log(`│ Input:   ${input}`);
  console.log(`│ Output:  ${output}`);
  console.log(`└────────────────────────────────────────────────────\n`);
  console.log(`Instrucción para Claude Code:\n  ${instructions}\n`);
  console.log(`⏸  Pausa — reanuda con --from=<siguiente_etapa>\n`);
}

async function main() {
  const args = parseArgs(process.argv);
  const from = parseFloat(args.from || "1");

  const config = await loadConfig();

  console.log(`\n🚀 Content Forge · Pipeline`);
  console.log(`Brand:    ${config.brand.name}`);
  console.log(`Handle:   ${config.brand.handle}`);
  console.log(`Platform: ${args.platform || config.content.defaultPlatform}`);
  if (config.character?.enabled) console.log(`Character: ${config.character.name} (${config.character.mode})`);
  console.log(`From:     etapa ${from}\n`);

  const datePrefix = args.date || yyyymmdd();

  // ─── ETAPA 1: Brief architect ──────────────────────────────────────
  if (from <= 1) {
    stageHeader(1, "Brief architect (sub-agente content-forge-brief-architect)");
    if (!args.topic && !args.brief) {
      console.error("Para etapa 1 necesito --topic=\"tu tema\"");
      process.exit(1);
    }
    if (args.brief) {
      console.log(`Ya tienes un brief en ${args.brief}, saltando a etapa 2.`);
    } else {
      requestAgent({
        agent: "content-forge-brief-architect",
        input: `topic="${args.topic}"  platform=${args.platform || config.content.defaultPlatform}`,
        output: `drafts/${datePrefix}-<slug>-brief.json`,
        instructions: `Diseña el brief JSON para el topic dado. Respeta brand.config.json (voz, pilar mix, platform defaults). Si character.enabled, marca qué slides usan al personaje. Luego reanuda con --from=2 --brief=<ruta>.`,
      });
      return;
    }
  }

  const briefPath = args.brief ? resolve(args.brief) : null;
  if (!briefPath || !existsSync(briefPath)) {
    console.error(`Brief no existe: ${briefPath}`);
    process.exit(1);
  }
  const brief = JSON.parse(await readFile(briefPath, "utf8"));
  const concept = brief.concept;
  const platform = brief.platform || config.content.defaultPlatform;
  const OUT_DIR = args.dir ? resolve(args.dir) : join(ROOT, config.output.baseDir, `${datePrefix}-${concept}`);

  // ─── ETAPA 2: Generate PNGs base ───────────────────────────────────
  if (from <= 2 && !args["skip-generate"]) {
    stageHeader(2, "Generate PNGs base (Nanobanana + character refs)");
    await runNode(join(__dirname, "generate-social.mjs"), [
      `--concept=${concept}`,
      `--platform=${platform}`,
      `--brief=${briefPath}`,
      `--date=${datePrefix}`,
    ]);
    console.log(`✓ PNGs generados en ${OUT_DIR}`);
  }

  // ─── ETAPA 3: Visual QA ─────────────────────────────────────────────
  if (from <= 3) {
    stageHeader(3, "Visual QA (sub-agente content-forge-visual-qa)");
    requestAgent({
      agent: "content-forge-visual-qa",
      input: `dir=${OUT_DIR}  brief=${briefPath}`,
      output: `${OUT_DIR}/qa-report.json`,
      instructions: `Valida cada PNG con Claude vision contra brand.config.json (paleta, sin texto espurio, concepto capturado). Escribe qa-report.json. Si todos pass reanuda con --from=3.5; si hay fails pausa y regenera.`,
    });
    return;
  }

  // ─── ETAPA 3.5: Layout analysis ─────────────────────────────────────
  if (from <= 3.5) {
    stageHeader("3.5", "Layout analysis (sub-agente content-forge-layout-architect)");
    requestAgent({
      agent: "content-forge-layout-architect",
      input: `dir=${OUT_DIR}`,
      output: `${OUT_DIR}/layout-plan.json`,
      instructions: `Analiza cada PNG con vision. Decide posición, color, sombra, glow, scrim, tamaños y logo por slide. Escribe layout-plan.json. Reanuda con --from=4.`,
    });
    return;
  }

  // ─── ETAPA 4: Copy overlay ──────────────────────────────────────────
  if (from <= 4) {
    stageHeader(4, "Copy overlay (sub-agente content-forge-copy-overlay)");
    requestAgent({
      agent: "content-forge-copy-overlay",
      input: `dir=${OUT_DIR}  brief=${briefPath}`,
      output: `${OUT_DIR}/overlay-copy.json`,
      instructions: `Redacta headlines/body/eyebrow/signature por slide respetando voice de brand.config.json y las safe zones de layout-plan.json. El único handle autorizado es ${config.brand.handle}. Reanuda con --from=5.`,
    });
    return;
  }

  // ─── ETAPA 5: Compose ───────────────────────────────────────────────
  if (from <= 5) {
    stageHeader(5, "Compose overlay (sharp + resvg + logo)");
    if (!existsSync(join(OUT_DIR, "overlay-copy.json"))) {
      console.error(`No existe overlay-copy.json. Ejecuta etapa 4 primero.`);
      process.exit(1);
    }
    await runNode(join(__dirname, "compose-overlay.mjs"), [`--dir=${OUT_DIR}`]);
    console.log(`✓ Slides finales con overlay escritos.`);
  }

  // ─── ETAPA 6: Caption ───────────────────────────────────────────────
  if (from <= 6) {
    stageHeader(6, "Caption writer (sub-agente content-forge-caption-writer)");
    requestAgent({
      agent: "content-forge-caption-writer",
      input: `dir=${OUT_DIR}`,
      output: `${OUT_DIR}/caption.md`,
      instructions: `Redacta caption con voz ${config.voice.style}, hook en 1ra línea, ~1400 chars, 20 hashtags según brand.config.hashtags. Handle único ${config.brand.handle}. Reanuda con --from=7.`,
    });
    return;
  }

  // ─── ETAPA 7: Calendar ──────────────────────────────────────────────
  if (from <= 7) {
    stageHeader(7, "Calendar publisher (sub-agente content-forge-calendar-publisher)");
    requestAgent({
      agent: "content-forge-calendar-publisher",
      input: `dir=${OUT_DIR}`,
      output: `${config.output.calendarDir}/YYYY-MM/YYYYMMDD-${concept}.md`,
      instructions: `Agenda en calendario según cadence de brand.config.json (timezone ${config.brand.timezone}). Paso final.`,
    });
    return;
  }

  // ─── FINAL ─────────────────────────────────────────────────────────
  console.log(`\n🎉 Pipeline completo.\n`);
  console.log(`📁 ${OUT_DIR}/`);
  console.log(`   ├── slide-XX-final.png   (listos para publicar)`);
  console.log(`   ├── raw/                 (backup sin overlay)`);
  console.log(`   ├── caption.md           (copy-paste a IG)`);
  console.log(`   ├── manifest.json`);
  console.log(`   ├── qa-report.json`);
  console.log(`   ├── layout-plan.json`);
  console.log(`   └── overlay-copy.json\n`);
  console.log(`📅 Calendar entry en ${config.output.calendarDir}/\n`);
}

main().catch((err) => { console.error("Fatal:", err?.message ?? err); process.exit(1); });
