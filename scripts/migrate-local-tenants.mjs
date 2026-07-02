#!/usr/bin/env node
/**
 * scripts/migrate-local-tenants.mjs
 *
 * One-off Phase 3 migration: push every data/tenants/*.json file into the
 * Supabase tenants table so local dev continuity works after the tenant
 * store swap.
 *
 * Also migrates data/leads/*.json into the leads table.
 *
 * Idempotent — uses INSERT with ON CONFLICT DO NOTHING for tenants (never
 * overwrites a newer DB row) and skips leads that already exist by id.
 *
 * Requires:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (see docs/env.md)
 *
 * Usage:
 *   node scripts/migrate-local-tenants.mjs
 *   node scripts/migrate-local-tenants.mjs --dry-run   # show what would move
 *   node scripts/migrate-local-tenants.mjs --leads     # only migrate leads
 *   node scripts/migrate-local-tenants.mjs --tenants   # only migrate tenants
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const TENANTS_DIR = join(REPO, "data", "tenants");
const LEADS_DIR = join(REPO, "data", "leads");

/**
 * Node doesn't auto-load .env.local the way Next.js does. Parse and inject it
 * so `node scripts/migrate-local-tenants.mjs` works without extra flags.
 * Existing process.env values win (so a one-shot `FOO=bar node ...` still
 * overrides the file).
 */
function loadEnvLocal() {
  const envPath = join(REPO, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const dryRun = process.argv.includes("--dry-run");
const only = process.argv.includes("--leads")
  ? "leads"
  : process.argv.includes("--tenants")
    ? "tenants"
    : "both";

function log(...args) {
  // eslint-disable-next-line no-console
  console.log("[migrate]", ...args);
}
function warn(...args) {
  // eslint-disable-next-line no-console
  console.warn("[migrate]", ...args);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    // eslint-disable-next-line no-console
    console.error(`Missing env: ${name}. See docs/env.md.`);
    process.exit(1);
  }
  return v;
}

const url = requireEnv("SUPABASE_URL");
const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Match lib/tenant-store.ts toDbStatus. Kept inline so this script has no TS
// dependency and doesn't need tsx.
function toDbStatus(appStatus) {
  switch (appStatus) {
    case "preview":
      return "done";
    case "paid":
    case "published":
      return "claimed";
    default:
      return "done";
  }
}

function loadJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return { file: f, record: JSON.parse(readFileSync(join(dir, f), "utf8")) };
      } catch (err) {
        warn(`skipping ${f}: parse error: ${err.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

async function migrateTenants() {
  const files = loadJsonFiles(TENANTS_DIR);
  log(`tenants: ${files.length} file(s) found in ${TENANTS_DIR}`);
  if (files.length === 0) return { moved: 0, skipped: 0, failed: 0 };

  let moved = 0;
  let skipped = 0;
  let failed = 0;

  for (const { file, record } of files) {
    if (!record.id) {
      warn(`skipping ${file}: no id`);
      failed++;
      continue;
    }
    const row = {
      id: record.id,
      category: record.category ?? "trades",
      status: toDbStatus(record.status),
      site_props: record.siteProps ?? null,
      created_at: record.createdAt ?? new Date().toISOString(),
      name: record.name ?? null,
      niche: record.niche ?? null,
      place_id: record.placeId ?? null,
      gbp_photos: record.gbpPhotos ?? null,
      claimed_at:
        record.status === "paid" || record.status === "published"
          ? record.publishedAt ?? record.createdAt ?? new Date().toISOString()
          : null,
      billing_customer_id: record.stripeCustomerId ?? null,
    };
    if (dryRun) {
      log(`would insert tenant ${record.id} (${record.name ?? "unnamed"})`);
      moved++;
      continue;
    }
    // Use INSERT ... ON CONFLICT DO NOTHING via upsert with ignoreDuplicates
    // so re-running never clobbers something the app has already written.
    const { data, error } = await supabase
      .from("tenants")
      .upsert(row, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) {
      warn(`tenant ${record.id} failed: ${error.message}`);
      failed++;
      continue;
    }
    if (!data || data.length === 0) {
      skipped++;
    } else {
      moved++;
    }
  }

  log(`tenants: moved=${moved} skipped=${skipped} failed=${failed}`);
  return { moved, skipped, failed };
}

async function migrateLeads() {
  const files = loadJsonFiles(LEADS_DIR);
  log(`leads: ${files.length} file(s) found in ${LEADS_DIR}`);
  if (files.length === 0) return { moved: 0, skipped: 0, failed: 0 };

  let moved = 0;
  let skipped = 0;
  let failed = 0;

  for (const { file, record } of files) {
    if (!record.id) {
      warn(`skipping ${file}: no id`);
      failed++;
      continue;
    }
    const row = {
      id: record.id,
      tenant_id: record.tenantId ?? null,
      name: record.name ?? null,
      phone: record.phone ?? null,
      email: record.email ?? null,
      message: record.message ?? null,
      source: record.source ?? "contact-form",
      page: record.page ?? null,
      created_at: record.createdAt ?? new Date().toISOString(),
    };
    if (dryRun) {
      log(`would insert lead ${record.id}`);
      moved++;
      continue;
    }
    const { data, error } = await supabase
      .from("leads")
      .upsert(row, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) {
      warn(`lead ${record.id} failed: ${error.message}`);
      failed++;
      continue;
    }
    if (!data || data.length === 0) {
      skipped++;
    } else {
      moved++;
    }
  }

  log(`leads: moved=${moved} skipped=${skipped} failed=${failed}`);
  return { moved, skipped, failed };
}

async function main() {
  log(`mode: ${dryRun ? "DRY-RUN" : "APPLY"} | scope: ${only}`);
  log(`target: ${url}`);
  if (only === "tenants" || only === "both") await migrateTenants();
  if (only === "leads" || only === "both") await migrateLeads();
  log("done.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
