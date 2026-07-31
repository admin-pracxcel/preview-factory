#!/usr/bin/env node
/**
 * scripts/seo-blog-generate.ts
 *
 * Stdin/stdout wrapper for one blog-post generation. Invoked from the
 * SEO Blog Tick n8n workflow via Execute Command, one call per due tenant.
 *
 * Input (stdin, single JSON object matching the tenant payload the
 * /api/admin/seo/due-tenants route emits):
 *   {
 *     "tenantId": "uuid",
 *     "tier": "starter" | "growth" | "pro",
 *     "category": "trades" | "allied-health" | "beauty-aesthetics" | "fitness-wellness",
 *     "businessName": "...",
 *     "services": ["..."],
 *     "suburb": "...",
 *     "brandVoice": "..." | null,
 *     "recentTitles": ["..."],
 *     "liveUrl": "https://..."
 *   }
 *
 * Output (stdout, exactly one JSON line + newline):
 *   success: { v:1, ok:true, post: { title, slug, excerpt, body_md, cover_image_query },
 *              meta: { duration_ms, category } }
 *   failure: { v:1, ok:false, error: { code, message } }
 *
 * Exit code: 0 on success, 1 on failure. ALL diagnostics go to stderr.
 * Console output from lib/* is redirected to stderr so the envelope stays clean.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { callClaudeCli } from "@/lib/claude-cli";

console.log = (...args: unknown[]) => console.error(...args);
console.info = (...args: unknown[]) => console.error(...args);

interface BlogJobPayload {
  tenantId: string;
  category: string;
  businessName: string;
  services: string[];
  suburb: string;
  brandVoice?: string | null;
  recentTitles: string[];
  liveUrl?: string;
}

interface GeneratedPost {
  title: string;
  slug: string;
  excerpt: string;
  body_md: string;
  cover_image_query: string;
}

type Envelope =
  | { v: 1; ok: true; post: GeneratedPost; meta: { duration_ms: number; category: string } }
  | { v: 1; ok: false; error: { code: string; message: string } };

const POST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "slug", "excerpt", "body_md", "cover_image_query"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    slug: {
      type: "string",
      minLength: 3,
      maxLength: 100,
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    },
    excerpt: { type: "string", minLength: 1, maxLength: 500 },
    body_md: { type: "string", minLength: 200 },
    cover_image_query: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const ALLOWED_CATEGORIES = new Set([
  "trades",
  "allied-health",
  "beauty-aesthetics",
  "fitness-wellness",
]);

function emit(env: Envelope): never {
  process.stdout.write(JSON.stringify(env) + "\n");
  process.exit(env.ok ? 0 : 1);
}

function fail(code: string, message: string): never {
  emit({ v: 1, ok: false, error: { code, message: message.slice(0, 500) } });
}

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

async function main(): Promise<void> {
  const started = Date.now();

  const raw = await readStdin();
  if (!raw.trim()) fail("bad_payload", "stdin was empty");

  let payload: BlogJobPayload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    fail("bad_payload", `stdin not valid JSON: ${(e as Error).message}`);
  }

  if (!payload.tenantId || !payload.category || !payload.businessName) {
    fail("bad_payload", "payload missing required fields (tenantId, category, businessName)");
  }
  if (!ALLOWED_CATEGORIES.has(payload.category)) {
    fail("bad_category", `unknown category "${payload.category}" — expected one of ${[...ALLOWED_CATEGORIES].join(", ")}`);
  }

  const promptPath = resolve(
    process.cwd(),
    "strategy/_master/claude-code-prompts",
    `blog-${payload.category}.md`,
  );
  let systemPrompt: string;
  try {
    systemPrompt = readFileSync(promptPath, "utf8");
  } catch (e) {
    fail("prompt_missing", `could not read ${promptPath}: ${(e as Error).message}`);
  }

  console.error(
    `[seo-blog-generate] tenant=${payload.tenantId} category=${payload.category} title-count=${payload.recentTitles?.length ?? 0}`,
  );

  let raw_output: string;
  try {
    raw_output = await callClaudeCli({
      systemPrompt,
      userPrompt: JSON.stringify(payload),
      jsonSchema: POST_SCHEMA,
    });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    const code = /rate.?limit/i.test(msg)
      ? "rate_limited"
      : /timed out/i.test(msg)
        ? "timeout"
        : "claude_cli_error";
    fail(code, msg);
  }

  let post: GeneratedPost;
  try {
    post = JSON.parse(raw_output);
  } catch (e) {
    fail("bad_output", `Claude returned unparseable output: ${(e as Error).message}. First 200 chars: ${raw_output.slice(0, 200)}`);
  }

  emit({
    v: 1,
    ok: true,
    post,
    meta: { duration_ms: Date.now() - started, category: payload.category },
  });
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  fail("unexpected", msg);
});
