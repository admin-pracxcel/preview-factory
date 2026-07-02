/**
 * Preview Factory generator — Phase D
 *
 * Accepts a GBP payload, calls the Claude API with the trades system prompt,
 * parses and validates the SiteProps JSON, and writes the output to
 * generator/output/<slug>.json.
 *
 * Usage (after compiling or via a TypeScript runner):
 *   node generator/output/index.js
 *
 * Auth: shells out to the local `claude` CLI (Claude Code subscription).
 * No Anthropic API key required.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sitePropsSchema, type SiteProps } from "../shared/types/site-props";
import { callClaudeCli } from "../lib/claude-cli";

/* ------------------------------------------------------------------ types */

export interface GbpReview {
  author: string;
  rating: number;
  text: string;
}

export interface GbpPayload {
  /** Business trading name as it appears on Google. */
  name: string;
  /** Trade niche, e.g. "plumber", "electrician", "house-cleaning". */
  niche: string;
  /** Primary suburb the business operates from. */
  suburb: string;
  /** Australian state abbreviation, e.g. "VIC". */
  state: string;
  /** Phone number in standard AU format, e.g. "03 9123 4567". */
  phone: string;
  /** Full street address. */
  address: string;
  /** GBP "From the business" description or auto-generated blurb. */
  description: string;
  /** List of service names the business offers. */
  services: string[];
  /** Sample reviews (3–10). */
  reviews: GbpReview[];
  /** Optional: years in business. */
  years_in_business?: number;
  /** Optional: licence number (do NOT invent one if unknown). */
  licence?: string;
}

/* ------------------------------------------------------------- constants */

const MODEL = "claude-haiku-4-5";
const MAX_RETRIES = 2;

/* --------------------------------------------------------------- helpers */

function repoRoot(): string {
  // The generator is always executed from the repo root (e.g. `node dist/generator/test-gbp.js`
  // or `npx ts-node generator/test-gbp.ts`).  process.cwd() is the repo root in all cases.
  return process.cwd();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripFences(raw: string): string {
  // Strip leading/trailing markdown code fences if Claude wraps its output.
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function loadSystemPrompt(category: string): string {
  const root = repoRoot();
  const promptPath = join(
    root,
    "templates",
    "categories",
    category,
    "system-prompt.md"
  );
  return readFileSync(promptPath, "utf8");
}

function buildUserMessage(gbp: GbpPayload): string {
  const reviewsText = gbp.reviews
    .map(
      (r, i) =>
        `Review ${i + 1} (${r.rating}/5 stars, by ${r.author}): "${r.text}"`
    )
    .join("\n");

  return `You are generating a complete SiteProps JSON object for the following real business.
Respond with ONLY a valid JSON object — no prose, no markdown fences, no explanation.

## Business details
- Name: ${gbp.name}
- Niche: ${gbp.niche}
- Primary suburb: ${gbp.suburb}, ${gbp.state}
- Phone: ${gbp.phone}
- Address: ${gbp.address}
- Description: ${gbp.description}
${gbp.years_in_business != null ? `- Years in business: ${gbp.years_in_business}` : ""}
${gbp.licence ? `- Licence: ${gbp.licence}` : ""}

## Services offered
${gbp.services.map((s) => `- ${s}`).join("\n")}

## Sample reviews
${reviewsText}

## Generation requirements (CRITICAL — the output must pass an automated grader)

1. **services[]** — generate 8–10 service-detail pages. Each must have:
   - slug, title, summary, icon (lucide-react name), intro (2+ paragraphs, 80+ words)
   - benefits[] — 4–6 bullet strings
   - sections[] — at least 1 {heading, body} block where body is 50+ words
   - faqs[] — 2–3 Q&A items
   - seo.title and seo.description

2. **locations[]** — generate 10–14 suburb pages covering real Melbourne/VIC suburbs near ${gbp.suburb}. Each location page MUST have:
   - slug, suburb, state, intro (50+ words describing local context)
   - headline — a short H1 such as "${gbp.niche} in [Suburb]"
   - sections[] — at least 1 {heading, body} block where body is 60+ words of locally specific content
   - benefits[] — 3–5 bullet strings about serving this suburb
   - faqs[] — 1–2 locally relevant Q&A items
   - landmarks[] — 3–5 real local landmarks or neighbourhoods
   - services_offered[] — list of service slugs relevant to this suburb
   - seo.title and seo.description
   - IMPORTANT: Every location page must be genuinely distinct — mention different local details, landmarks, and service emphasis. Do NOT duplicate paragraphs across locations.

3. **service_areas[]** — generate 8–12 service-in-area landing pages. slug = "\${service_slug}-\${suburb-slug}". Each must have:
   - headline — e.g. "Blocked Drains in Richmond"
   - intro — 40+ words of suburb-specific intro
   - sections[] — at least 1 {heading, body} block where body is 60+ words
   - benefits[] — 4–6 bullet strings
   - faqs[] — 2 Q&A items
   - seo.title and seo.description
   - IMPORTANT: Every service_area page must be genuinely distinct — different suburb, different service, distinct copy.

4. **Overall minimum counts**: services >= 8, locations >= 10, service_areas >= 8.

5. **No fabrication**: do NOT invent licence numbers, ABNs, exact review counts, or certifications not mentioned above.

6. **Australian English and AUD** throughout.

7. **Colours**: For a plumber, use navy/blue primary_color (e.g. #0f2a55) and orange or teal accent_color.

Output the complete SiteProps JSON object now:`;
}

function buildRetryMessage(
  gbp: GbpPayload,
  previousResponse: string,
  errors: string
): string {
  return `Your previous response failed schema validation. Fix the issues below and return a corrected JSON object.
Do NOT include any prose — return ONLY the corrected JSON object.

## Validation errors
${errors}

## Your previous response (first 3000 chars)
${previousResponse.slice(0, 3000)}

## Business context (for reference)
- Name: ${gbp.name}, Niche: ${gbp.niche}, Suburb: ${gbp.suburb} ${gbp.state}

## Reminder: critical requirements
- Every location page must have sections[] with at least 1 block of 60+ words
- Every service_area page must have sections[] or enough intro + benefits to reach 60 words total
- services >= 8, locations >= 10, service_areas >= 8
- All pages need seo.title

Output the corrected SiteProps JSON object now:`;
}

/* ----------------------------------------------------------- core logic */

/**
 * Call Claude once via the local `claude` CLI and return the raw text response.
 */
async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return callClaudeCli({ systemPrompt, userPrompt, model: MODEL });
}

/**
 * Parse and validate a raw Claude response against sitePropsSchema.
 * Returns `{ ok: true, data }` on success or `{ ok: false, errors }` on failure.
 */
function parseAndValidate(
  raw: string
): { ok: true; data: SiteProps } | { ok: false; errors: string; cleaned: string } {
  const cleaned = stripFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: `JSON parse error: ${msg}`, cleaned };
  }

  const result = sitePropsSchema.safeParse(parsed);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const errors = result.error.issues
    .map((e) => `  ${String(e.path.join("."))}: ${e.message}`)
    .join("\n");
  return { ok: false, errors, cleaned };
}

/**
 * Generate a SiteProps blob for a business.
 *
 * Steps:
 *  1. Load the category system prompt from templates/categories/<category>/system-prompt.md
 *  2. Call Claude with the system prompt + GBP payload as the user message
 *  3. Parse and validate against sitePropsSchema
 *  4. On failure, retry once with the Zod errors fed back into the prompt
 *  5. Return the validated SiteProps or throw loudly
 *
 * @param category  The template category directory name (e.g. "trades")
 * @param niche     The specific trade niche (e.g. "plumber")
 * @param gbpData   The Google Business Profile payload
 * @returns         Validated SiteProps
 */
export async function generateSite(
  category: string,
  niche: string,
  gbpData: GbpPayload
): Promise<SiteProps> {
  const systemPrompt = loadSystemPrompt(category);
  const userMessage = buildUserMessage({ ...gbpData, niche });

  // --- Attempt 1: initial generation
  console.log("generator: attempt 1 — initial generation...");
  const raw1 = await callClaude(systemPrompt, userMessage);

  const result1 = parseAndValidate(raw1);
  if (result1.ok) {
    console.log("generator: attempt 1 — validation PASSED.");
    return result1.data;
  }

  console.error(
    `generator: attempt 1 — failed.\n${result1.errors}`
  );

  // --- Attempt 2: retry with validation errors + previous response embedded
  console.log("generator: attempt 2 — sending corrective prompt...");
  const retryMsg = buildRetryMessage(gbpData, result1.cleaned, result1.errors);
  const raw2 = await callClaude(systemPrompt, retryMsg);

  const result2 = parseAndValidate(raw2);
  if (result2.ok) {
    console.log("generator: attempt 2 — validation PASSED.");
    return result2.data;
  }

  throw new Error(
    `SiteProps generation failed after ${MAX_RETRIES} attempts.\n\nAttempt 2 errors:\n${result2.errors}`
  );
}

/* ------------------------------------------------------ write output file */

export async function generateAndWrite(
  category: string,
  niche: string,
  gbpData: GbpPayload
): Promise<string> {
  const root = repoRoot();
  const outputDir = join(root, "generator", "output");
  mkdirSync(outputDir, { recursive: true });

  const slug = slugify(gbpData.name);
  const outputPath = join(outputDir, `${slug}.json`);

  console.log(`generator: generating site for "${gbpData.name}" (${niche})...`);
  const siteProps = await generateSite(category, niche, gbpData);

  writeFileSync(outputPath, JSON.stringify(siteProps, null, 2), "utf8");
  console.log(`generator: written to ${outputPath}`);

  return outputPath;
}
