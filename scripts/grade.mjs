#!/usr/bin/env node
// Preview Factory grader.
//
// The machine-checkable quality bar. A generated site (or a category's example
// data) PASSES only if every check passes. The agents run this and must revise
// until it is green before marking any unit done. You never see the passes;
// you only get pulled in for the things a machine cannot judge (does it look
// good to a real tradie), which are decision gates, not grader checks.
//
// Usage:
//   node scripts/grade.mjs                      # grades every example-data/*.json
//   node scripts/grade.mjs path/to/site.json    # grades one site
//   AUTOPILOT_SKIP_BUILD=1 node scripts/grade.mjs   # skip `next build` (Mac/lightningcss)
//
// Build note: run the build check on linux (your Hetzner box). The local Mac
// build currently bus-errors on Tailwind v4 / lightningcss, which is a real
// toolchain issue, not a code issue. Do not skip the build on the deploy target.

import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const OUT = join(REPO, "autopilot/state");

// thresholds (tune in one place)
const MIN = { services: 4, locations: 6, service_areas: 3, body_words: 60 };
const DUP_SIMILARITY = 0.82; // location/area pages above this are "thin / near-duplicate"

const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

// ---- find target site JSON files
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (n.endsWith(".json")) acc.push(p);
  }
  return acc;
}
const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const targets = args.length ? args : walk(join(REPO, "templates/categories")).filter((p) => p.includes("example-data"));
if (!targets.length) { console.log("grader: no target site JSON found. Nothing to grade."); process.exit(0); }

// ---- text helpers for thin-content detection
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const shingles = (s, k = 3) => {
  const w = norm(s).split(" ").filter(Boolean);
  const set = new Set();
  for (let i = 0; i + k <= w.length; i++) set.add(w.slice(i, i + k).join(" "));
  return set;
};
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};
const pageText = (p) =>
  [p.intro, p.headline, ...(p.sections || []).map((s) => `${s.heading || ""} ${s.body || ""}`),
   ...(p.benefits || []), ...(p.faqs || []).map((f) => `${f.question} ${f.answer}`)].join(" ");

// ---- per-site checks
function gradeSite(file) {
  let site;
  try { site = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { fail(`${file}: invalid JSON (${e.message})`); return; }
  const tag = file.replace(REPO + "/", "");

  // business / NAP present
  const b = site.business || {};
  if (!b.name) fail(`${tag}: business.name missing`);
  if (!b.phone) fail(`${tag}: business.phone missing (NAP)`);
  if (!b.address && !site.home?.service_area) warn(`${tag}: no address and no service_area`);

  // page-count floors (programmatic SEO needs depth)
  const services = site.services || [];
  const locations = site.locations || [];
  const areas = site.service_areas || [];
  if (services.length < MIN.services) fail(`${tag}: only ${services.length} service pages (min ${MIN.services})`);
  if (locations.length < MIN.locations) fail(`${tag}: only ${locations.length} location pages (min ${MIN.locations})`);
  if (areas.length < MIN.service_areas) fail(`${tag}: only ${areas.length} service-area pages (min ${MIN.service_areas})`);
  if (!site.faq) warn(`${tag}: no FAQ page (FAQPage schema is an AI-overview citation surface)`);
  if (!site.about) warn(`${tag}: no about page (E-E-A-T signal)`);

  // every page needs a slug + its own seo
  for (const [coll, label] of [[services, "service"], [locations, "location"], [areas, "service-area"]]) {
    for (const pg of coll) {
      if (!pg.slug) fail(`${tag}: a ${label} page is missing a slug`);
      if (!pg.seo || !pg.seo.title) fail(`${tag}: ${label} "${pg.slug || "?"}" missing seo.title`);
      const words = norm(pageText(pg)).split(" ").filter(Boolean).length;
      if (words < MIN.body_words) fail(`${tag}: ${label} "${pg.slug}" is thin (${words} words, min ${MIN.body_words})`);
    }
  }

  // thin-content / doorway-page guard: near-duplicate location & area pages
  for (const [coll, label] of [[locations, "location"], [areas, "service-area"]]) {
    const sigs = coll.map((p) => ({ slug: p.slug, sh: shingles(pageText(p)) }));
    for (let i = 0; i < sigs.length; i++)
      for (let j = i + 1; j < sigs.length; j++) {
        const sim = jaccard(sigs[i].sh, sigs[j].sh);
        if (sim >= DUP_SIMILARITY)
          fail(`${tag}: ${label} pages "${sigs[i].slug}" and "${sigs[j].slug}" are ${(sim * 100) | 0}% identical ` +
               `(doorway-page risk; rewrite to be locally distinct or merge)`);
      }
  }
}

// ---- repo-level checks (JSON-LD wired into the category pages)
function gradeJsonLd() {
  const catDir = join(REPO, "templates/categories");
  if (!existsSync(catDir)) return;
  for (const cat of readdirSync(catDir)) {
    const pagesDir = join(catDir, cat, "pages");
    if (!existsSync(pagesDir)) continue;
    const all = readdirSync(pagesDir).filter((n) => n.endsWith(".tsx"))
      .map((n) => readFileSync(join(pagesDir, n), "utf8")).join("\n");
    if (!/ld\+json|schema\.org|"@type"|jsonLd|JsonLd/i.test(all))
      fail(`category "${cat}": no JSON-LD found in pages/ (LocalBusiness/Service/FAQPage schema is required)`);
  }
}

// ---- the real compile + render + schema-parse gate
function gradeBuild() {
  if (process.env.AUTOPILOT_SKIP_BUILD === "1") { warn("next build SKIPPED (AUTOPILOT_SKIP_BUILD=1)"); return; }
  try {
    console.log("grader: running next build (this is the real ship gate) ...");
    execSync("npx --no-install next build", { cwd: REPO, stdio: "pipe", timeout: 1000 * 60 * 10 });
  } catch (e) {
    const tail = String(e.stdout || e.message).split("\n").slice(-12).join("\n");
    fail(`next build failed. tsc passing is not enough; the product ships through this.\n${tail}`);
  }
}

// ---- run
for (const t of targets) gradeSite(t);
gradeJsonLd();
gradeBuild();

mkdirSync(OUT, { recursive: true });
const report = { at: new Date().toISOString(), targets, pass: fails.length === 0, fails, warns };
writeFileSync(join(OUT, "grade-report.json"), JSON.stringify(report, null, 2));

console.log(`\nGRADER: ${report.pass ? "PASS" : "FAIL"}  (${targets.length} site(s) checked)`);
if (warns.length) { console.log("\nwarnings:"); warns.forEach((w) => console.log("  ! " + w)); }
if (fails.length) { console.log("\nfailures:"); fails.forEach((f) => console.log("  x " + f)); }
process.exit(report.pass ? 0 : 1);
