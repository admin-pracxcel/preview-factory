#!/usr/bin/env node
/**
 * scripts/outreach.mjs
 * Phase M — Outreach engine (LOCAL-ONLY research/batch tool)
 *
 * -----------------------------------------------------------------------------
 * NOTE (post-Phase-3): This script still writes tenant records to
 * data/tenants/<uuid>.json (the legacy file store). After Phase 3 the app
 * reads from Supabase, not disk — so tenants written here are invisible to
 * `next dev` until you migrate them. Two options:
 *
 *   1. After a batch, run:  node scripts/migrate-local-tenants.mjs
 *      which pushes new data/tenants/*.json rows into Supabase.
 *   2. Port saveTenantFile() below to insert directly into Supabase (same
 *      shape as scripts/migrate-local-tenants.mjs). Only worth doing if you
 *      run this at scale post-launch.
 *
 * For occasional cold-outreach batches, option 1 is fine.
 * -----------------------------------------------------------------------------
 *
 * Batch-generates preview websites for local businesses in a given niche + suburb list.
 * Outputs a CSV of preview links ready for cold outreach. No real sends — this is the
 * pipeline proof and the batch artefact you hand to the outreach tool (n8n, Instantly, etc).
 *
 * Usage:
 *   node scripts/outreach.mjs
 *   node scripts/outreach.mjs --niche plumber --suburbs "Fitzroy,Collingwood,Richmond"
 *   node scripts/outreach.mjs --niche electrician --suburbs "Parramatta,Penrith" --state NSW --max 3
 *
 * Env vars (all optional — fixture fallbacks run without any keys):
 *   GOOGLE_PLACES_API_KEY     — enables real Places API text search
 *   ANTHROPIC_API_KEY         — bills the Anthropic API per token. If unset,
 *                               the Agent SDK falls back to your local `claude`
 *                               CLI login and bills your Claude Code subscription.
 *   USE_FIXTURE=1             — force fixture site generation (no model call)
 *   N8N_OUTREACH_WEBHOOK_URL  — if set, fires a stub POST with preview links
 *   NEXT_PUBLIC_BASE_URL      — base URL for preview links (default: http://localhost:3000)
 *
 * Deploy note: set all four env vars above on your production server.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/* ─────────────────────────────────────────── CLI arg parsing ── */

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : null;
  };
  return {
    niche:        get("--niche")   ?? "plumber",
    suburbs:      (get("--suburbs") ?? "Fitzroy,Collingwood,Richmond,South Yarra,Northcote")
                    .split(",").map(s => s.trim()).filter(Boolean),
    state:        get("--state")   ?? "VIC",
    maxPerSuburb: Number(get("--max") ?? "2"),
    /** --fixture forces fixture site generation regardless of ANTHROPIC_API_KEY */
    forceFixture: argv.includes("--fixture"),
  };
}

/* ─────────────────────────────────── niche → category mapping ── */

function nicheToCategory(niche) {
  const n = niche.toLowerCase().replace(/[\s_]+/g, "-");
  if (["physiotherapy","physio","occupational-therapy","speech-pathology",
       "speech-therapy","dietetics","dietitian","podiatry","podiatrist",
       "osteopathy","osteopath"].includes(n)) return "allied-health";
  if (["hairdresser","hair-salon","hair-stylist","beauty-clinic","beauty-salon",
       "nail-bar","nail-salon","lash-studio","brow-bar","makeup-artist","beauty"].includes(n))
    return "beauty-aesthetics";
  if (["personal-trainer","personal-training","gym","fitness-studio","yoga",
       "pilates","crossfit","box","boxing","fitness","wellness","group-fitness"].includes(n))
    return "fitness-wellness";
  return "trades";
}

/* ───────────────────────── Fixture business data (no Places API) ── */

const FIXTURE_BUSINESSES = {
  plumber: [
    { name: "Fitzroy Plumbing Co",            phone: "03 9111 2222", suburb: "Fitzroy",      description: "Local plumbing for Fitzroy homes and businesses. Leaks, hot water, drains." },
    { name: "Collingwood Pipes & Drains",      phone: "03 9222 3333", suburb: "Collingwood",  description: "Residential and commercial plumbing in Collingwood. Blocked drains a speciality." },
    { name: "Richmond Hot Water Specialists",  phone: "03 9333 4444", suburb: "Richmond",     description: "Hot water systems, gas fitting, and general plumbing across Richmond." },
    { name: "South Yarra Plumbing Services",   phone: "03 9444 5555", suburb: "South Yarra",  description: "Premium plumbing for South Yarra homes. Renovations and emergency repairs." },
    { name: "Northcote Drain Masters",         phone: "03 9555 6666", suburb: "Northcote",    description: "Blocked drain experts. CCTV drain inspection across Northcote and surrounds." },
  ],
  electrician: [
    { name: "Parramatta Electrical Services",  phone: "02 8111 2222", suburb: "Parramatta",   description: "Licensed electricians for homes and businesses across Parramatta." },
    { name: "Penrith Power Solutions",         phone: "02 8222 3333", suburb: "Penrith",      description: "Electrical installations, switchboard upgrades, and repairs in Penrith." },
    { name: "Blacktown Electrical Co",         phone: "02 8333 4444", suburb: "Blacktown",    description: "Full electrical services — new builds, renovations, emergency callouts in Blacktown." },
    { name: "Castle Hill Sparks",              phone: "02 8444 5555", suburb: "Castle Hill",  description: "Trusted electricians for Castle Hill homes and commercial properties." },
    { name: "St Marys Electrical Group",       phone: "02 8555 6666", suburb: "St Marys",     description: "Affordable electrical work in St Marys. Solar, EV chargers, and more." },
  ],
  hairdresser: [
    { name: "Fitzroy Hair Studio",             phone: "03 9111 7777", suburb: "Fitzroy",      description: "Creative cuts and colour in Brunswick St, Fitzroy. Walk-ins welcome." },
    { name: "Richmond Salon Co",               phone: "03 9222 8888", suburb: "Richmond",     description: "Boutique hair salon on Swan St, Richmond. Balayage and keratin specialists." },
    { name: "South Yarra Hair Bar",            phone: "03 9333 9999", suburb: "South Yarra",  description: "Premium hair care in the heart of South Yarra. Trichology consultations." },
    { name: "Collingwood Cut & Colour",        phone: "03 9444 1111", suburb: "Collingwood",  description: "Edgy cuts and vibrant colour in Collingwood. Vegan products only." },
    { name: "Northcote Fringe Salon",          phone: "03 9555 2222", suburb: "Northcote",    description: "Family-owned salon in Northcote. Kids cuts, blowouts, and treatments." },
  ],
  physiotherapy: [
    { name: "Fitzroy Physiotherapy Centre",    phone: "03 9111 3333", suburb: "Fitzroy",      description: "AHPRA-registered physios in Fitzroy. Sports injuries, post-surgery rehab." },
    { name: "Richmond Physio & Rehab",         phone: "03 9222 4444", suburb: "Richmond",     description: "Evidence-based physiotherapy in Richmond. Online bookings available." },
    { name: "Northcote Allied Health",         phone: "03 9333 5555", suburb: "Northcote",    description: "Physio, massage, and exercise physiology in Northcote." },
  ],
  "personal-trainer": [
    { name: "Fitzroy Fit Studio",              phone: "03 9111 4444", suburb: "Fitzroy",      description: "Personal training and group classes in Fitzroy. Strength, HIIT, yoga." },
    { name: "Richmond Performance Training",   phone: "03 9222 5555", suburb: "Richmond",     description: "One-on-one and small group training in Richmond. Beginners welcome." },
    { name: "South Yarra PT Co",               phone: "03 9333 6666", suburb: "South Yarra",  description: "In-home and outdoor personal training across South Yarra." },
  ],
};

// Generic fixture for niches not in the list above
function genericFixture(niche, suburb, state) {
  return [
    {
      name: `${suburb} ${capitalise(niche)} Services`,
      phone: "03 9100 0001",
      suburb,
      description: `Professional ${niche} services in ${suburb}, ${state}. Locally owned and operated.`,
    },
    {
      name: `${suburb} ${capitalise(niche)} Co`,
      phone: "03 9100 0002",
      suburb,
      description: `Trusted ${niche} provider in ${suburb}. Free quotes, fast response.`,
    },
  ];
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fixtureBusinessesFor(niche, suburb, state, max) {
  const nicheKey = niche.toLowerCase();
  const pool = FIXTURE_BUSINESSES[nicheKey] ?? genericFixture(niche, suburb, state);
  // Filter by suburb if possible, else adapt the first N entries
  const bySuburb = pool.filter(b => b.suburb?.toLowerCase() === suburb.toLowerCase());
  const source = bySuburb.length > 0 ? bySuburb : pool.slice(0, max).map(b => ({
    ...b,
    name: b.name.replace(b.suburb ?? suburb, suburb),
    suburb,
    address: `${suburb}, ${state}`,
  }));
  return source.slice(0, max).map(b => ({
    name: b.name,
    phone: b.phone,
    suburb,
    state,
    address: b.address ?? `${suburb}, ${state}`,
    description: b.description,
    services: [],
    reviews: [],
    niche,
    source: "fixture",
  }));
}

/* ──────────────────────────────────────── Places API search ── */

async function searchPlacesApi(niche, suburb, state, max, apiKey) {
  const query = `${niche} in ${suburb} ${state} Australia`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.editorialSummary,places.id",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: max }),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.places ?? []).slice(0, max).map(p => ({
    name: p.displayName?.text ?? "Unknown Business",
    phone: p.nationalPhoneNumber ?? "",
    suburb,
    state,
    address: p.formattedAddress ?? `${suburb}, ${state}`,
    description: p.editorialSummary?.text ?? `Local ${niche} in ${suburb}, ${state}.`,
    services: [],
    reviews: [],
    niche,
    placeId: p.id,
    source: "places-api",
  }));
}

async function searchBusinesses(niche, suburb, state, max, apiKey) {
  if (apiKey) {
    try {
      return await searchPlacesApi(niche, suburb, state, max, apiKey);
    } catch (err) {
      console.warn(`  [places] API error for ${suburb}: ${err.message.slice(0,80)}. Falling back to fixture.`);
    }
  }
  return fixtureBusinessesFor(niche, suburb, state, max);
}

/* ──────────────────────────────────────── Site generation ── */

function loadFixtureSiteProps() {
  const path = join(ROOT, "generator", "output", "clearflow-plumbing.json");
  if (!existsSync(path)) {
    throw new Error(
      "Fixture file missing at generator/output/clearflow-plumbing.json.\n" +
      "Run: node generator/run.mjs  (requires ANTHROPIC_API_KEY)"
    );
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Adapt the Clearflow fixture to a different business without API spend. */
function adaptFixtureSite(fixture, biz) {
  const adapted = JSON.parse(JSON.stringify(fixture));
  adapted.business.name    = biz.name;
  adapted.business.suburb  = biz.suburb;
  adapted.business.state   = biz.state;
  if (biz.phone)   adapted.business.phone   = biz.phone;
  if (biz.address) adapted.business.address = biz.address;
  if (adapted.home?.hero) {
    adapted.home.hero.headline = `${biz.niche.charAt(0).toUpperCase() + biz.niche.slice(1)} in ${biz.suburb} — ${biz.name}`;
    adapted.home.hero.subheadline = biz.description ?? `Trusted local ${biz.niche} serving ${biz.suburb} and surrounds.`;
  }
  return adapted;
}

// Set by main() when --fixture flag is present
let _forceFixture = false;

/**
 * Single-shot text completion via the Claude Agent SDK.
 * Auth: ANTHROPIC_API_KEY → API billing; otherwise local `claude` CLI login
 * → Claude Code subscription billing.
 */
async function callClaudeAgent(systemPrompt, userPrompt) {
  let collected = "";
  for await (const msg of query({
    prompt: userPrompt,
    options: {
      model: "claude-sonnet-4-6",
      systemPrompt,
      tools: [],
      maxTurns: 1,
      settingSources: [],
      permissionMode: "bypassPermissions",
    },
  })) {
    if (msg.type === "assistant") {
      for (const block of msg.message?.content ?? []) {
        if (block.type === "text" && typeof block.text === "string") {
          collected += block.text;
        }
      }
    }
  }
  if (!collected.trim()) {
    throw new Error(
      "Claude Agent SDK returned no text. Check ANTHROPIC_API_KEY or that `claude` CLI is logged in."
    );
  }
  return collected;
}

async function generateSiteProps(biz) {
  if (_forceFixture || process.env.USE_FIXTURE === "1") {
    // Fixture path: adapt Clearflow site to this business
    return adaptFixtureSite(loadFixtureSiteProps(), biz);
  }

  // Real generation via Claude
  const category = nicheToCategory(biz.niche);
  let systemPrompt;
  const promptPath = join(ROOT, "templates", "categories", category, "system-prompt.md");
  try {
    systemPrompt = readFileSync(promptPath, "utf8");
  } catch {
    systemPrompt = readFileSync(
      join(ROOT, "templates", "categories", "trades", "system-prompt.md"), "utf8"
    );
  }

  const userMsg = `Generate a complete SiteProps JSON for this Australian business. Respond with ONLY valid JSON — no prose, no fences.

Business: ${biz.name}
Niche: ${biz.niche}
Location: ${biz.suburb}, ${biz.state}
Phone: ${biz.phone}
Address: ${biz.address}
Description: ${biz.description}

Requirements (must pass automated grader):
- services[] >= 4 pages, each: slug, title, intro (60+ words), benefits[], sections[], faqs[]
- locations[] >= 6 pages, each: slug, suburb, intro (60+ words), benefits[], sections[], faqs[]
- service_areas[] >= 3 pages, each: slug, headline, body (60+ words), benefits[], sections[], faqs[]
- Australian English and AUD throughout
- contact.hours entries must use { "label": "...", "value": "..." } format
- faq items must have an "id" field`;

  const raw = await callClaudeAgent(systemPrompt, userMsg);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

/* ──────────────────────────────────────── Tenant store ── */

function saveTenantFile(tenantId, record) {
  const dir = join(ROOT, "data", "tenants");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${tenantId}.json`), JSON.stringify(record, null, 2), "utf8");
}

/* ──────────────────────────────────────── CSV helpers ── */

function csvEscape(val) {
  const s = String(val ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function csvRow(cols) {
  return cols.map(csvEscape).join(",");
}

/* ──────────────────────────────────────── n8n stub ── */

async function fireN8nWebhook(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log(`  [n8n] POST ${url} → ${res.status}`);
}

/* ──────────────────────────────────────── Main ── */

async function main() {
  const { niche, suburbs, state, maxPerSuburb, forceFixture } = parseArgs();
  _forceFixture = forceFixture;
  const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const placesKey = process.env.GOOGLE_PLACES_API_KEY ?? null;
  const n8nUrl    = process.env.N8N_OUTREACH_WEBHOOK_URL ?? null;

  console.log("\n┌──────────────────────────────────────────────────┐");
  console.log("│         Preview Factory — Outreach Engine         │");
  console.log("└──────────────────────────────────────────────────┘");
  console.log(`  Niche:         ${niche}`);
  console.log(`  Suburbs:       ${suburbs.join(", ")}`);
  console.log(`  State:         ${state}`);
  console.log(`  Max/suburb:    ${maxPerSuburb}`);
  console.log(`  Places API:    ${placesKey ? "real (GOOGLE_PLACES_API_KEY set)" : "FIXTURE (no key — set GOOGLE_PLACES_API_KEY for real)"}`);
  const useFixtureGen = forceFixture || process.env.USE_FIXTURE === "1";
  const generatorMode = useFixtureGen
    ? `FIXTURE (${forceFixture ? "--fixture flag" : "USE_FIXTURE=1"})`
    : process.env.ANTHROPIC_API_KEY
      ? "real (ANTHROPIC_API_KEY — bills Anthropic API)"
      : "real (Claude Code subscription — `claude` CLI login)";
  console.log(`  Generator:     ${generatorMode}`);
  console.log(`  n8n webhook:   ${n8nUrl ?? "not configured (stub payload written to file)"}`);
  console.log(`  Base URL:      ${baseUrl}`);

  // Create output directory
  const now = new Date();
  const runId = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = join(ROOT, "data", "outreach", `run-${runId}`);
  mkdirSync(outDir, { recursive: true });

  const results = [];

  // ── Process each suburb ──
  for (const suburb of suburbs) {
    console.log(`\n→ ${suburb}, ${state} — searching for ${niche}...`);

    let businesses;
    try {
      businesses = await searchBusinesses(niche, suburb, state, maxPerSuburb, placesKey);
    } catch (err) {
      console.error(`  ✗ Search failed: ${err.message.slice(0, 100)}`);
      continue;
    }
    console.log(`  Found ${businesses.length} business(es).`);

    for (const biz of businesses) {
      process.stdout.write(`  Generating: "${biz.name}" ... `);
      try {
        const siteProps = await generateSiteProps(biz);
        const tenantId  = crypto.randomUUID();
        const category  = nicheToCategory(niche);

        const tenantRecord = {
          id: tenantId,
          name: biz.name,
          niche,
          category,
          siteProps,
          createdAt: now.toISOString(),
          status: "preview",
          ...(biz.placeId ? { placeId: biz.placeId } : {}),
        };

        saveTenantFile(tenantId, tenantRecord);

        const previewUrl = `${baseUrl}/preview/site/${tenantId}`;
        console.log(`✓`);
        console.log(`    tenant: ${tenantId}`);
        console.log(`    url:    ${previewUrl}`);

        results.push({
          business_name: biz.name,
          niche,
          suburb,
          state,
          phone:       biz.phone,
          tenant_id:   tenantId,
          preview_url: previewUrl,
          source:      biz.source,
          generated_at: now.toISOString(),
          status:      "generated",
          error:       "",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`✗`);
        console.log(`    error: ${msg.slice(0, 80)}`);
        results.push({
          business_name: biz.name,
          niche,
          suburb,
          state,
          phone:       biz.phone,
          tenant_id:   "",
          preview_url: "",
          source:      biz.source ?? "unknown",
          generated_at: now.toISOString(),
          status:      "error",
          error:       msg.slice(0, 120),
        });
      }
    }
  }

  const generated = results.filter(r => r.status === "generated");
  const errors    = results.filter(r => r.status !== "generated");

  // ── Write CSV ──
  const CSV_COLS = ["business_name","niche","suburb","state","phone","tenant_id","preview_url","source","generated_at","status","error"];
  const csvContent = [
    csvRow(CSV_COLS),
    ...results.map(r => csvRow(CSV_COLS.map(k => r[k] ?? ""))),
  ].join("\n") + "\n";

  const csvPath = join(outDir, "results.csv");
  writeFileSync(csvPath, csvContent, "utf8");

  // ── Write JSON report ──
  const report = {
    run_id:          runId,
    niche,
    suburbs,
    state,
    max_per_suburb:  maxPerSuburb,
    base_url:        baseUrl,
    fixture_mode: {
      places:    !placesKey,
      generator: useFixtureGen,
    },
    summary: {
      total_searched: suburbs.length * maxPerSuburb,
      total_generated: generated.length,
      total_errors:    errors.length,
    },
    results,
  };
  const reportPath = join(outDir, "report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  // ── n8n stub webhook ──
  const n8nPayload = {
    run_id:   runId,
    niche,
    state,
    total_generated: generated.length,
    preview_links: generated.map(r => ({
      business:    r.business_name,
      suburb:      r.suburb,
      phone:       r.phone,
      preview_url: r.preview_url,
      tenant_id:   r.tenant_id,
    })),
  };

  if (n8nUrl) {
    console.log("\n→ Firing n8n outreach webhook...");
    try {
      await fireN8nWebhook(n8nUrl, n8nPayload);
    } catch (err) {
      console.warn(`  [n8n] Error: ${err.message}`);
    }
  } else {
    const stubPath = join(outDir, "n8n-stub-payload.json");
    writeFileSync(stubPath, JSON.stringify(n8nPayload, null, 2), "utf8");
  }

  // ── Summary ──
  console.log("\n┌──────────────────────────────────────────────────┐");
  console.log("│                   Run complete                    │");
  console.log("└──────────────────────────────────────────────────┘");
  console.log(`  Generated:  ${generated.length} preview sites`);
  console.log(`  Errors:     ${errors.length}`);
  console.log(`\n  Output:`);
  console.log(`    CSV:      ${csvPath}`);
  console.log(`    Report:   ${reportPath}`);
  if (!n8nUrl) {
    console.log(`    n8n stub: ${join(outDir, "n8n-stub-payload.json")}`);
  }

  if (generated.length > 0) {
    console.log(`\n  Preview URLs (share these with prospects):`);
    for (const r of generated) {
      const pad = Math.min(r.business_name.length, 38);
      console.log(`    ${r.business_name.padEnd(pad)}  ${r.preview_url}`);
    }
  }

  console.log("\n  ── Deploy notes ──────────────────────────────────────");
  console.log("  To use real data, set these env vars:");
  console.log("    GOOGLE_PLACES_API_KEY     — Google Places API (New) key");
  console.log("    ANTHROPIC_API_KEY         — optional: bills Anthropic API.");
  console.log("                                If unset, the Agent SDK uses your");
  console.log("                                local `claude` CLI login (subscription).");
  console.log("    USE_FIXTURE=1             — bypass model, use fixtures only");
  console.log("    N8N_OUTREACH_WEBHOOK_URL  — your n8n webhook URL");
  console.log("    NEXT_PUBLIC_BASE_URL      — your production base URL");
  console.log("  ──────────────────────────────────────────────────────\n");
}

main().catch(err => {
  console.error("\nOutreach engine fatal error:", err.message ?? err);
  process.exit(1);
});
