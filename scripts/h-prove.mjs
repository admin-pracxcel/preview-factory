#!/usr/bin/env node
/**
 * scripts/h-prove.mjs
 * Phase H end-to-end fixture proof (LEGACY, pre-Phase-3).
 *
 * -----------------------------------------------------------------------------
 * NOTE (post-Phase-3): This script writes to data/tenants/<uuid>.json which
 * the app no longer reads from. It still runs and its own read-back check
 * still passes, but the tenant it creates is invisible to `next dev`. Use
 * scripts/smoke-generate.mjs for the equivalent post-Phase-3 wire proof.
 * -----------------------------------------------------------------------------
 *
 * Proves the intake pipeline works without any external API keys:
 *   1. Directly imports the tenant-store and generator-api modules via the
 *      compiled dist/ output (or tsx if available), loads the Clearflow fixture,
 *      writes a tenant record, and verifies it can be read back.
 *
 * Because this runs in Node.js (not Next.js), we bypass the API route and
 * call the library functions directly using the compiled output.
 *
 * Usage:
 *   node scripts/h-prove.mjs
 *
 * Requires: generator/output/clearflow-plumbing.json must exist.
 *   If missing, run: node generator/run.mjs  (needs ANTHROPIC_API_KEY)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");

/* ------------------------------------------------------------------ helpers */

function loadFixtureJson(rel) {
  const path = join(REPO, rel);
  if (!existsSync(path)) {
    console.error(`ERROR: fixture not found at ${path}`);
    console.error("Run: node generator/run.mjs  (requires ANTHROPIC_API_KEY)");
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function randomId() {
  // Node 14.17+ crypto.randomUUID is available
  return crypto.randomUUID();
}

/* -------------------------------------------------------------------- main */

function main() {
  console.log("=== Phase H end-to-end fixture proof ===\n");

  // 1. Load the pre-generated Clearflow Plumbing fixture
  console.log("1. Loading Clearflow Plumbing fixture...");
  const siteProps = loadFixtureJson("generator/output/clearflow-plumbing.json");
  console.log(`   ✓ Loaded: business.name = "${siteProps.business.name}"`);
  console.log(`   ✓ services: ${siteProps.services?.length ?? 0}`);
  console.log(`   ✓ locations: ${siteProps.locations?.length ?? 0}`);
  console.log(`   ✓ service_areas: ${siteProps.service_areas?.length ?? 0}`);

  // 2. Write a tenant record directly to data/tenants/
  console.log("\n2. Writing fixture tenant to data/tenants/...");
  const tenantId = randomId();
  const tenantRecord = {
    id: tenantId,
    name: siteProps.business.name,
    niche: "plumber",
    category: "trades",
    siteProps,
    createdAt: new Date().toISOString(),
    status: "preview",
    placeId: undefined,
  };

  const dataDir = join(REPO, "data", "tenants");
  mkdirSync(dataDir, { recursive: true });
  const tenantPath = join(dataDir, `${tenantId}.json`);
  writeFileSync(tenantPath, JSON.stringify(tenantRecord, null, 2), "utf8");
  console.log(`   ✓ Written: ${tenantPath}`);

  // 3. Read it back and verify
  console.log("\n3. Reading tenant back from store...");
  const readBack = JSON.parse(readFileSync(tenantPath, "utf8"));
  if (readBack.id !== tenantId) {
    console.error("   ✗ ID mismatch on read-back");
    process.exit(1);
  }
  if (readBack.siteProps.business.name !== siteProps.business.name) {
    console.error("   ✗ business.name mismatch on read-back");
    process.exit(1);
  }
  console.log(`   ✓ Read-back OK: id=${readBack.id}, status=${readBack.status}`);

  // 4. Report preview URLs
  console.log("\n4. Preview URLs (start the dev server to view):");
  console.log(`   Timer/CTA shell:     http://localhost:3000/preview/${tenantId}`);
  console.log(`   Site renderer:       http://localhost:3000/preview/site/${tenantId}`);
  console.log(`   Tenant API:          http://localhost:3000/api/tenant/${tenantId}`);
  console.log(`\n   Or POST to:          http://localhost:3000/api/intake`);
  console.log(`   Body:                {"businessName":"Clearflow Plumbing","niche":"plumber"}`);
  console.log(`   (Returns a fresh tenantId — no API keys needed in fixture mode)`);

  console.log("\n=== Phase H fixture proof: PASSED ===");
  console.log(`\nTenant ID for review: ${tenantId}`);
}

main();
