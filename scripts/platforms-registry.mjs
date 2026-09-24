// platforms-registry.mjs — Mapa de plataformas/herramientas → SimpleIcons slug

export const PLATFORMS = {
  // IA & Modelos
  "claude":        "anthropic",
  "anthropic":     "anthropic",
  "openai":        "openai",
  "chatgpt":       "openai",
  "gpt":           "openai",
  "gemini":        "googlegemini",
  "copilot":       "githubcopilot",
  "perplexity":    "perplexity",
  "mistral":       "mistral",
  "ollama":        "ollama",
  "huggingface":   "huggingface",
  "replicate":     "replicate",
  "midjourney":    "midjourney",
  "stability":     "stability",
  "elevenlabs":    "elevenlabs",
  "runway":        "runwayml",

  // Automatización & Dev
  "n8n":           "n8n",
  "make":          "make",
  "zapier":        "zapier",
  "supabase":      "supabase",
  "vercel":        "vercel",
  "github":        "github",
  "gitlab":        "gitlab",
  "docker":        "docker",
  "aws":           "amazonaws",
  "gcp":           "googlecloud",
  "azure":         "microsoftazure",
  "cloudflare":    "cloudflare",
  "railway":       "railway",
  "render":        "render",
  "firebase":      "firebase",
  "planetscale":   "planetscale",
  "neon":          "neon",

  // Redes sociales
  "instagram":     "instagram",
  "tiktok":        "tiktok",
  "youtube":       "youtube",
  "linkedin":      "linkedin",
  "twitter":       "x",
  "x":             "x",
  "facebook":      "facebook",
  "whatsapp":      "whatsapp",
  "telegram":      "telegram",
  "pinterest":     "pinterest",
  "snapchat":      "snapchat",
  "threads":       "threads",

  // Marketing & CRM
  "hubspot":       "hubspot",
  "mailchimp":     "mailchimp",
  "klaviyo":       "klaviyo",
  "stripe":        "stripe",
  "shopify":       "shopify",
  "meta":          "meta",
  "google ads":    "googleads",
  "analytics":     "googleanalytics",

  // Productividad & Diseño
  "notion":        "notion",
  "slack":         "slack",
  "figma":         "figma",
  "canva":         "canva",
  "airtable":      "airtable",
  "asana":         "asana",
  "trello":        "trello",
  "linear":        "linear",
  "jira":          "jira",
  "confluence":    "confluence",
  "zoom":          "zoom",
  "loom":          "loom",
  "miro":          "miro",
  "framer":        "framer",
  "webflow":       "webflow",
  "wordpress":     "wordpress",

  // Ecosistema propio
  "kreoon":        "k",   // fallback
  "jarvis":        "anthropic",
};

/**
 * Detecta plataformas mencionadas en un texto libre.
 * Retorna array de objetos { name, slug, iconUrl }.
 */
export function detectPlatforms(text = "") {
  const lower = text.toLowerCase();
  const found = new Map();

  for (const [keyword, slug] of Object.entries(PLATFORMS)) {
    // Evitar palabras genéricas ultra-cortas que puedan dar falsos positivos
    if (keyword.length < 2) continue;
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(lower) && !found.has(slug)) {
      const displayName = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      found.set(slug, {
        name: displayName,
        slug,
        iconUrl: `https://cdn.simpleicons.org/${slug}/FFFFFF`,
      });
    }
  }

  return [...found.values()];
}
