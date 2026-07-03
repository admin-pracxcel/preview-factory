#!/usr/bin/env node
/**
 * generator/cli.ts
 *
 * Standalone stdin/stdout wrapper around lib/generator-api.ts. Invoked by
 * n8n's Execute Command node during async generation (Phase 4+). Runnable
 * locally via `pnpm generate:cli < payload.json > result.json`.
 *
 * Input (stdin, single JSON object):
 *   {
 *     "v": 1,
 *     "tenant_id": "uuid",
 *     "category": "trades" | "beauty-aesthetics" | "allied-health" | "fitness-wellness",
 *     "gbp_data": GbpData,
 *     "uploaded_images"?: []
 *   }
 *
 * Output (stdout, one JSON line, then newline):
 *   success: { v: 1, ok: true, site_props: SiteProps,
 *              meta: { duration_ms, claude_version, tenant_id } }
 *   failure: { v: 1, ok: false,
 *              error: { code, message } }
 *
 * Exit code: 0 on success, 1 on any failure (including bad payload).
 *
 * ALL diagnostics go to stderr. stdout contains ONLY the final envelope.
 * Library console.log calls (image assembler, generator-api progress) are
 * redirected to stderr at startup so they don't corrupt the envelope.
 */

import { spawnSync } from "node:child_process";
import { generateSiteForApi } from "@/lib/generator-api";
import type { GbpData } from "@/lib/places-client";
import type { SiteProps } from "@/shared/types/site-props";

// Redirect console.log to stderr BEFORE anything else runs so downstream
// progress logs from lib/* land on the right stream.
console.log = (...args: unknown[]) => console.error(...args);
console.info = (...args: unknown[]) => console.error(...args);

/**
 * Minimum Claude Code CLI version we've validated the generator against.
 * Bump deliberately after testing a new release. Below this, fail fast rather
 * than debug mysterious schema/prompt drift.
 *
 * Current: unpinned (0.0.0). We'll set a real floor once we've observed a
 * stable version on the n8n box in Phase 5.
 */
const MIN_CLAUDE_VERSION = "0.0.0";

interface JobPayloadV1 {
  v: 1;
  tenant_id: string;
  category: string;
  gbp_data: GbpData;
  uploaded_images?: Array<{ path: string; kind: string }>;
}

interface SuccessEnvelope {
  v: 1;
  ok: true;
  site_props: SiteProps;
  meta: {
    duration_ms: number;
    claude_version: string;
    tenant_id: string;
  };
}

interface FailureEnvelope {
  v: 1;
  ok: false;
  error: { code: string; message: string };
}

let emitted = false;

function emit(envelope: SuccessEnvelope | FailureEnvelope, code: 0 | 1): never {
  // Guard against double emission. emit() schedules process.exit() in a
  // callback so synchronous code after emit() keeps running — if a caller
  // reaches a second emit before the exit fires, we'd write two envelopes
  // to stdout. Ignore anything after the first.
  if (emitted) {
    return undefined as never;
  }
  emitted = true;
  // Wait for the write to flush before exiting. Calling process.exit()
  // synchronously can truncate a large JSON payload on piped stdout,
  // dropping several kilobytes silently.
  const line = JSON.stringify(envelope) + "\n";
  process.stdout.write(line, () => process.exit(code));
  // Belt-and-braces: if the callback never fires (unlikely, but if stdout is
  // detached we'd hang forever), give it 5s then force exit.
  setTimeout(() => process.exit(code), 5000).unref();
  // Satisfy TypeScript's `never` return — the process is exiting one way or another.
  return undefined as never;
}

function fail(code: string, message: string): never {
  emit({ v: 1, ok: false, error: { code, message } }, 1);
}

/**
 * Fetch and lightly validate the installed `claude` CLI version. Returns the
 * raw version string. Throws (via `fail`) if the binary is missing or the
 * observed version is below MIN_CLAUDE_VERSION.
 */
function requireClaudeCli(): string {
  const res = spawnSync("claude", ["--version"], { encoding: "utf8" });
  if (res.error) {
    fail(
      "claude_cli_missing",
      `Failed to run "claude --version": ${res.error.message}. Is the CLI installed and in PATH?`,
    );
  }
  if (res.status !== 0) {
    fail(
      "claude_cli_error",
      `"claude --version" exited with code ${res.status}. stderr: ${(res.stderr || "").trim()}`,
    );
  }
  const raw = (res.stdout || "").trim();
  if (!raw) {
    fail("claude_cli_error", `"claude --version" produced no output.`);
  }
  // Extract a semver-ish first token — the CLI prints things like
  // "1.2.3 (Claude Code)" so we take the leading version number.
  const match = raw.match(/(\d+\.\d+\.\d+(?:[-.\w]+)?)/);
  const version = match ? match[1] : raw;

  if (MIN_CLAUDE_VERSION !== "0.0.0" && compareVersions(version, MIN_CLAUDE_VERSION) < 0) {
    fail(
      "claude_cli_outdated",
      `Installed claude CLI ${version} is below the pinned minimum ${MIN_CLAUDE_VERSION}. Upgrade the box.`,
    );
  }
  return version;
}

/** Rough numeric comparator; handles dot-then-alnum tails as separate segments. */
function compareVersions(a: string, b: string): number {
  const parse = (s: string) => s.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  const ap = parse(a);
  const bp = parse(b);
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parsePayload(raw: string): JobPayloadV1 {
  if (!raw.trim()) {
    fail("payload_empty", "No JSON payload received on stdin.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail("payload_parse_error", err instanceof Error ? err.message : String(err));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("payload_shape_error", "Payload must be a JSON object.");
  }
  const p = parsed as Record<string, unknown>;
  if (p.v !== 1) {
    fail("unsupported_payload_version", `Expected v=1, got v=${JSON.stringify(p.v)}.`);
  }
  if (typeof p.tenant_id !== "string" || !p.tenant_id.trim()) {
    fail("payload_shape_error", "Missing or invalid tenant_id.");
  }
  if (typeof p.category !== "string" || !p.category.trim()) {
    fail("payload_shape_error", "Missing or invalid category.");
  }
  if (!p.gbp_data || typeof p.gbp_data !== "object" || Array.isArray(p.gbp_data)) {
    fail("payload_shape_error", "Missing or invalid gbp_data.");
  }
  return parsed as JobPayloadV1;
}

/**
 * Classify a generation error into a short machine code so n8n can decide
 * whether to retry (transient) or fail hard (validation, unsupported input).
 */
function classifyError(err: unknown): { code: string; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  // Auth failures — permanent, no retry helps. Check before the generic
  // "error result" match below.
  if (/authentication|401|Invalid authentication credentials/i.test(message)) {
    return { code: "auth_failed", message };
  }
  if (/subscription.+rate.?limit/i.test(message)) {
    return { code: "subscription_limit", message };
  }
  if (/rate.?limit/i.test(message)) {
    return { code: "rate_limited", message };
  }
  if (/timed out/i.test(message)) {
    return { code: "timeout", message };
  }
  if (/phase [ABC] validation failed/i.test(message)) {
    return { code: "phase_validation", message };
  }
  if (/runtime validation/i.test(message)) {
    return { code: "runtime_validation", message };
  }
  if (/claude CLI (returned no text|exited with code|returned error result)/i.test(message)) {
    return { code: "claude_cli_error", message };
  }
  return { code: "generation_failed", message };
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const claudeVersion = requireClaudeCli();

  const raw = await readStdin();
  const payload = parsePayload(raw);

  console.error(
    `[cli] starting generation tenant=${payload.tenant_id} category=${payload.category} claude=${claudeVersion}`,
  );

  let siteProps: SiteProps;
  try {
    siteProps = await generateSiteForApi(payload.gbp_data, payload.category);
  } catch (err) {
    const { code, message } = classifyError(err);
    console.error(`[cli] generation failed: ${code}: ${message}`);
    fail(code, message);
  }

  const duration_ms = Date.now() - startedAt;
  console.error(`[cli] generation succeeded in ${Math.round(duration_ms / 1000)}s`);
  emit(
    {
      v: 1,
      ok: true,
      site_props: siteProps,
      meta: {
        duration_ms,
        claude_version: claudeVersion,
        tenant_id: payload.tenant_id,
      },
    },
    0,
  );
}

main().catch((err) => {
  // Should never reach here — main() emits and exits for all known paths.
  // Belt-and-braces: crash on stderr with a non-zero exit so n8n treats it as
  // a failure, but still write a parseable envelope so the parent doesn't
  // choke on empty stdout.
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[cli] uncaught: ${message}\n`);
  emit(
    {
      v: 1,
      ok: false,
      error: { code: "uncaught", message: err instanceof Error ? err.message : String(err) },
    },
    1,
  );
});
