/**
 * lib/generator-api.ts
 * Generator wrapper for use inside Next.js API routes.
 *
 * - If ANTHROPIC_API_KEY is set: calls Claude to produce fresh SiteProps.
 * - If not set: loads the pre-generated clearflow-plumbing fixture from
 *   generator/output/clearflow-plumbing.json so the pipeline is fully
 *   testable without real API keys.
 *
 * Unlike generator/index.ts this module NEVER calls process.exit — it
 * throws on unrecoverable errors so the API route can return a 500.
 *
 * Human deploy note: set ANTHROPIC_API_KEY to your Anthropic key.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sitePropsSchema, type SiteProps } from "@/shared/types/site-props";
import type { GbpData } from "@/lib/places-client";

/* --------------------------------------------------------------------- config */

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 16000;

/* ------------------------------------------------------------------- exports */

/**
 * Map a trade niche to its template category directory name.
 * Extend this as new categories are built.
 */
export function nicheToCategory(niche: string): string {
  const lower = niche.toLowerCase().replace(/[\s_]+/g, "-");

  const ALLIED: string[] = [
    "physiotherapy", "physio", "occupational-therapy", "speech-pathology",
    "speech-therapy", "dietetics", "dietitian", "podiatry", "podiatrist",
    "osteopathy", "osteopath",
  ];
  if (ALLIED.includes(lower)) return "allied-health";

  const BEAUTY: string[] = [
    "hairdresser", "hair-salon", "hair-stylist", "beauty-clinic", "beauty-salon",
    "nail-bar", "nail-salon", "lash-studio", "brow-bar", "makeup-artist",
    "beauty",
  ];
  if (BEAUTY.includes(lower)) return "beauty-aesthetics";

  const FITNESS: string[] = [
    "personal-trainer", "personal-training", "gym", "fitness-studio",
    "yoga", "pilates", "crossfit", "box", "boxing", "fitness", "wellness",
    "group-fitness",
  ];
  if (FITNESS.includes(lower)) return "fitness-wellness";

  // Default: trades (electrician, plumber, house-cleaning, carpenter, HVAC, …)
  return "trades";
}

/**
 * Generate a SiteProps blob for a business.
 *
 * Falls back to the Clearflow Plumbing fixture when ANTHROPIC_API_KEY is absent,
 * so the end-to-end pipeline can be proved locally without API spend.
 */
export async function generateSiteForApi(gbpData: GbpData): Promise<SiteProps> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn(
      "[generator-api] ANTHROPIC_API_KEY not set — loading clearflow-plumbing fixture."
    );
    return loadFixture();
  }

  const category = nicheToCategory(gbpData.niche);
  const systemPrompt = loadSystemPrompt(category);
  const userMessage = buildUserMessage(gbpData);
  const client = new Anthropic({ apiKey });

  // Attempt 1
  console.log("[generator-api] attempt 1 — calling Claude...");
  const raw1 = await callClaude(client, systemPrompt, [{ role: "user", content: userMessage }]);
  const result1 = parseAndValidate(raw1);
  if (result1.ok) {
    console.log("[generator-api] attempt 1 — PASSED.");
    return result1.data;
  }
  console.warn(`[generator-api] attempt 1 failed:\n${result1.errors.slice(0, 400)}`);

  // Attempt 2 — feed errors back
  console.log("[generator-api] attempt 2 — corrective prompt...");
  const raw2 = await callClaude(client, systemPrompt, [
    { role: "user", content: userMessage },
    { role: "assistant", content: result1.cleaned },
    {
      role: "user",
      content: `Fix these validation errors and return ONLY the corrected JSON:\n${result1.errors}`,
    },
  ]);
  const result2 = parseAndValidate(raw2);
  if (result2.ok) {
    console.log("[generator-api] attempt 2 — PASSED.");
    return result2.data;
  }

  throw new Error(
    `SiteProps generation failed after 2 attempts.\nAttempt 2 errors:\n${result2.errors}`
  );
}

/* ----------------------------------------------------------------- internals */

function loadFixture(): SiteProps {
  const path = join(process.cwd(), "generator", "output", "clearflow-plumbing.json");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      "Fixture file missing at generator/output/clearflow-plumbing.json. " +
        "Run: node generator/run.mjs  (requires ANTHROPIC_API_KEY)"
    );
  }
  const result = sitePropsSchema.safeParse(JSON.parse(raw));
  if (!result.success) {
    throw new Error(
      `Fixture failed schema validation: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }
  return result.data;
}

function loadSystemPrompt(category: string): string {
  return readFileSync(
    join(process.cwd(), "templates", "categories", category, "system-prompt.md"),
    "utf8"
  );
}

async function callClaude(
  client: Anthropic,
  systemPrompt: string,
  messages: Anthropic.MessageParam[]
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });
  const content = response.content[0];
  if (!content || content.type !== "text") {
    throw new Error(`Unexpected Claude response type: ${content?.type ?? "none"}`);
  }
  return content.text;
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

function parseAndValidate(
  raw: string
): { ok: true; data: SiteProps } | { ok: false; errors: string; cleaned: string } {
  const cleaned = stripFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      ok: false,
      errors: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
      cleaned,
    };
  }
  const result = sitePropsSchema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  const errors = result.error.issues
    .map((e) => `${String(e.path.join("."))}: ${e.message}`)
    .join("\n");
  return { ok: false, errors, cleaned };
}

function buildUserMessage(gbp: GbpData): string {
  const reviewsText = gbp.reviews
    .map((r, i) => `Review ${i + 1} (${r.rating}/5, ${r.author}): "${r.text}"`)
    .join("\n");

  return `Generate a complete SiteProps JSON object for this business. Respond with ONLY valid JSON — no prose, no fences.

Business: ${gbp.name}
Niche: ${gbp.niche}
Location: ${gbp.suburb}, ${gbp.state}
Phone: ${gbp.phone}
Address: ${gbp.address}
Description: ${gbp.description}
Services: ${gbp.services.join(", ") || "(see niche)"}
Reviews:
${reviewsText}

Requirements (must pass automated grader):
- services[] >= 4 pages, each: slug + seo.title + intro (60+ words) + benefits[] + sections[] + faqs[]
- locations[] >= 6 pages, each: slug + seo.title + intro (60+ words, suburb-specific) + sections[] + benefits[] + faqs[]
- service_areas[] >= 3 pages, each: slug + seo.title + headline + body (60+ words) + sections[] + benefits[] + faqs[]
- All pages: genuinely distinct copy, no duplicated paragraphs
- Australian English and AUD throughout
- contact.hours entries must use { "label": "...", "value": "..." } format
- faq items must have an "id" field

Output the complete SiteProps JSON now:`;
}
