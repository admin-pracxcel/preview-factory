#!/usr/bin/env node
/**
 * scripts/backfill-slugs.mjs
 * One-shot: assigns a slug to every tenant that doesn't have one.
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (or the current environment). Safe to re-run; skips rows with slug set.
 *
 * Usage:
 *   node scripts/backfill-slugs.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Bare-minimum .env.local loader — no dotenv dep.
try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  }
} catch {
  // .env.local optional if the env is already populated.
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required in env.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey);

const RESERVED = new Set([
  "www","api","admin","mail","smtp","imap","status","health","dashboard",
  "login","welcome","expired","preview","checkout","billing","help","support",
  "docs","app","auth","static","cdn","assets","media","images","img","test",
  "staging","dev","beta","demo","launcharoo",
]);

function normaliseSlug(input) {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s._]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

async function slugAvailable(slug, sameId) {
  const { data, error } = await supabase
    .from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) return true;
  return data.id === sameId;
}

async function reserve(name, tenantId) {
  let base = normaliseSlug(name) || "site";
  if (base.length < 3) base = (base + "-" + tenantId.slice(0, 4)).slice(0, 30);
  const candidates = [];
  if (!RESERVED.has(base)) candidates.push(base);
  for (let i = 2; i <= 99; i++) {
    const suffix = `-${i}`;
    const c = base.slice(0, 30 - suffix.length) + suffix;
    if (!RESERVED.has(c)) candidates.push(c);
  }
  for (const c of candidates) if (await slugAvailable(c, tenantId)) return c;
  throw new Error(`no slug available for "${name}" (99 collisions)`);
}

const { data: rows, error } = await supabase
  .from("tenants")
  .select("id, name, slug")
  .is("slug", null)
  .limit(1000);
if (error) { console.error(error); process.exit(1); }

console.log(`found ${rows.length} tenants without slug`);
let done = 0, failed = 0;
for (const row of rows) {
  try {
    const slug = await reserve(row.name || "site", row.id);
    const { error: updateErr } = await supabase
      .from("tenants").update({ slug }).eq("id", row.id);
    if (updateErr) throw updateErr;
    console.log(`  ${row.id.slice(0, 8)} "${row.name}" → ${slug}`);
    done++;
  } catch (err) {
    console.error(`  ${row.id.slice(0, 8)} FAILED:`, err.message);
    failed++;
  }
}
console.log(`\ndone: ${done} succeeded, ${failed} failed`);
