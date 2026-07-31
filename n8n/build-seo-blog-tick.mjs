#!/usr/bin/env node
// Assembles n8n/seo-blog-tick.json from the prompt files in
// strategy/_master/claude-code-prompts/. Run whenever a prompt changes.
//
//   node n8n/build-seo-blog-tick.mjs
//
// The workflow embeds config + prompts inline so it imports as a
// self-contained unit — n8n operators fill CRON_SECRET, PEXELS_API_KEY,
// and APP_BASE_URL in the "Set config" node after import. No n8n
// container env vars needed.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const promptDir = resolve(here, "../strategy/_master/claude-code-prompts");
const readPrompt = (cat) =>
  readFileSync(resolve(promptDir, `blog-${cat}.md`), "utf8");

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
            { id: "c4", name: "prompt_trades", type: "string", value: readPrompt("trades") },
            { id: "c5", name: "prompt_allied_health", type: "string", value: readPrompt("allied-health") },
            { id: "c6", name: "prompt_beauty", type: "string", value: readPrompt("beauty") },
            { id: "c7", name: "prompt_fitness", type: "string", value: readPrompt("fitness") },
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
      id: "sb00cafe-0000-4000-8000-000000000004",
      name: "Claude Code generate post",
      type: "n8n-nodes-claude-code.claudeCode",
      typeVersion: 1,
      position: [1104, 176],
      parameters: {
        resource: "conversation",
        operation: "send",
        systemMessage:
          "={{ $('Set config').item.json['prompt_' + $json.category.replace('-', '_')] }}",
        userMessage: "={{ JSON.stringify($json) }}",
      },
    },
    {
      id: "sb00cafe-0000-4000-8000-000000000005",
      name: "Pexels cover image",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1328, 176],
      parameters: {
        method: "GET",
        url: "https://api.pexels.com/v1/search",
        sendQuery: true,
        queryParameters: {
          parameters: [
            { name: "query", value: "={{ $json.cover_image_query }}" },
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
      position: [1552, 176],
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
          "={{ JSON.stringify({\n  tenantId: $node['For each tenant'].json.tenantId,\n  slug: $node['Claude Code generate post'].json.slug,\n  title: $node['Claude Code generate post'].json.title,\n  excerpt: $node['Claude Code generate post'].json.excerpt,\n  bodyMd: $node['Claude Code generate post'].json.body_md,\n  coverImageUrl: ($node['Pexels cover image'].json.photos && $node['Pexels cover image'].json.photos[0]) ? $node['Pexels cover image'].json.photos[0].src.large : undefined,\n  generationMeta: { model: 'claude-code', prompt: $node['For each tenant'].json.category }\n}) }}",
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
      position: [1552, 400],
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
          "={{ JSON.stringify({\n  tenantId: $node['For each tenant'].json.tenantId,\n  kind: 'blog',\n  reason: 'publish_failed_after_retries: ' + JSON.stringify($json).slice(0, 200)\n}) }}",
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
    "For each tenant": {
      main: [[{ node: "Claude Code generate post", type: "main", index: 0 }]],
    },
    "Claude Code generate post": {
      main: [[{ node: "Pexels cover image", type: "main", index: 0 }]],
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
  versionId: "8010b810-0000-4810-8810-000000008011",
  tags: [],
};

const outPath = resolve(here, "seo-blog-tick.json");
writeFileSync(outPath, JSON.stringify(workflow, null, 2) + "\n");
console.log(`wrote ${outPath}`);
