"use strict";
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
 * Environment:
 *   ANTHROPIC_API_KEY — required. Never hardcoded.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSite = generateSite;
exports.generateAndWrite = generateAndWrite;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const site_props_1 = require("../shared/types/site-props");
/* ------------------------------------------------------------- constants */
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 16000;
const MAX_RETRIES = 2;
/* --------------------------------------------------------------- helpers */
function repoRoot() {
    // The generator is always executed from the repo root (e.g. `node dist/generator/test-gbp.js`
    // or `npx ts-node generator/test-gbp.ts`).  process.cwd() is the repo root in all cases.
    return process.cwd();
}
function slugify(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
function stripFences(raw) {
    // Strip leading/trailing markdown code fences if Claude wraps its output.
    return raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
}
function loadSystemPrompt(category) {
    const root = repoRoot();
    const promptPath = (0, node_path_1.join)(root, "templates", "categories", category, "system-prompt.md");
    return (0, node_fs_1.readFileSync)(promptPath, "utf8");
}
function buildUserMessage(gbp) {
    const reviewsText = gbp.reviews
        .map((r, i) => `Review ${i + 1} (${r.rating}/5 stars, by ${r.author}): "${r.text}"`)
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
function buildRetryMessage(gbp, previousResponse, errors) {
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
 * Call the Claude API once and return the raw text response.
 */
async function callClaude(client, systemPrompt, messages) {
    const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
    });
    const content = response.content[0];
    if (!content || content.type !== "text") {
        throw new Error(`Unexpected response content type: ${content?.type ?? "none"}. Expected text.`);
    }
    return content.text;
}
/**
 * Parse and validate a raw Claude response against sitePropsSchema.
 * Returns `{ ok: true, data }` on success or `{ ok: false, errors }` on failure.
 */
function parseAndValidate(raw) {
    const cleaned = stripFences(raw);
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, errors: `JSON parse error: ${msg}`, cleaned };
    }
    const result = site_props_1.sitePropsSchema.safeParse(parsed);
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
async function generateSite(category, niche, gbpData) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error("ERROR: ANTHROPIC_API_KEY environment variable is not set. Aborting.");
        process.exit(1);
    }
    const client = new sdk_1.default({ apiKey });
    const systemPrompt = loadSystemPrompt(category);
    const userMessage = buildUserMessage({ ...gbpData, niche });
    // --- Attempt 1: initial generation
    console.log("generator: attempt 1 — initial generation...");
    const raw1 = await callClaude(client, systemPrompt, [
        { role: "user", content: userMessage },
    ]);
    const result1 = parseAndValidate(raw1);
    if (result1.ok) {
        console.log("generator: attempt 1 — validation PASSED.");
        return result1.data;
    }
    console.error(`generator: attempt 1 — failed.\n${result1.errors}`);
    // --- Attempt 2: retry with validation errors fed back
    console.log("generator: attempt 2 — sending corrective prompt...");
    const retryMsg = buildRetryMessage(gbpData, result1.cleaned, result1.errors);
    const raw2 = await callClaude(client, systemPrompt, [
        { role: "user", content: userMessage },
        { role: "assistant", content: result1.cleaned },
        { role: "user", content: retryMsg },
    ]);
    const result2 = parseAndValidate(raw2);
    if (result2.ok) {
        console.log("generator: attempt 2 — validation PASSED.");
        return result2.data;
    }
    throw new Error(`SiteProps generation failed after ${MAX_RETRIES} attempts.\n\nAttempt 2 errors:\n${result2.errors}`);
}
/* ------------------------------------------------------ write output file */
async function generateAndWrite(category, niche, gbpData) {
    const root = repoRoot();
    const outputDir = (0, node_path_1.join)(root, "generator", "output");
    (0, node_fs_1.mkdirSync)(outputDir, { recursive: true });
    const slug = slugify(gbpData.name);
    const outputPath = (0, node_path_1.join)(outputDir, `${slug}.json`);
    console.log(`generator: generating site for "${gbpData.name}" (${niche})...`);
    const siteProps = await generateSite(category, niche, gbpData);
    (0, node_fs_1.writeFileSync)(outputPath, JSON.stringify(siteProps, null, 2), "utf8");
    console.log(`generator: written to ${outputPath}`);
    return outputPath;
}
