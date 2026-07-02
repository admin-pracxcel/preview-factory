#!/usr/bin/env node
/**
 * scripts/smoke-generate.mjs
 *
 * Phase 1 acceptance test — proves the CLI wiring works end-to-end without
 * spending any Claude budget.
 *
 * Pipes scripts/fixtures/gbp-trades.json into `generator/cli.ts` with
 * USE_FIXTURE=1, then asserts the result envelope.
 *
 * Usage:
 *   node scripts/smoke-generate.mjs
 *   node scripts/smoke-generate.mjs --live   # skip USE_FIXTURE, hit real Claude (slow)
 *
 * Exit code: 0 on pass, 1 on fail.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const FIXTURE = join(REPO, "scripts/fixtures/gbp-trades.json");
const CLI = join(REPO, "generator/cli.ts");

const live = process.argv.includes("--live");

function log(...args) {
  // eslint-disable-next-line no-console
  console.error("[smoke]", ...args);
}

async function runCli(payload) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (!live) env.USE_FIXTURE = "1";
    // Node args: use tsx via npx so we don't require a global install.
    const child = spawn("npx", ["tsx", CLI], {
      cwd: REPO,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on("data", (b) => {
      stdoutChunks.push(b);
    });
    child.stderr.on("data", (b) => {
      stderrChunks.push(b);
      // Mirror generator progress so a human running this sees what's going on.
      process.stderr.write(b);
    });
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      resolve({ code, stdout, stderr });
    });
    child.on("error", reject);
    child.stdin.write(payload);
    child.stdin.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    log("FAIL:", message);
    process.exit(1);
  }
}

async function main() {
  log(`mode: ${live ? "LIVE (real Claude call)" : "FIXTURE (USE_FIXTURE=1)"}`);
  log("piping", FIXTURE, "into", CLI);

  const payload = readFileSync(FIXTURE, "utf8");
  const started = Date.now();
  const { code, stdout, stderr } = await runCli(payload);
  const elapsed = Date.now() - started;

  log(`exit=${code} elapsed=${Math.round(elapsed / 1000)}s stdout=${stdout.length} chars`);

  // stdout must contain exactly one JSON line (result envelope), possibly with
  // a trailing newline. Anything else means a library leaked to stdout.
  const trimmed = stdout.trim();
  assert(trimmed.length > 0, "stdout was empty");
  assert(!trimmed.includes("\n"), `stdout has multiple lines (something leaked): first 200: ${trimmed.slice(0, 200)}`);

  let envelope;
  try {
    envelope = JSON.parse(trimmed);
  } catch (err) {
    log("FAIL: stdout was not valid JSON:", trimmed.slice(0, 300));
    process.exit(1);
  }

  assert(envelope.v === 1, `envelope.v is not 1 (got ${envelope.v})`);
  assert(code === 0, `CLI exited non-zero (${code}) — envelope: ${JSON.stringify(envelope).slice(0, 400)}`);
  assert(envelope.ok === true, `envelope.ok is not true — error: ${envelope.error?.message}`);
  assert(envelope.site_props, "envelope.site_props missing");
  assert(envelope.site_props.business?.name, "site_props.business.name missing");
  assert(Array.isArray(envelope.site_props.services), "site_props.services not an array");
  assert(envelope.site_props.services.length > 0, "site_props.services is empty");
  assert(envelope.meta?.tenant_id === "00000000-0000-4000-8000-000000000001", "meta.tenant_id did not echo the payload");
  assert(typeof envelope.meta?.duration_ms === "number", "meta.duration_ms missing/non-number");
  assert(envelope.meta?.claude_version, "meta.claude_version missing");

  log("PASS:", JSON.stringify({
    business: envelope.site_props.business.name,
    services: envelope.site_props.services.length,
    locations: envelope.site_props.locations?.length ?? 0,
    duration_ms: envelope.meta.duration_ms,
    claude_version: envelope.meta.claude_version,
  }));
}

main().catch((err) => {
  log("UNCAUGHT:", err);
  process.exit(1);
});
