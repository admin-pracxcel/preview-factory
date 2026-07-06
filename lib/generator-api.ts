/**
 * lib/generator-api.ts
 * Generator wrapper for use inside Next.js API routes.
 *
 * Auth: shells out to the local `claude` CLI (Claude Code subscription).
 * No Anthropic API key required.
 *
 * Fixture mode: set USE_FIXTURE=1 to bypass the model and serve the
 * pre-generated clearflow-plumbing fixture (generator/output/clearflow-plumbing.json).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  sitePropsSchema,
  phaseAGenerationSchema,
  phaseBGenerationSchema,
  phaseCGenerationSchema,
  type SiteProps,
  type PhaseAResult,
  type PhaseBResult,
  type PhaseCResult,
} from "@/shared/types/site-props";
import { callClaudeCli } from "@/lib/claude-cli";
import type { GbpData } from "@/lib/places-client";
import { assembleImages } from "@/lib/image-assembler";

/**
 * JSON Schemas for the three generation phases. Each is passed to the Claude
 * CLI via --json-schema so the API enforces structured output. The pipeline
 * splits one large generation into three smaller, bounded calls — each
 * comfortably finishes within the CLI timeout.
 */
const PHASE_A_JSON_SCHEMA = z.toJSONSchema(phaseAGenerationSchema);
const PHASE_B_JSON_SCHEMA = z.toJSONSchema(phaseBGenerationSchema);
const PHASE_C_JSON_SCHEMA = z.toJSONSchema(phaseCGenerationSchema);

/* --------------------------------------------------------------------- config */

const MODEL = "claude-haiku-4-5";

/* ------------------------------------------------------------------- exports */

/**
 * Map a trade niche to its template category directory name.
 * Extend this as new categories are built.
 */
/** Valid template directory names — what the renderer expects. */
const TEMPLATE_CATEGORIES = new Set([
  "trades", "beauty-aesthetics", "allied-health", "fitness-wellness",
]);

/** Form-side category slugs → template category. The form uses short slugs
 *  ("beauty", "fitness") for nicer URLs; the renderer needs the full names. */
const FORM_CATEGORY_MAP: Record<string, string> = {
  beauty: "beauty-aesthetics",
  fitness: "fitness-wellness",
  trades: "trades",
  "allied-health": "allied-health",
};

/**
 * Map a sub-niche string to a category by keyword matching. Tolerates
 * dropdown labels like "Hair Salon", "Barber Shop", "Other beauty" — anything
 * with a recognisable keyword routes correctly.
 */
export function nicheToCategory(niche: string): string {
  const lower = niche.toLowerCase().replace(/[\s_&]+/g, "-");

  // Keyword match — first hit wins. Ordered by specificity to avoid collisions
  // (e.g. "beauty therapist" hits beauty before any "therapist" rule below).
  const RULES: Array<[string[], string]> = [
    [
      [
        "hair", "barber", "nail", "lash", "brow", "beauty", "skin", "laser",
        "makeup", "salon", "aesthet", "waxing", "tanning",
      ],
      "beauty-aesthetics",
    ],
    [
      [
        "physio", "chiro", "osteo", "podiatr", "dietit", "dietet",
        "speech", "occupational-therap", "psychol", "massage", "myo",
        "allied",
      ],
      "allied-health",
    ],
    [
      [
        "gym", "yoga", "pilates", "crossfit", "boxing", "box-fit",
        "personal-train", "fitness", "wellness", "dance", "martial",
        "studio-fit",
      ],
      "fitness-wellness",
    ],
  ];

  for (const [keywords, category] of RULES) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }

  // Default: trades (electrician, plumber, carpenter, painter, HVAC, etc.)
  return "trades";
}

/**
 * Resolve the final template category. Prefers the form-supplied value when it
 * maps to a known template; otherwise infers from the niche.
 */
export function resolveCategory(niche: string, formCategory?: string): string {
  if (formCategory) {
    const mapped = FORM_CATEGORY_MAP[formCategory] ?? formCategory;
    if (TEMPLATE_CATEGORIES.has(mapped)) return mapped;
  }
  return nicheToCategory(niche);
}

/**
 * Generate a SiteProps blob for a business.
 *
 * Falls back to the Clearflow Plumbing fixture when ANTHROPIC_API_KEY is absent,
 * so the end-to-end pipeline can be proved locally without API spend.
 */
export async function generateSiteForApi(
  gbpData: GbpData,
  category?: string,
): Promise<SiteProps> {
  if (process.env.USE_FIXTURE === "1") {
    console.warn(
      "[generator-api] USE_FIXTURE=1 — loading clearflow-plumbing fixture."
    );
    return loadFixture();
  }

  const resolved = category ?? nicheToCategory(gbpData.niche);
  const systemPrompt = loadSystemPrompt(resolved);

  // Phase A — homepage + 4 service/location stubs.
  // Model wobble occasionally drops required fields (missing hero.headline,
  // services as object instead of array, etc). One retry with the validation
  // errors fed back into the prompt catches most of these — a second failure
  // is a real issue worth surfacing.
  console.log("[generator-api] phase A — homepage + skeleton...");
  const phaseAStart = Date.now();
  let phaseA = await runPhaseA(systemPrompt, gbpData, null);
  if (!phaseA.ok) {
    console.log("[generator-api] phase A validation failed, retrying once with feedback...");
    phaseA = await runPhaseA(systemPrompt, gbpData, phaseA.errors);
  }
  if (!phaseA.ok) {
    throw new Error(`Phase A validation failed:\n${phaseA.errors}`);
  }
  const phaseAData = phaseA.data;
  // Harden the social-proof strip before it reaches the merge. The LLM
  // frequently emits garbage USPs ("5 stars", "100%", bare percentages); we
  // strip those and inject a real Google rating tile from GBP data.
  hardenSocialProof(phaseAData, gbpData);
  // Override CTAs deterministically. The LLM often truncates them ("Call The",
  // "Book at The") or picks a verb inappropriate for the category (an
  // electrician doesn't take "appointments"). Category-aware overrides only.
  hardenCtas(phaseAData, gbpData, resolved);
  console.log(`[generator-api] phase A done in ${Math.round((Date.now() - phaseAStart) / 1000)}s.`);

  // Phase B — expand each service stub into a detail page (one batched call).
  console.log("[generator-api] phase B — service details...");
  const phaseBStart = Date.now();
  const rawB = await callClaude(
    systemPrompt,
    buildPhaseBMessage(gbpData, phaseA.data),
    PHASE_B_JSON_SCHEMA,
  );
  const phaseB = parseAndValidateAgainst(rawB, phaseBGenerationSchema);
  if (!phaseB.ok) {
    throw new Error(`Phase B validation failed:\n${phaseB.errors}`);
  }
  console.log(`[generator-api] phase B done in ${Math.round((Date.now() - phaseBStart) / 1000)}s.`);

  // Phase C — expand each location stub into a detail page.
  console.log("[generator-api] phase C — location details...");
  const phaseCStart = Date.now();
  const rawC = await callClaude(
    systemPrompt,
    buildPhaseCMessage(gbpData, phaseA.data),
    PHASE_C_JSON_SCHEMA,
  );
  const phaseC = parseAndValidateAgainst(rawC, phaseCGenerationSchema);
  if (!phaseC.ok) {
    throw new Error(`Phase C validation failed:\n${phaseC.errors}`);
  }
  console.log(`[generator-api] phase C done in ${Math.round((Date.now() - phaseCStart) / 1000)}s.`);

  // Phase D — merge stubs + details, run the image assembler (which fills the
  // required `image_url` slots on gallery items and `hero_image` on detail
  // pages), then validate the final shape against the permissive runtime
  // schema as a safety net.
  const merged = mergePhases(phaseA.data, phaseB.data, phaseC.data);
  const withImages = await assembleImages(merged as SiteProps, gbpData);
  const runtimeParse = sitePropsSchema.safeParse(withImages);
  if (!runtimeParse.success) {
    throw new Error(
      `Phased merge failed runtime validation:\n${runtimeParse.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}`
    );
  }
  return runtimeParse.data;
}

/**
 * Stitch the three phase outputs into a single SiteProps blob. Each service
 * stub is matched to its detail block by slug; same for locations.
 */
function mergePhases(a: PhaseAResult, b: PhaseBResult, c: PhaseCResult): unknown {
  const serviceDetailBySlug = new Map(b.services.map((s) => [s.slug, s]));
  const locationDetailBySlug = new Map(c.locations.map((l) => [l.slug, l]));

  const services = a.services.map((stub) => {
    const detail = serviceDetailBySlug.get(stub.slug);
    if (!detail) {
      throw new Error(`Phase B missing service detail for slug "${stub.slug}"`);
    }
    return {
      slug: stub.slug,
      title: stub.title,
      summary: stub.summary,
      icon: stub.icon,
      intro: detail.intro,
      benefits: detail.benefits,
      sections: [],
      faqs: detail.faqs,
      seo: detail.seo,
    };
  });

  const locations = a.locations.map((stub) => {
    const detail = locationDetailBySlug.get(stub.slug);
    if (!detail) {
      throw new Error(`Phase C missing location detail for slug "${stub.slug}"`);
    }
    return {
      slug: stub.slug,
      suburb: stub.suburb,
      state: stub.state,
      intro: detail.intro,
      body: "",
      landmarks: [],
      services_offered: [],
      benefits: detail.benefits,
      sections: [],
      faqs: detail.faqs,
      seo: detail.seo,
    };
  });

  return {
    ...a,
    services,
    locations,
    service_areas: [],
  };
}

/**
 * Post-process the LLM-generated social-proof strip to remove garbage tiles
 * and inject a real, deterministic Google-rating tile when we have the data.
 *
 * The LLM tends to emit values like "5 stars", "100%", "24/7", or bare
 * numbers with no meaningful label — they read as empty content in the UI
 * because the hero strip only shows the `value`. This mutates the phase-A
 * result in place so downstream merges see the cleaned strip.
 *
 * Rules:
 * - A tile whose `value` is a bare number/percentage/star-count without extra
 *   context is dropped.
 * - Duplicate values (case-insensitive) are dropped.
 * - If GBP has a real rating + review count, the FIRST tile is replaced with
 *   \`{ value: "4.9★ on Google", label: "127 reviews" }\`.
 * - Padding falls back to a small menu of category-safe archetypes so the
 *   strip always has 3–4 tiles even if the model emitted only garbage.
 */
function hardenSocialProof(phaseA: PhaseAResult, gbp: GbpData): void {
  const strip = phaseA.home.social_proof;
  if (!strip) return;
  const original = Array.isArray(strip.items) ? strip.items : [];

  const seen = new Set<string>();
  const kept = original.filter((item) => {
    if (!item || typeof item.value !== "string") return false;
    const value = item.value.trim();
    if (!value) return false;
    if (isBareNumericValue(value)) return false;
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Deterministic Google-rating tile — only if we have both rating + count.
  const googleTile =
    typeof gbp.rating === "number" && typeof gbp.reviewCount === "number" && gbp.reviewCount > 0
      ? {
          id: "google-rating",
          value: `${gbp.rating.toFixed(1)}★ on Google`,
          label: `${gbp.reviewCount} review${gbp.reviewCount === 1 ? "" : "s"}`,
          icon: "Star",
        }
      : null;

  const items = googleTile ? [googleTile, ...kept] : kept;

  // Pad from the archetype menu if we're under the min of 3.
  const padPool = buildArchetypePool(gbp);
  let padIndex = 0;
  while (items.length < 3 && padIndex < padPool.length) {
    const candidate = padPool[padIndex++];
    if (!seen.has(candidate.value.toLowerCase())) {
      items.push(candidate);
      seen.add(candidate.value.toLowerCase());
    }
  }

  // Cap at 4 so the strip stays visually balanced (matches the schema max).
  strip.items = items.slice(0, 4);
  if (!strip.heading) strip.heading = `Why locals choose ${gbp.name}`;
}

/** True when the value looks like a bare number / percentage / star-count. */
function isBareNumericValue(v: string): boolean {
  const t = v.trim().replace(/\s+/g, " ");
  if (/^\d+(\.\d+)?$/.test(t)) return true; // "5", "4.9"
  if (/^\d+(\.\d+)?%$/.test(t)) return true; // "100%", "97.5%"
  if (/^\d+(\.\d+)?\s*(★|stars?)$/i.test(t)) return true; // "5 stars", "5★"
  if (/^\d+\+$/.test(t)) return true; // "500+" with no unit
  return false;
}

/**
 * Overwrite CTA labels AND hrefs deterministically. The LLM emits
 * incomplete labels ("Call The", "Book at The") and non-existent hrefs
 * ("/contact", "/book" — pages we never generate, so they 404). We ignore
 * anything the LLM produced and synthesise both fields from category rules +
 * GBP data. The homepage always has a `#contact` section anchor and always
 * has a `tel:` link when we have a phone number.
 */
function hardenCtas(phaseA: PhaseAResult, gbp: GbpData, category: string): void {
  const spec = ctaSpecForCategory(category);
  const telHref = gbp.phone ? `tel:${gbp.phone.replace(/[^+\d]/g, "")}` : "#contact";
  const hrefFor = (kind: CtaHrefKind): string => (kind === "phone" ? telHref : "#contact");

  // Home hero — primary + secondary.
  const hero = phaseA.home.hero;
  hero.cta_primary = { label: spec.primary.label, href: hrefFor(spec.primary.hrefKind) };
  hero.cta_secondary = { label: spec.secondary.label, href: hrefFor(spec.secondary.hrefKind) };

  // Contact-section CTA — visible on the homepage. Same rule: category verb.
  if (phaseA.home.contact) {
    phaseA.home.contact.cta = {
      label: spec.primary.label,
      href: hrefFor(spec.primary.hrefKind),
    };
  }

  // Offer band — the LLM usually writes "Claim offer"; keep the CTA action
  // consistent with the site verb.
  if (phaseA.home.offer) {
    phaseA.home.offer.cta = {
      label: spec.offer.label,
      href: hrefFor(spec.offer.hrefKind),
    };
  }
}

type CtaHrefKind = "phone" | "contact";

interface CtaSpec {
  primary: { label: string; hrefKind: CtaHrefKind };
  secondary: { label: string; hrefKind: CtaHrefKind };
  offer: { label: string; hrefKind: CtaHrefKind };
}

/**
 * The main verb pattern per category. "Book an appointment" is medical/allied;
 * trades work off calls + quotes; beauty and fitness both book but with
 * different framings (session vs class vs appointment).
 */
function ctaSpecForCategory(category: string): CtaSpec {
  switch (category) {
    case "beauty-aesthetics":
      return {
        primary: { label: "Book Now", hrefKind: "contact" },
        secondary: { label: "Call Now", hrefKind: "phone" },
        offer: { label: "Book Now", hrefKind: "contact" },
      };
    case "allied-health":
      return {
        primary: { label: "Book an Appointment", hrefKind: "contact" },
        secondary: { label: "Call Now", hrefKind: "phone" },
        offer: { label: "Book Now", hrefKind: "contact" },
      };
    case "fitness-wellness":
      return {
        primary: { label: "Book a Class", hrefKind: "contact" },
        secondary: { label: "Call Now", hrefKind: "phone" },
        offer: { label: "Claim Offer", hrefKind: "contact" },
      };
    case "trades":
    default:
      return {
        primary: { label: "Call Now", hrefKind: "phone" },
        secondary: { label: "Get a Quote", hrefKind: "contact" },
        offer: { label: "Get a Quote", hrefKind: "contact" },
      };
  }
}

/** Category-safe archetype menu used to pad an under-strength strip. */
function buildArchetypePool(gbp: GbpData): Array<{ id: string; value: string; label: string; icon: string }> {
  const suburb = gbp.suburb || "the local area";
  return [
    { id: "arch-local", value: "Locally owned", label: `Based in ${suburb}`, icon: "MapPin" },
    { id: "arch-response", value: "Same-day response", label: "Fast turnaround", icon: "Clock" },
    { id: "arch-licensed", value: "Fully insured", label: "Peace of mind", icon: "ShieldCheck" },
    { id: "arch-friendly", value: "No-nonsense pricing", label: "Quote up front", icon: "BadgeCheck" },
  ];
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

/**
 * Transient errors are worth retrying once. 529 Overloaded and 429 rate-limit
 * are Anthropic's own signals to back off briefly; timeouts are usually the
 * same class of thing. A single retry with a 2s pause converts most of these
 * into user-invisible blips without turning the pipeline into a retry loop.
 */
function isTransientClaudeError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  if (/http=(?:429|500|502|503|504|529)/i.test(message)) return true;
  if (/overloaded/i.test(message)) return true;
  if (/rate.?limit/i.test(message) && !/subscription.+rate.?limit/i.test(message)) return true;
  if (/timed out/i.test(message)) return true;
  return false;
}

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  jsonSchema: object,
): Promise<string> {
  try {
    return await callClaudeCli({ systemPrompt, userPrompt, model: MODEL, jsonSchema });
  } catch (err) {
    if (!isTransientClaudeError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[generator-api] transient Claude error, retrying once in 2s: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return callClaudeCli({ systemPrompt, userPrompt, model: MODEL, jsonSchema });
  }
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

/**
 * Walk a parsed JSON tree and:
 * - Delete any property whose value is null (Zod's .optional() rejects null,
 *   but the model often emits null for fields it has no data for).
 * - Synthesise an `id` for items in id-required arrays when missing.
 * - Wrap `home.service_area` if the model returned a bare array instead of
 *   the expected `{ suburbs: [...] }` object shape.
 */
function normalizeGenerationResponse(input: unknown): unknown {
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input)) {
    return input.map((v, i) => {
      const normalised = normalizeGenerationResponse(v);
      // Synthesise an id on items in arrays whose items normally need one,
      // covering services / locations / gallery / testimonials / social_proof
      // / about.values / faq items. Cheap: only fires if id is missing.
      if (
        normalised !== null &&
        typeof normalised === "object" &&
        !Array.isArray(normalised) &&
        !("id" in normalised)
      ) {
        (normalised as Record<string, unknown>).id = `item-${i + 1}`;
      }
      return normalised;
    });
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === null) continue;
    out[key] = normalizeGenerationResponse(value);
  }
  // home.service_area: if it came back as an array, wrap as { suburbs: [...] }.
  if ("home" in out && typeof out.home === "object" && out.home !== null) {
    const home = out.home as Record<string, unknown>;
    if (Array.isArray(home.service_area)) {
      home.service_area = { suburbs: home.service_area };
    }
  }
  return out;
}

/**
 * Ensure every seo block that was emitted has a `title`. The LLM often emits
 * `seo: {}` or `seo: { description: "..." }` for optional-seo pages (faq,
 * about) and required-seo detail blocks (services/locations). pageSeoSchema
 * requires `title`, so we synthesise one from the local context (business
 * name + heading/slug) when missing. Fully additive — never overwrites a real
 * title. This makes phase A/B/C bulletproof against the recurring
 * "seo.title: expected string, received undefined" failure without weakening
 * the schema.
 */
function ensureSeoTitles(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  const business = obj.business as Record<string, unknown> | undefined;
  const businessName =
    typeof business?.name === "string" && business.name.trim()
      ? business.name.trim()
      : "Our business";

  const patchSeo = (parent: Record<string, unknown>, fallback: string): void => {
    const seo = parent.seo;
    if (!seo || typeof seo !== "object" || Array.isArray(seo)) return;
    const s = seo as Record<string, unknown>;
    if (typeof s.title !== "string" || !s.title.trim()) {
      s.title = fallback;
    }
  };

  patchSeo(obj, businessName);
  if (obj.faq && typeof obj.faq === "object" && !Array.isArray(obj.faq)) {
    patchSeo(obj.faq as Record<string, unknown>, `FAQs | ${businessName}`);
  }
  if (obj.about && typeof obj.about === "object" && !Array.isArray(obj.about)) {
    patchSeo(obj.about as Record<string, unknown>, `About | ${businessName}`);
  }
  if (Array.isArray(obj.services)) {
    for (const item of obj.services) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const s = item as Record<string, unknown>;
      const label =
        (typeof s.title === "string" && s.title.trim()) ||
        (typeof s.slug === "string" && s.slug.trim()) ||
        "Service";
      patchSeo(s, `${label} | ${businessName}`);
    }
  }
  if (Array.isArray(obj.locations)) {
    for (const item of obj.locations) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const l = item as Record<string, unknown>;
      const label =
        (typeof l.suburb === "string" && l.suburb.trim()) ||
        (typeof l.slug === "string" && l.slug.trim()) ||
        "Location";
      patchSeo(l, `${label} | ${businessName}`);
    }
  }
  return obj;
}

/**
 * Ensure `home.about.values` and `about.values` are always arrays of exactly
 * three well-formed items. The schema demands `.min(3).max(3)`; the LLM
 * regularly omits the field, emits nulls, or ships the wrong count. Missing
 * entries are padded with category-agnostic defaults; extra entries are
 * dropped. Malformed items (missing id/title/body) are patched, not tossed,
 * so we never nuke real content the model did produce.
 */
function ensureAboutValues(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  const businessName =
    (typeof (obj.business as Record<string, unknown> | undefined)?.name === "string"
      ? ((obj.business as Record<string, unknown>).name as string).trim()
      : "") || "our team";

  const defaults = [
    {
      id: "value-local",
      title: "Locally trusted",
      body: `${businessName} lives and works in the community — we know the area and our neighbours know us.`,
      icon: "MapPin",
    },
    {
      id: "value-quality",
      title: "Quality that lasts",
      body: "We take pride in doing the job properly the first time, using the right tools and materials for lasting results.",
      icon: "BadgeCheck",
    },
    {
      id: "value-care",
      title: "Genuine care",
      body: "Every customer is treated the way we'd want our own family treated — clear communication, respect, and no surprises.",
      icon: "Heart",
    },
    {
      id: "value-honest",
      title: "Straight talk",
      body: "Fair pricing, upfront quotes, and honest advice — no upsells, no jargon, no waffle.",
      icon: "ShieldCheck",
    },
  ];

  const patchValues = (parent: Record<string, unknown>): void => {
    const rawArr = Array.isArray(parent.values) ? parent.values : [];
    const cleaned = rawArr
      .filter((v): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v))
      .map((v, i) => {
        const out = { ...v };
        if (typeof out.id !== "string" || !out.id.trim()) out.id = `value-${i + 1}`;
        if (typeof out.title !== "string" || !out.title.trim()) {
          out.title = (defaults[i] ?? defaults[0]).title;
        }
        if (typeof out.body !== "string" || !out.body.trim()) {
          out.body = (defaults[i] ?? defaults[0]).body;
        }
        if (typeof out.icon !== "string" || !out.icon.trim()) {
          out.icon = (defaults[i] ?? defaults[0]).icon;
        }
        return out;
      });

    // Pad from defaults, skipping ids we already have so we never duplicate.
    const seenIds = new Set(cleaned.map((v) => String(v.id)));
    let cursor = 0;
    while (cleaned.length < 3 && cursor < defaults.length) {
      const candidate = defaults[cursor++];
      if (seenIds.has(candidate.id)) continue;
      cleaned.push({ ...candidate });
      seenIds.add(candidate.id);
    }
    parent.values = cleaned.slice(0, 3);
  };

  const home = obj.home;
  if (home && typeof home === "object" && !Array.isArray(home)) {
    const about = (home as Record<string, unknown>).about;
    if (about && typeof about === "object" && !Array.isArray(about)) {
      patchValues(about as Record<string, unknown>);
    }
  }
  const aboutPage = obj.about;
  if (aboutPage && typeof aboutPage === "object" && !Array.isArray(aboutPage)) {
    patchValues(aboutPage as Record<string, unknown>);
  }
  return obj;
}

/**
 * Find the first balanced top-level JSON object (or array) in `s`, ignoring
 * any content that comes after it. Handles strings + escapes so braces inside
 * string values don't confuse the depth counter. Returns null if no balanced
 * object is found.
 */
function extractFirstJsonObject(s: string): string | null {
  // Find the first { or [
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{" || s[i] === "[") { start = i; break; }
  }
  if (start === -1) return null;

  const opener = s[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Walk a JSON string and escape any literal newlines / carriage returns / tabs
 * that appear INSIDE string values (where they're illegal in JSON). Outside
 * strings (whitespace between tokens) is left alone. Used as a salvage step
 * because the model occasionally emits multi-line paragraph copy without
 * escaping the line breaks.
 */
function escapeUnquotedControlChars(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  return out;
}

/**
 * Generic zod-schema validator. Tries plain JSON.parse first, then a salvage
 * pass that escapes literal newlines/tabs inside string values, then parses
 * against the supplied schema. Returns the typed data on success.
 */
async function runPhaseA(
  systemPrompt: string,
  gbp: GbpData,
  previousErrors: string | null,
): Promise<{ ok: true; data: PhaseAResult } | { ok: false; errors: string }> {
  const baseMessage = buildPhaseAMessage(gbp);
  const message = previousErrors
    ? `${baseMessage}

## RETRY — your previous attempt failed schema validation

Fix these specific errors and return the corrected object. Do not omit required fields.

${previousErrors}`
    : baseMessage;
  const raw = await callClaude(systemPrompt, message, PHASE_A_JSON_SCHEMA);
  const result = parseAndValidateAgainst(raw, phaseAGenerationSchema);
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, errors: result.errors };
}

function parseAndValidateAgainst<T>(
  raw: string,
  schema: z.ZodType<T>,
): { ok: true; data: T } | { ok: false; errors: string; cleaned: string } {
  const cleaned = stripFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (firstErr) {
    // Salvage 1: escape literal control chars inside string values.
    try {
      parsed = JSON.parse(escapeUnquotedControlChars(cleaned));
      console.warn("[generator-api] salvaged JSON by escaping unquoted control chars.");
    } catch {
      // Salvage 2: model emitted extra prose / a second object after the first
      // valid one. Find the first balanced object and parse only that.
      const extracted = extractFirstJsonObject(cleaned);
      if (extracted) {
        try {
          parsed = JSON.parse(extracted);
          console.warn(
            `[generator-api] salvaged JSON by extracting first balanced object (${cleaned.length - extracted.length} trailing chars dropped).`
          );
        } catch {
          return {
            ok: false,
            errors: `JSON parse error: ${firstErr instanceof Error ? firstErr.message : String(firstErr)}`,
            cleaned,
          };
        }
      } else {
        return {
          ok: false,
          errors: `JSON parse error: ${firstErr instanceof Error ? firstErr.message : String(firstErr)}`,
          cleaned,
        };
      }
    }
  }
  const normalised = ensureAboutValues(ensureSeoTitles(normalizeGenerationResponse(parsed)));
  const result = schema.safeParse(normalised);
  if (result.success) return { ok: true, data: result.data };
  const errors = result.error.issues
    .map((e) => `${String(e.path.join("."))}: ${e.message}`)
    .join("\n");
  return { ok: false, errors, cleaned };
}

/** Shared business-context block used by all three phase prompts. */
function businessBlock(gbp: GbpData): string {
  const reviewsText = gbp.reviews
    .map((r, i) => `Review ${i + 1} (${r.rating}/5, ${r.author}): "${r.text}"`)
    .join("\n");
  return `Business: ${gbp.name}
Niche: ${gbp.niche}
Location: ${gbp.suburb}, ${gbp.state}
Phone: ${gbp.phone}
Address: ${gbp.address}
Description: ${gbp.description}
Services: ${gbp.services.join(", ") || "(see niche)"}
Reviews:
${reviewsText}`;
}

const JSON_VALIDITY_RULE = `## JSON VALIDITY — critical rule

String values MUST be valid JSON strings:
- Line breaks inside paragraphs MUST be \\n, NEVER a literal newline.
- Embedded double quotes MUST be escaped as \\", NEVER bare ".
- Tabs MUST be \\t.`;

function buildPhaseAMessage(gbp: GbpData): string {
  return `You are generating PHASE A of a 3-phase site build: the homepage + page-skeleton stubs. A follow-up call will expand each service/location into a detail page — DO NOT generate intro/benefits/faqs/seo for individual services or locations here.

${businessBlock(gbp)}

${JSON_VALIDITY_RULE}

## What to produce

- \`business\`, \`branding\` (colours; OMIT logo_url and hero_image_url — we fill them)
- \`home\` — full homepage with:
  - hero (headline, subheadline, cta_primary, cta_secondary)
  - services (4 overview cards, each: id, title, description, icon, starting_price?)
  - about (heading, body 2+ paragraphs, values[] 3 items, OMIT photo_url/years/licence)
  - service_area (4–6 real nearby suburbs)
  - gallery (4–6 items with id + caption + alt; OMIT image_url)
  - testimonials (3–4 items from real reviews above; id/quote/author)
  - social_proof.items (3–4 items, EACH with a meaningful label — e.g. \`{value:"5,000+", label:"Jobs completed", icon:"Star"}\`)
  - contact (heading, phone, address; hours[] exactly 7 entries, one per day with {label, value}; OMIT email)
- \`services\` — exactly 4 STUB entries: \`{slug, title, summary, icon?}\` only. NO intro, benefits, faqs, seo.
- \`locations\` — exactly 4 STUB entries: \`{slug, suburb, state}\` only. Use real nearby suburbs.
- \`service_areas\` — empty array \`[]\`
- \`faq\` — site-wide FAQ with 4–6 items
- \`about\` page — heading, body, values[] 3 items

## EXACT FIELD SHAPES — case-sensitive, schema rejects deviations

\`home.services\`, \`home.gallery\`, and \`services\` are ARRAYS \`[]\` of objects. Never emit them as an object \`{}\` keyed by slug or id. If you need to reference them by key elsewhere in your response, do so from an array with an \`id\` or \`slug\` field on each item — the container is always an array.

\`home.about.values[]\` items MUST use these exact keys:
  \`{ "id": "value-trust", "title": "Trust", "body": "We do what we say.", "icon": "Shield" }\`
  Not "name"/"description"/"text" — must be \`id\` + \`title\` + \`body\` (+ optional \`icon\`).

\`about.values[]\` items use the same shape as above.

\`home.social_proof\` is an OBJECT containing an \`items\` array:
  \`{ "heading": "Trusted by ...", "items": [ { "id": "proof-1", "value": "Locally owned", "label": "Based in Bondi", "icon": "MapPin" }, ... ] }\`
  Every item MUST have \`id\`, \`value\`, and \`label\`.

  **USP quality rules — non-negotiable, filtered post-generation.**
  - \`value\` MUST be a self-contained PHRASE, never a bare number, percentage, or star count.
    - BANNED values: \`"5 stars"\`, \`"100%"\`, \`"5.0"\`, \`"24/7"\`, \`"500+"\` (with no unit).
    - REQUIRED shape: a short claim the visitor can read on its own — \`"Locally owned"\`, \`"Same-day response"\`, \`"Fully insured"\`, \`"20+ years in Bondi"\`.
  - \`label\` MUST add real context, not repeat the value. \`"Rating"\`, \`"Stars"\`, \`"Success"\` on their own are useless.
  - Pick 3 items from this ARCHETYPE MENU (or something clearly in the same spirit — grounded, specific, verifiable):
    1. \`"Locally owned"\` / \`"Family owned"\` — label: which suburb.
    2. \`"Serving <suburb> since <year>"\` — ONLY if a year is derivable from reviews or description.
    3. \`"Fully licensed"\` / \`"Fully insured"\` / \`"AHPRA registered"\` — pick whichever applies to the niche; label something concrete like \`"Peace of mind"\` or \`"Nationally recognised"\`.
    4. \`"Same-day appointments"\` / \`"After-hours available"\` — label: which service window.
    5. \`"<n>+ years experience"\` — ONLY if grounded in the description.
  - Do NOT invent Google ratings — the code injects the real one deterministically from the Business Profile. Skip that archetype entirely.

\`home.service_area\` is an OBJECT, not an array:
  \`{ "heading": "Areas we service", "intro": "...", "suburbs": ["Bondi", "Surry Hills", ...] }\`
  NOT \`["Bondi", "Surry Hills", ...]\` directly.

\`home.contact.hours[]\` entries:
  \`{ "label": "Monday", "value": "7am – 6pm" }\` — NOT "day"/"hours".

CTA objects use \`{ "label": "...", "href": "..." }\` — NOT text/url.

\`benefits[]\` arrays are PLAIN STRINGS, not objects. \`about.values[]\` are objects.

## OMIT — do not output null

If you have no real value for an optional field, OMIT it entirely. Do NOT emit \`null\`, \`""\`, or "TBD". The schema rejects null on optional fields.

Examples to OMIT entirely:
- \`branding.logo_url\`, \`branding.hero_image_url\` (we fill these)
- \`home.services[].starting_price\` (omit unless the business publishes prices)
- \`home.offer\` (omit the whole block unless you have a real offer)
- \`business.email\`, \`home.contact.email\`
- \`overrides\` (omit; the customer sets these later)

## SEO blocks — non-negotiable

Any \`seo\` block you emit MUST include a non-empty \`title\` string. If you output \`seo\` on \`faq\`, \`about\`, or the root, it must be \`{"title": "..."}\` at minimum. Either include a real title or OMIT the whole \`seo\` block. Never emit \`seo: {}\`.

## Other rules

- Australian English. Real suburb names that genuinely surround the business address.
- Never fabricate licence numbers, ABNs, ratings, review counts, or URLs.

Output the JSON object now.`;
}

function buildPhaseBMessage(gbp: GbpData, phaseA: PhaseAResult): string {
  const stubs = phaseA.services
    .map((s) => `- slug: "${s.slug}" — ${s.title}: ${s.summary}`)
    .join("\n");
  return `You are generating PHASE B of a 3-phase site build: detail content for the 4 service-detail pages whose stubs were produced in phase A.

${businessBlock(gbp)}

## Service stubs from phase A

${stubs}

${JSON_VALIDITY_RULE}

## What to produce

Return exactly one object: \`{ "services": [ ...4 detail blocks... ] }\`.

Each detail block has:
- \`slug\` — MUST match one of the stubs above, exactly.
- \`intro\` — 1 short paragraph, 40–60 words, specific to THIS service. Mention the business name or location naturally.
- \`benefits\` — exactly 3 plain-string benefit lines (NOT objects).
- \`faqs\` — exactly 2 items, each \`{id, question, answer}\`. Use id format \`faq-<service-slug>-<n>\`.
- \`seo\` — \`{title, description?, schema_org_type?}\`. \`title\` MUST be a non-empty string, e.g. \`"<Service Title> in <Suburb> | <Business Name>"\`. Never emit \`seo: {}\`.

## Rules

- Each service intro must be genuinely distinct — no copy-paste paragraphs across services.
- Australian English. Plain spoken. No "passionate"/"dedicated"/"bespoke".
- Do NOT invent prices unless the business stated them.

Output the JSON object now.`;
}

function buildPhaseCMessage(gbp: GbpData, phaseA: PhaseAResult): string {
  const stubs = phaseA.locations
    .map((l) => `- slug: "${l.slug}" — ${l.suburb}${l.state ? ` (${l.state})` : ""}`)
    .join("\n");
  return `You are generating PHASE C of a 3-phase site build: detail content for the 4 location pages whose stubs were produced in phase A.

${businessBlock(gbp)}

## Location stubs from phase A

${stubs}

${JSON_VALIDITY_RULE}

## What to produce

Return exactly one object: \`{ "locations": [ ...4 detail blocks... ] }\`.

Each detail block has:
- \`slug\` — MUST match one of the stubs above, exactly.
- \`intro\` — 1 short paragraph, 40–60 words, specific to THIS suburb. Reference real local features (streets, landmarks, retail strip, café culture) that genuinely apply to that suburb.
- \`benefits\` — exactly 3 plain-string benefit lines.
- \`faqs\` — exactly 1 item \`{id, question, answer}\`. Use id format \`faq-<suburb-slug>-1\`.
- \`seo\` — \`{title, description?, schema_org_type?}\`. \`title\` MUST be a non-empty string, e.g. \`"<Niche> in <Suburb> | <Business Name>"\`. Never emit \`seo: {}\`.

## Rules

- Each location intro must reference genuinely distinct local context — no two locations sharing the same landmarks or phrasing.
- Australian English.

Output the JSON object now.`;
}
