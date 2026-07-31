#!/usr/bin/env node
// Assembles n8n/seo-blog-tick.json.
//
//   node n8n/build-seo-blog-tick.mjs
//
// The workflow shells out to scripts/seo-blog-generate.ts (which lives in
// the repo checked out on the n8n container at /opt/preview-factory).
// The container self-updates via `git fetch && reset --hard origin/main`
// on every tick, so prompt-file edits ship the moment they're pushed.
//
// The Set config node holds APP_BASE_URL, CRON_SECRET, PEXELS_API_KEY —
// operators fill these three in the n8n UI after import. No n8n container
// env-var edits needed.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// Same shell command shape as n8n/generate-real-with-secrets.json's
// "Run generator" node: self-update the repo, source .env, pipe base64
// stdin into a tsx CLI, always exit 0 so CLI failures come out as
// {v:1, ok:false, ...} envelopes on stdout rather than n8n node errors.
const RUN_GENERATOR_CMD =
  '=sh -c \'set -e; export PATH="/home/node/.n8n/node_modules/.bin:$PATH"; cd /opt/preview-factory; git -c safe.directory=/opt/preview-factory fetch --quiet origin main; git -c safe.directory=/opt/preview-factory reset --hard --quiet origin/main; npm install --omit=dev --no-audit --no-fund --loglevel=error >/dev/null 2>&1; set -a; . ./.env; set +a; set +e; printf %s "{{ $json.payload_b64 }}" | base64 -d | npx --no-install tsx scripts/seo-blog-generate.ts; exit 0\'';

const PARSE_ENVELOPE_JS = `// Parse the CLI's stdout envelope. Same discipline as the generator
// workflow: whatever the Execute Command node gives us, produce one item
// with { ok, transient, error_code, error_message, post, meta } so
// downstream nodes have a stable shape.
const item = $input.item.json || {};
const stdout = item.stdout || '';
const stderr = item.stderr || '';
const exitCode = (typeof item.exitCode === 'number') ? item.exitCode : null;
const runError = item.error || null;

const lines = stdout.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);
const last = lines[lines.length - 1] || '';

let env = null;
try { env = JSON.parse(last); } catch (_) { /* fall through */ }

if (!env || env.v !== 1 || typeof env.ok !== 'boolean') {
  const parts = [];
  if (runError) {
    const emsg = (runError.message || runError.description || JSON.stringify(runError)).toString();
    parts.push('shell_error=' + emsg);
  }
  if (exitCode !== null && exitCode !== 0) parts.push('exit=' + exitCode);
  if (stderr) parts.push('stderr=' + stderr.trim().slice(0, 300));
  if (last && !env) parts.push('last_stdout=' + last.slice(0, 300));
  if (parts.length === 0) parts.push('no output from Execute Command');
  return [{
    ok: false,
    transient: false,
    error_code: 'cli_bad_envelope',
    error_message: parts.join(' | ').slice(0, 500),
    post: null,
    meta: null,
  }];
}

if (env.ok) {
  return [{
    ok: true,
    transient: false,
    error_code: null,
    error_message: null,
    post: env.post,
    meta: env.meta || null,
  }];
}

const code = env.error?.code || 'generation_failed';
const transient = ['rate_limited', 'timeout', 'claude_cli_error'].includes(code);
return [{
  ok: false,
  transient,
  error_code: code,
  error_message: (env.error?.message || 'unknown').slice(0, 500),
  post: null,
  meta: null,
}];`;

const workflow = {
  name: "SEO Blog Tick",
  nodes: [
    {
      id: "sb00cafe-0000-4000-8000-000000000001",
      name: "Cron 06:00 AEST",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [-16, 176],
      parameters: {
        rule: { interval: [{ field: "cronExpression", expression: "0 20 * * *" }] },
      },
    },
    {
      id: "sb00cafe-0000-4000-8000-000000000008",
      name: "Set config",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [208, 176],
      parameters: {
        assignments: {
          assignments: [
            { id: "c1", name: "APP_BASE_URL", type: "string", value: "https://REPLACE_ME_WITH_YOUR_DOMAIN" },
            { id: "c2", name: "CRON_SECRET", type: "string", value: "REPLACE_ME_WITH_CRON_SECRET" },
            { id: "c3", name: "PEXELS_API_KEY", type: "string", value: "REPLACE_ME_WITH_PEXELS_KEY" },
          ],
        },
        options: {},
      },
    },
    {
      id: "sb00cafe-0000-4000-8000-000000000002",
      name: "GET due tenants (blog)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [432, 176],
      parameters: {
        method: "GET",
        url: "={{ $('Set config').item.json.APP_BASE_URL }}/api/admin/seo/due-tenants?kind=blog",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "x-cron-secret", value: "={{ $('Set config').item.json.CRON_SECRET }}" },
          ],
        },
        options: { response: { response: { responseFormat: "json" } } },
      },
      onError: "continueRegularOutput",
    },
    {
      id: "sb00cafe-0000-4000-8000-000000000009",
      name: "Split tenants array",
      type: "n8n-nodes-base.splitOut",
      typeVersion: 1,
      position: [656, 176],
      parameters: { fieldToSplitOut: "tenants", options: {} },
    },
    {
      id: "sb00cafe-0000-4000-8000-000000000003",
      name: "For each tenant",
      type: "n8n-nodes-base.splitInBatches",
      typeVersion: 3,
      position: [880, 176],
      parameters: { batchSize: 1, options: {} },
    },
    {
      id: "sb00cafe-0000-4000-8000-00000000000a",
      name: "Prep payload",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1104, 176],
      parameters: {
        language: "javaScript",
        jsCode:
          "// Base64-encode the tenant payload so the shell command can safely\n" +
          "// pass it via printf | base64 -d — same convention as the generator\n" +
          "// workflow's Prep payload node.\nconst tenant = $input.item.json;\nconst payload_b64 = Buffer.from(JSON.stringify(tenant), 'utf8').toString('base64');\nreturn [{ ...tenant, payload_b64 }];",
      },
    },
    {
      id: "sb00cafe-0000-4000-8000-000000000004",
      name: "Run generator",
      type: "n8n-nodes-base.executeCommand",
      typeVersion: 1,
      position: [1328, 176],
      parameters: { executeOnce: true, command: RUN_GENERATOR_CMD },
      onError: "continueErrorOutput",
    },
    {
      id: "sb00cafe-0000-4000-8000-00000000000b",
      name: "Parse envelope",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1552, 176],
      parameters: { language: "javaScript", jsCode: PARSE_ENVELOPE_JS },
    },
    {
      id: "sb00cafe-0000-4000-8000-00000000000c",
      name: "Ok?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [1776, 176],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
          combinator: "and",
          conditions: [
            {
              id: "cond-ok",
              leftValue: "={{ $json.ok }}",
              rightValue: true,
              operator: { type: "boolean", operation: "true", singleValue: true },
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "sb00cafe-0000-4000-8000-000000000005",
      name: "Pexels cover image",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2000, 80],
      parameters: {
        method: "GET",
        url: "https://api.pexels.com/v1/search",
        sendQuery: true,
        queryParameters: {
          parameters: [
            { name: "query", value: "={{ $json.post.cover_image_query }}" },
            { name: "per_page", value: "1" },
          ],
        },
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ $('Set config').item.json.PEXELS_API_KEY }}" },
          ],
        },
        options: { response: { response: { responseFormat: "json" } } },
      },
      onError: "continueRegularOutput",
    },
    {
      id: "sb00cafe-0000-4000-8000-000000000006",
      name: "POST blog post",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2224, 80],
      parameters: {
        method: "POST",
        url: "={{ $('Set config').item.json.APP_BASE_URL }}/api/admin/seo/blog-posts",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "x-cron-secret", value: "={{ $('Set config').item.json.CRON_SECRET }}" },
            { name: "content-type", value: "application/json" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ JSON.stringify({\n" +
          "  tenantId: $node['For each tenant'].json.tenantId,\n" +
          "  slug: $node['Parse envelope'].json.post.slug,\n" +
          "  title: $node['Parse envelope'].json.post.title,\n" +
          "  excerpt: $node['Parse envelope'].json.post.excerpt,\n" +
          "  bodyMd: $node['Parse envelope'].json.post.body_md,\n" +
          "  coverImageUrl: ($node['Pexels cover image'].json.photos && $node['Pexels cover image'].json.photos[0]) ? $node['Pexels cover image'].json.photos[0].src.large : undefined,\n" +
          "  generationMeta: { model: 'claude-code', prompt: $node['For each tenant'].json.category, duration_ms: $node['Parse envelope'].json.meta?.duration_ms }\n" +
          "}) }}",
        options: {
          response: { response: { responseFormat: "json" } },
          retry: { enabled: true, maxTries: 2, waitBetweenTries: 3000 },
        },
      },
      onError: "continueErrorOutput",
    },
    {
      id: "sb00cafe-0000-4000-8000-000000000007",
      name: "Log failure",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2224, 400],
      parameters: {
        method: "POST",
        url: "={{ $('Set config').item.json.APP_BASE_URL }}/api/admin/seo/log-failure",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "x-cron-secret", value: "={{ $('Set config').item.json.CRON_SECRET }}" },
            { name: "content-type", value: "application/json" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ JSON.stringify({\n" +
          "  tenantId: $node['For each tenant'].json.tenantId,\n" +
          "  kind: 'blog',\n" +
          "  reason: ($node['Parse envelope'].json.error_code || 'publish_failed') + ': ' + (($node['Parse envelope'].json.error_message || JSON.stringify($json)).toString().slice(0, 200))\n" +
          "}) }}",
        options: { response: { response: { responseFormat: "json" } } },
      },
      onError: "continueRegularOutput",
    },
  ],
  connections: {
    "Cron 06:00 AEST": {
      main: [[{ node: "Set config", type: "main", index: 0 }]],
    },
    "Set config": {
      main: [[{ node: "GET due tenants (blog)", type: "main", index: 0 }]],
    },
    "GET due tenants (blog)": {
      main: [[{ node: "Split tenants array", type: "main", index: 0 }]],
    },
    "Split tenants array": {
      main: [[{ node: "For each tenant", type: "main", index: 0 }]],
    },
    // splitInBatches v3 outputs are [done, loop]. main[0] fires once after
    // the loop exhausts (nothing to do — workflow ends). main[1] fires
    // per iteration and is where the real work goes.
    "For each tenant": {
      main: [
        [],
        [{ node: "Prep payload", type: "main", index: 0 }],
      ],
    },
    "Prep payload": {
      main: [[{ node: "Run generator", type: "main", index: 0 }]],
    },
    "Run generator": {
      main: [
        [{ node: "Parse envelope", type: "main", index: 0 }],
        [{ node: "Parse envelope", type: "main", index: 0 }],
      ],
    },
    "Parse envelope": {
      main: [[{ node: "Ok?", type: "main", index: 0 }]],
    },
    "Ok?": {
      main: [
        [{ node: "Pexels cover image", type: "main", index: 0 }],
        [{ node: "Log failure", type: "main", index: 0 }],
      ],
    },
    "Pexels cover image": {
      main: [[{ node: "POST blog post", type: "main", index: 0 }]],
    },
    "POST blog post": {
      main: [
        [{ node: "For each tenant", type: "main", index: 0 }],
        [{ node: "Log failure", type: "main", index: 0 }],
      ],
    },
    "Log failure": {
      main: [[{ node: "For each tenant", type: "main", index: 0 }]],
    },
  },
  active: false,
  settings: {
    executionOrder: "v1",
    saveDataSuccessExecution: "all",
    saveDataErrorExecution: "all",
    callerPolicy: "workflowsFromSameOwner",
  },
  pinData: {},
  meta: { instanceId: "preview-factory" },
  versionId: "8010b810-0000-4810-8810-000000008012",
  tags: [],
};

const outPath = resolve(here, "seo-blog-tick.json");
writeFileSync(outPath, JSON.stringify(workflow, null, 2) + "\n");
console.log(`wrote ${outPath}`);
