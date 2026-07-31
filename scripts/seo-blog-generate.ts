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

interface GeneratedFaq {
  question: string;
  answer: string;
}

interface GeneratedPost {
  title: string;
  slug: string;
  excerpt: string;
  tldr: string;
  body_md: string;
  key_takeaways: string[];
  faqs: GeneratedFaq[];
  cover_image_query: string;
}

type Envelope =
  | { v: 1; ok: true; post: GeneratedPost; meta: { duration_ms: number; category: string } }
  | { v: 1; ok: false; error: { code: string; message: string } };

const POST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "slug",
    "excerpt",
    "tldr",
    "body_md",
    "key_takeaways",
    "faqs",
    "cover_image_query",
  ],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    slug: {
      type: "string",
      minLength: 3,
      maxLength: 100,
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    },
    excerpt: { type: "string", minLength: 1, maxLength: 500 },
    tldr: { type: "string", minLength: 60, maxLength: 600 },
    body_md: { type: "string", minLength: 400 },
    key_takeaways: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string", minLength: 8, maxLength: 220 },
    },
    faqs: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: {
          question: { type: "string", minLength: 6, maxLength: 200 },
          answer: { type: "string", minLength: 40, maxLength: 800 },
        },
      },
    },
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

/**
 * Extract the first balanced JSON object from a possibly-wrapped response.
 * Handles three cases the model tends to produce even when told not to:
 *   1. Pure JSON — return as-is.
 *   2. Fenced (```json { ... } ``` or ``` { ... } ```) — unwrap.
 *   3. JSON preceded/followed by narration — find first `{`, walk to
 *      matching `}` respecting string literals and escapes.
 * Returns null when no plausible JSON object is present.
 */
function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fence = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fence?.[1]) {
    const inside = fence[1].trim();
    if (inside.startsWith("{") && inside.endsWith("}")) return inside;
  }

  const start = trimmed.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return null;
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

  const extracted = extractJsonObject(raw_output);
  if (!extracted) {
    fail(
      "bad_output",
      `Claude returned no parseable JSON object. First 300 chars: ${raw_output.slice(0, 300)}`,
    );
  }
  let post: GeneratedPost;
  try {
    post = JSON.parse(extracted) as GeneratedPost;
  } catch (e) {
    fail(
      "bad_output",
      `Extracted JSON substring did not parse: ${(e as Error).message}. First 200 chars: ${extracted.slice(0, 200)}`,
    );
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
