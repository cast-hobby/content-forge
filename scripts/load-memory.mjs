import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const MEMORY_PATH = resolve(process.cwd(), "memory.json");

export async function loadMemory() {
  try {
    return JSON.parse(await readFile(MEMORY_PATH, "utf-8"));
  } catch {
    return null;
  }
}

export async function saveMemory(memoryObj) {
  try {
    memoryObj.lastUpdated = new Date().toISOString().slice(0, 10);
    await writeFile(MEMORY_PATH, JSON.stringify(memoryObj, null, 2));
    return true;
  } catch {
    return false;
  }
}

export async function addCarouselToHistory(carouselData) {
  const memory = await loadMemory();
  if (!memory) return false;
  memory.carouselHistory.push(carouselData);
  memory.metrics.totalCarousels = memory.carouselHistory.length;
  const pilar = carouselData.pilar;
  if (pilar) memory.metrics.byPilar[pilar] = (memory.metrics.byPilar[pilar] || 0) + 1;
  return saveMemory(memory);
}

export async function getSuccessPatterns() {
  return (await loadMemory())?.successPatterns || [];
}

export async function getFailurePatterns() {
  return (await loadMemory())?.failurePatterns || [];
}
