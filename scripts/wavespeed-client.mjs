// wavespeed-client.mjs — Cliente REST para WaveSpeed AI image generation
//
// Docs oficiales: https://api.wavespeed.ai/api/v3
// Submit:  POST /api/v3/{model_id}         → { data: { id, status, urls.get } }
// Poll:    GET  /api/v3/predictions/{id}/result → { data: { status, outputs[] } }
// Auth:    Authorization: Bearer {WAVESPEED_API_KEY}
// Size:    formato "1024*1280" (asterisco, NO "x")
// Status:  pending → processing → completed | failed

const BASE_URL      = "https://api.wavespeed.ai/api/v3";
const DEFAULT_MODEL = "wavespeed-ai/flux-dev";
const POLL_INTERVAL = 2000;   // ms entre polls
const POLL_MAX      = 50;     // ~100 segundos máximo

/** Prefix que garantiza calidad premium en flux-dev */
const PREMIUM_PREFIX =
  "premium editorial photography, ultra high quality, professional studio lighting, " +
  "crisp sharp focus, 4K resolution, award-winning composition, ";

/**
 * Genera una imagen con WaveSpeed AI (flux-dev por defecto).
 * @param {string} prompt - Descripción de la imagen (SIN el prefix premium)
 * @param {{ size?: string, model?: string, steps?: number }} opts
 *   - size: formato OpenAI "1024x1280" — se convierte internamente a "1024*1280"
 * @returns {Promise<Buffer>} PNG descargado
 */
export async function generateImage(prompt, {
  size  = "1024x1280",
  model = DEFAULT_MODEL,
  steps = 30,
} = {}) {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY no está definida en el entorno");

  // WaveSpeed usa "*" como separador de dimensiones, no "x"
  const wsSize = size.replace("x", "*");

  // 1. Enviar tarea
  const initRes = await fetch(`${BASE_URL}/${model}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      prompt:              PREMIUM_PREFIX + prompt,
      size:                wsSize,
      num_images:          1,
      guidance_scale:      3.5,
      num_inference_steps: steps,
      seed:                -1,
    }),
  });

  if (!initRes.ok) {
    const txt = await initRes.text().catch(() => "");
    throw new Error(`WaveSpeed submit falló ${initRes.status}: ${txt}`);
  }

  const init = await initRes.json();
  if (init.code !== 200) throw new Error(`WaveSpeed error: ${init.message}`);

  // Respuesta sync (ya tiene outputs — poco probable en flux-dev)
  if (init.data?.outputs?.[0]) return downloadImage(init.data.outputs[0]);

  // Respuesta async — obtenemos el task ID
  const taskId = init.data?.id;
  if (!taskId) throw new Error("WaveSpeed: respuesta sin id de tarea");

  // 2. Polling GET /api/v3/predictions/{id}/result
  for (let i = 0; i < POLL_MAX; i++) {
    await sleep(POLL_INTERVAL);

    const pollRes = await fetch(`${BASE_URL}/predictions/${taskId}/result`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue;   // error transitorio → reintentar

    const poll   = await pollRes.json();
    const status = poll.data?.status;

    if (status === "completed") {
      const url = poll.data?.outputs?.[0];
      if (!url) throw new Error("WaveSpeed: completed pero sin URL de salida");
      return downloadImage(url);
    }

    if (status === "failed") {
      throw new Error(`WaveSpeed: tarea fallida — ${poll.data?.error || "sin detalle"}`);
    }
    // pending / processing → continuar esperando
  }

  throw new Error(`WaveSpeed: timeout después de ${(POLL_MAX * POLL_INTERVAL / 1000).toFixed(0)}s`);
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error descargando imagen WaveSpeed (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
