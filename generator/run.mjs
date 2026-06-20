#!/usr/bin/env node
/**
 * generator/run.mjs
 *
 * End-to-end generator test in pure ESM/CJS — no TypeScript runner needed.
 * Calls the Claude API with the trades system prompt + a realistic plumber
 * GBP payload, validates the JSON output, retries once on schema errors,
 * and writes the result to generator/output/clearflow-plumbing.json.
 *
 * Usage:
 *   node generator/run.mjs
 *
 * Environment:
 *   ANTHROPIC_API_KEY — required
 */

import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Anthropic = require("@anthropic-ai/sdk");
const { z } = require("zod");

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");

/* ---------------------------------------------------------------- config */

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 32000; // Sonnet supports up to 64k; 32k is enough for a full SiteProps blob.

/* --------------------------------------------------------------- schema */
// Minimal Zod schema that mirrors the grader's checks + sitePropsSchema.
// The grader needs: business.name/phone, services[], locations[],
// service_areas[], each with slug + seo.title + enough body words.

const contentBlock = z.object({ heading: z.string().optional(), body: z.string() });
const faqItem = z.object({ id: z.string(), question: z.string(), answer: z.string() });
const pageSeo = z.object({ title: z.string(), description: z.string().optional() });

const servicePageSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string().default(""),
  icon: z.string().optional(),
  starting_price: z.string().optional(),
  hero_image: z.string().optional(),
  intro: z.string().default(""),
  benefits: z.array(z.string()).default([]),
  sections: z.array(contentBlock).default([]),
  faqs: z.array(faqItem).default([]),
  seo: pageSeo,
});

const locationPageSchema = z.object({
  slug: z.string(),
  suburb: z.string(),
  state: z.string().optional(),
  headline: z.string().optional(),
  intro: z.string().default(""),
  body: z.string().optional(),
  hero_image: z.string().optional(),
  landmarks: z.array(z.string()).default([]),
  services_offered: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  sections: z.array(contentBlock).default([]),
  faqs: z.array(faqItem).default([]),
  seo: pageSeo,
});

const serviceAreaPageSchema = z.object({
  slug: z.string(),
  service_slug: z.string(),
  service_title: z.string(),
  suburb: z.string(),
  state: z.string().optional(),
  headline: z.string(),
  intro: z.string().optional(),
  body: z.string(),
  benefits: z.array(z.string()).default([]),
  sections: z.array(contentBlock).default([]),
  faqs: z.array(faqItem).default([]),
  seo: pageSeo,
});

const sitePropsMiniSchema = z.object({
  business: z.object({
    name: z.string(),
    phone: z.string(),
    email: z.string().optional(),
    suburb: z.string().optional(),
    state: z.string().optional(),
    abn: z.string().optional(),
    tagline: z.string().optional(),
  }),
  branding: z.object({
    primary_color: z.string(),
    secondary_color: z.string().optional(),
    accent_color: z.string(),
    logo_url: z.string().optional().default(""),
    hero_image_url: z.string().optional().default(""),
    font_heading: z.string().optional(),
  }),
  seo: z.object({ title: z.string(), description: z.string().optional() }).optional(),
  home: z.object({
    hero: z.object({
      headline: z.string(),
      subheadline: z.string().optional(),
      cta_primary: z.object({ label: z.string(), href: z.string() }),
    }),
    services: z.array(z.any()).default([]),
    about: z.any().optional(),
    service_area: z.any().optional(),
    gallery: z.array(z.any()).optional(),
    testimonials: z.array(z.any()).optional(),
    social_proof: z.any().optional(),
    offer: z.any().optional(),
    contact: z.any().optional(),
  }),
  services: z.array(servicePageSchema).default([]),
  locations: z.array(locationPageSchema).default([]),
  service_areas: z.array(serviceAreaPageSchema).default([]),
  faq: z.any().optional(),
  about: z.any().optional(),
  preview: z.any().optional(),
  overrides: z.any().optional(),
});

/* --------------------------------------------------------- grader logic */
// Mirror the grader's body-word check so we can self-correct before writing.

const MIN = { services: 4, locations: 6, service_areas: 3, body_words: 60 };

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function pageText(p) {
  return [
    p.intro, p.headline, p.body,
    ...(p.sections || []).map((s) => `${s.heading || ""} ${s.body || ""}`),
    ...(p.benefits || []),
    ...(p.faqs || []).map((f) => `${f.question} ${f.answer}`),
  ].join(" ");
}

function localValidate(site) {
  const errors = [];
  if (site.services.length < MIN.services)
    errors.push(`Only ${site.services.length} service pages (need >= ${MIN.services})`);
  if (site.locations.length < MIN.locations)
    errors.push(`Only ${site.locations.length} location pages (need >= ${MIN.locations})`);
  if (site.service_areas.length < MIN.service_areas)
    errors.push(`Only ${site.service_areas.length} service-area pages (need >= ${MIN.service_areas})`);

  for (const pg of site.services) {
    if (!pg.slug) errors.push(`service missing slug`);
    if (!pg.seo?.title) errors.push(`service "${pg.slug}" missing seo.title`);
    const words = norm(pageText(pg)).split(" ").filter(Boolean).length;
    if (words < MIN.body_words) errors.push(`service "${pg.slug}" thin (${words} words, need >= ${MIN.body_words})`);
  }
  for (const pg of site.locations) {
    if (!pg.slug) errors.push(`location missing slug`);
    if (!pg.seo?.title) errors.push(`location "${pg.slug}" missing seo.title`);
    const words = norm(pageText(pg)).split(" ").filter(Boolean).length;
    if (words < MIN.body_words) errors.push(`location "${pg.slug}" thin (${words} words, need >= ${MIN.body_words})`);
  }
  for (const pg of site.service_areas) {
    if (!pg.slug) errors.push(`service_area missing slug`);
    if (!pg.seo?.title) errors.push(`service_area "${pg.slug}" missing seo.title`);
    const words = norm(pageText(pg)).split(" ").filter(Boolean).length;
    if (words < MIN.body_words) errors.push(`service_area "${pg.slug}" thin (${words} words, need >= ${MIN.body_words})`);
  }
  return errors;
}

/* ---------------------------------------------------------- GBP payload */

const clearflowPlumbing = {
  name: "Clearflow Plumbing",
  niche: "plumber",
  suburb: "Southbank",
  state: "VIC",
  phone: "03 9012 4567",
  address: "Level 2, 101 Southbank Blvd, Southbank VIC 3006",
  description:
    "Clearflow Plumbing is a Melbourne-based licensed plumbing business serving the inner south and CBD fringe suburbs. We specialise in blocked drains, burst pipes, hot water systems, gas fitting, bathroom renovations, and general maintenance. Available 24/7 for emergencies — no call-out fee between 7am and 6pm weekdays.",
  years_in_business: 11,
  services: [
    "Blocked drains (drain camera inspection, hydro-jet clearing)",
    "Burst pipes and emergency repairs",
    "Hot water systems (electric, gas, heat pump, continuous flow)",
    "Gas fitting and gas appliance installation",
    "Bathroom renovations and re-piping",
    "General plumbing maintenance",
    "Toilet and cistern repairs",
    "Tap and mixer replacement",
    "Stormwater and sewer drain repairs",
    "New home and renovation rough-in plumbing",
  ],
  reviews: [
    { author: "Sarah L.", rating: 5, text: "Called Clearflow at 10pm for a burst pipe under the kitchen sink. They were on the door in 45 minutes and had everything fixed before midnight. Incredibly professional and the price was fair. Won't use anyone else." },
    { author: "Marcus T.", rating: 5, text: "Had a blocked drain that three other plumbers couldn't fix. Clearflow brought a camera and found a root intrusion near the boundary. Sorted it same day. Excellent work and very tidy." },
    { author: "Priya and James K.", rating: 5, text: "We used Clearflow for our bathroom renovation in South Melbourne — new shower, vanity rough-in and toilet relocation. Turned up on time every day, finished on schedule, and the finish was perfect. Highly recommend." },
    { author: "David F.", rating: 4, text: "Good service for hot water system replacement. They quoted on the spot, came back the next morning, and the new unit has been running perfectly. Minor delay on the arrival time but they called ahead." },
  ],
};

/* --------------------------------------------------- prompt builders */

function loadSystemPrompt() {
  const path = join(REPO, "templates", "categories", "trades", "system-prompt.md");
  return readFileSync(path, "utf8");
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
- Years in business: ${gbp.years_in_business}

## Services offered
${gbp.services.map((s) => `- ${s}`).join("\n")}

## Sample reviews
${reviewsText}

## Generation requirements (CRITICAL — the output must pass an automated grader)

### MINIMUM COUNTS (must meet or exceed)
- services[]: exactly 6 service-detail pages
- locations[]: exactly 8 suburb pages
- service_areas[]: exactly 5 service-in-area landing pages

### service page fields (all 6 must have):
- slug (kebab-case), title, summary (1 sentence), icon (Wrench/Droplets/Flame/Siren/ShieldCheck/Home/Sparkle/Wind/Clock/DollarSign)
- intro: 2 paragraphs totalling 80+ words
- benefits[]: 4 bullet strings
- sections[]: 1 object {heading, body} where body is 60+ words
- faqs[]: 2 objects {id, question, answer}
- seo: {title, description}

### location page fields (all 8 must have):
- slug (kebab-case suburb), suburb, state: "VIC"
- headline: e.g. "Plumber in Richmond"
- intro: 70+ words of locally specific context (mention suburbs housing, demand drivers)
- body: 50+ words additional local content
- sections[]: 1 object {heading, body} — body 60+ words mentioning real local streets/landmarks
- benefits[]: 3 bullet strings
- faqs[]: 1 object {id, question, answer}
- landmarks[]: 3–4 real local landmarks
- services_offered[]: 3 service slugs
- seo: {title, description}
- EVERY location must be GENUINELY DISTINCT — different suburbs, different copy, no copy-paste

### service_area page fields (all 5 must have):
- slug: "{service_slug}-{suburb-slug}" e.g. "blocked-drains-richmond"
- service_slug, service_title, suburb, state: "VIC"
- headline: e.g. "Blocked Drains in Richmond"
- intro: 50+ words suburb-specific
- body: 60+ words locally specific
- sections[]: 1 object {heading, body} — body 60+ words
- benefits[]: 4 bullet strings
- faqs[]: 2 objects {id, question, answer}
- seo: {title, description}
- EVERY service_area must be DISTINCT — different suburb+service combination

### Other required fields:
- home.services[]: 6 overview cards (id, slug, title, description, icon, starting_price optional)
- home.testimonials[]: the 4 reviews above as {id, author, rating, quote, location}
- home.social_proof: {heading, items[4]} each {id, value, icon}
- home.gallery[]: 6 items {id, image_url (Unsplash URL), caption}
- home.offer: {headline, description, price, code, cta: {label, href}}
- home.contact: {heading, phone, email: "info@clearflowplumbing.com.au", address, hours[4]}
- faq: {heading, items[5 Q&A], seo: {title, description}}
- about: {heading, body (100+ words), years_in_business: 11, licence: "VIC Plumbing Lic. No. 51234", values[4 each {id,title,body,icon}], seo}
- branding: {primary_color: "#0f2a55", secondary_color: "#07193a", accent_color: "#e85d04", logo_url: "", hero_image_url: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=1600&q=80", font_heading: "Inter"}
- preview: {countdown_enabled: true, countdown_to: "2026-08-31T23:59:59+10:00", countdown_label: "Free call-out offer ends in"}
- overrides: {}

### Hard rules:
- Australian English and AUD throughout
- Suburbs must be real Melbourne inner/middle-ring suburbs
- Do NOT invent ABN — omit it
- Use the phone number given: ${gbp.phone}

Output the complete SiteProps JSON object now:`;
}

function buildRetryMessage(gbp, previousJson, errors) {
  return `Your previous response failed validation. Fix ONLY the listed issues and return the corrected JSON object.
Do NOT include any prose — return ONLY the corrected JSON object.

## Validation errors to fix
${errors.join("\n")}

## Previous response (first 3000 chars for reference)
${previousJson.slice(0, 3000)}

## Reminder of minimums
- services >= 8, locations >= 12, service_areas >= 10
- Every location page: intro + sections with 60+ words each, no thin pages
- Every service_area page: body + sections with 60+ words
- Every service page: intro + sections with 60+ words

Output the corrected SiteProps JSON object now:`;
}

/* -------------------------------------------------------- api caller */

function stripFences(raw) {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

/**
 * Call Claude using streaming, accumulate the full text, and return it.
 * Streaming is required by the SDK when max_tokens is high enough that
 * the estimated non-streaming timeout would exceed 10 minutes.
 */
async function callClaude(client, systemPrompt, messages) {
  let text = "";
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta?.type === "text_delta"
    ) {
      text += event.delta.text;
    }
  }
  if (!text) throw new Error("No text received from Claude API stream.");
  return text;
}

function parseAndValidate(raw) {
  const cleaned = stripFences(raw);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, errors: [`JSON parse error: ${e.message}`], cleaned };
  }

  const result = sitePropsMiniSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map(
      (e) => `  ${e.path.join(".")}: ${e.message}`
    );
    return { ok: false, errors, cleaned };
  }

  // Additional content-depth validation (mirrors the grader).
  const localErrors = localValidate(result.data);
  if (localErrors.length) return { ok: false, errors: localErrors, cleaned };

  return { ok: true, data: result.data, cleaned };
}

/* ------------------------------------------------------------- main */

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ERROR: ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const client = new Anthropic.default({ apiKey });
  const systemPrompt = loadSystemPrompt();
  const gbp = clearflowPlumbing;
  const userMessage = buildUserMessage(gbp);

  console.log("generator: attempt 1 — initial generation (this takes ~60s)...");
  const raw1 = await callClaude(client, systemPrompt, [
    { role: "user", content: userMessage },
  ]);

  const result1 = parseAndValidate(raw1);
  if (result1.ok) {
    console.log("generator: attempt 1 — PASSED schema + content validation.");
    writeOutput(result1.data, result1.cleaned);
    return;
  }

  console.error(`generator: attempt 1 — failed:\n${result1.errors.slice(0, 10).join("\n")}`);

  console.log("generator: attempt 2 — sending corrective prompt...");
  const retryMsg = buildRetryMessage(gbp, result1.cleaned, result1.errors);
  const raw2 = await callClaude(client, systemPrompt, [
    { role: "user", content: userMessage },
    { role: "assistant", content: result1.cleaned },
    { role: "user", content: retryMsg },
  ]);

  const result2 = parseAndValidate(raw2);
  if (result2.ok) {
    console.log("generator: attempt 2 — PASSED schema + content validation.");
    writeOutput(result2.data, result2.cleaned);
    return;
  }

  console.error(`generator: attempt 2 — also failed:\n${result2.errors.slice(0, 10).join("\n")}`);
  // Still write the best attempt so we can inspect and grade it.
  console.log("generator: writing best attempt for manual inspection...");
  const bestCleaned = result2.cleaned || result1.cleaned;
  mkdirSync(join(REPO, "generator", "output"), { recursive: true });
  writeFileSync(
    join(REPO, "generator", "output", "clearflow-plumbing.json"),
    bestCleaned,
    "utf8"
  );
  console.log("Inspect output and run: node scripts/grade.mjs generator/output/clearflow-plumbing.json");
  process.exit(1);
}

function writeOutput(data, cleaned) {
  const outputDir = join(REPO, "generator", "output");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, "clearflow-plumbing.json");
  // Write the pretty-printed parsed data (defaults filled in by Zod).
  writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`\ngenerator: written to ${outputPath}`);
  console.log("Grade with: node scripts/grade.mjs generator/output/clearflow-plumbing.json");
}

main().catch((err) => {
  console.error("generator: FATAL:", err);
  process.exit(1);
});
