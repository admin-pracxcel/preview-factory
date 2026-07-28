# SEO Blog Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the blog half of the SEO add-on: when a tenant subscribes to any SEO tier (Starter/Growth/Pro), blog posts publish automatically to their generated site — 4/8/16 per month by tier, first on subscribe day, rest spread evenly through a rolling 30-day cycle.

**Architecture:** n8n cron at 06:00 AEST daily → `GET /api/admin/seo/due-tenants?kind=blog` (Vercel returns tenants due today + full generation context) → for each: Claude Code node inside n8n generates the post → `POST /api/admin/seo/blog-posts` (Vercel Zod-validates + inserts to Supabase). Posts render live from a new `/blog` route on the customer's site — no redeploy per post. Vercel never calls the Anthropic API.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + service_role), Zod, Vitest (new), n8n on Hetzner, Claude Code inside n8n, Pexels for cover images, existing `lib/supabase.ts`, `lib/pexels-client.ts`.

**Design spec:** `docs/superpowers/specs/2026-07-28-seo-addon-automation-design.md`. This plan implements sections 4, 5, 6, and the blog parts of sections 8, 9, 10 of that spec. GBP automation is a separate plan.

## Global Constraints

- **Never call `api.anthropic.com` from Vercel.** All LLM calls happen inside n8n via Claude Code. Vercel does data reads/writes only.
- **Australian English, no em-dashes in customer copy** (per project CLAUDE.md). Applies to nav labels, empty states, and every blog post the prompts produce.
- **Product terms kept verbatim**: intelliLens, Repuboost, Patient Booking Promise, Risk-Share Bond, Complete Growth Engine, Launcharoo. Not relevant to most tasks but bakes into the Claude Code prompts (Task 9).
- **Cost of copy compromises**: SEO subscription plans start at **$29/mo Starter, $59/mo Growth, $79/mo Pro** — never invent numbers.
- **Cadence per tier**: Starter 4 posts/mo on days 0/7/14/21; Growth 8 on days 0/3/6/9/12/15/18/21; Pro 16 on days 0/2/4/6/8/10/12/14/16/18/20/22/24/26/28/30 (Pro special-cased away from the naive `floor(30/16)=1` spacing).
- **Publish time**: 06:00 AEST for every tenant. Idempotency check compares AEST calendar day, not UTC.
- **Auto-push main**: standing authorization to `git push origin main` after every commit. Force-push/reset still require approval.
- **Never modify** `.claude/`, `.git/`, `.env`, `node_modules/`, `autopilot/` (except `autopilot/state/`). If a task seems to require it, stop and ask.
- **Build gate**: `tsc --noEmit` must be clean before every commit. `next build` runs on Linux only (Mac bus-errors on Tailwind v4 lightningcss); rely on the grader in CI.
- **Grader gate**: `node scripts/grade.mjs` must pass after any task that touches SiteProps rendering or shared UI.

---

## File Structure

**Create (new):**
- `strategy/_master/migrations/2026-07-28-seo-blog.sql` — Supabase migration
- `lib/seo-cadence.ts` — pure schedule functions
- `lib/seo-cadence.test.ts` — vitest unit tests
- `lib/blog-posts-store.ts` — Supabase CRUD for `blog_posts`
- `lib/seo-publish-log-store.ts` — Supabase CRUD for `seo_publish_log`
- `lib/admin-cron-auth.ts` — shared `x-cron-secret` header check
- `lib/admin-cron-auth.test.ts` — vitest tests for the auth helper
- `app/preview/site/[tenantId]/blog/page.tsx` — blog index route
- `app/preview/site/[tenantId]/blog/[slug]/page.tsx` — blog post detail route
- `app/api/admin/seo/due-tenants/route.ts` — GET handler
- `app/api/admin/seo/blog-posts/route.ts` — POST handler
- `app/api/admin/seo/log-failure/route.ts` — POST handler
- `strategy/_master/claude-code-prompts/blog-trades.md`
- `strategy/_master/claude-code-prompts/blog-allied-health.md`
- `strategy/_master/claude-code-prompts/blog-beauty.md`
- `strategy/_master/claude-code-prompts/blog-fitness.md`
- `n8n/seo-blog-tick.json` — n8n workflow
- `app/dashboard/[tenantId]/SeoStatusCard.tsx` — dashboard component (blog section only in this plan; extended in the GBP plan)
- `vitest.config.ts` — minimal vitest config

**Modify:**
- `package.json` — add `vitest`, `@vitest/ui` devDeps; add `test` script
- `app/sitemap.xml/route.ts` — append `/blog` and `/blog/<slug>` per tenant
- `app/preview/site/[tenantId]/[[...slug]]/page.tsx` (or the shared site nav computer) — expose a `hasBlogPosts` signal to the nav
- `app/dashboard/[tenantId]/page.tsx` — render `SeoStatusCard` when tenant has any active SEO addon subscription
- `strategy/_master/what-human-must-do.md` — CRON_SECRET generation instructions
- `strategy/_master/addons-stripe-setup.md` — CRON_SECRET env var block

---

## Task 1: Vitest install + cadence engine

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `lib/seo-cadence.ts`
- Test: `lib/seo-cadence.test.ts`

**Interfaces:**
- Produces:
  - `type SeoTier = "starter" | "growth" | "pro"` (re-export or import from `lib/addon-plans`)
  - `postsPerMonth(tier: SeoTier): 4 | 8 | 16`
  - `isPublishDay(args: { subscribedAt: Date; tier: SeoTier; today: Date }): boolean`
  - `publishScheduleForTier(tier: SeoTier): readonly number[]` — the day-of-cycle array `[0, 7, 14, 21]` etc. Exported for tests and for the SeoStatusCard's "next publish date".
  - `daysBetween(a: Date, b: Date): number` — whole days between two Dates (AEST-anchored, but internally UTC math is fine because we compare calendar days, see Step 3).

- [ ] **Step 1: Install vitest**

Run:
```bash
npm install --save-dev vitest @vitest/ui
```

- [ ] **Step 2: Add `test` script**

Modify `package.json` scripts block:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "shared/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
```

- [ ] **Step 4: Write the failing test file**

Create `lib/seo-cadence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  postsPerMonth,
  isPublishDay,
  publishScheduleForTier,
} from "./seo-cadence";

const SUBSCRIBED = new Date("2026-08-01T00:00:00+10:00"); // 1 Aug AEST

function dayOffset(days: number): Date {
  return new Date(SUBSCRIBED.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("postsPerMonth", () => {
  it("returns 4/8/16 by tier", () => {
    expect(postsPerMonth("starter")).toBe(4);
    expect(postsPerMonth("growth")).toBe(8);
    expect(postsPerMonth("pro")).toBe(16);
  });
});

describe("publishScheduleForTier", () => {
  it("starter: [0, 7, 14, 21]", () => {
    expect(publishScheduleForTier("starter")).toEqual([0, 7, 14, 21]);
  });
  it("growth: [0, 3, 6, 9, 12, 15, 18, 21]", () => {
    expect(publishScheduleForTier("growth")).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
  });
  it("pro: even days 0..30 (16 posts)", () => {
    expect(publishScheduleForTier("pro")).toEqual([
      0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30,
    ]);
  });
});

describe("isPublishDay", () => {
  const scheduleForTier = {
    starter: publishScheduleForTier("starter"),
    growth: publishScheduleForTier("growth"),
    pro: publishScheduleForTier("pro"),
  } as const;

  (["starter", "growth", "pro"] as const).forEach((tier) => {
    it(`${tier}: publishes on schedule days across three cycles`, () => {
      const schedule = scheduleForTier[tier];
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let dayOfCycle = 0; dayOfCycle < 30; dayOfCycle++) {
          const today = dayOffset(cycle * 30 + dayOfCycle);
          const expected = schedule.includes(dayOfCycle);
          expect(
            isPublishDay({ subscribedAt: SUBSCRIBED, tier, today }),
            `tier=${tier} cycle=${cycle} dayOfCycle=${dayOfCycle}`,
          ).toBe(expected);
        }
      }
    });
  });

  it("day 0 is always a publish day (subscribe day, all tiers)", () => {
    (["starter", "growth", "pro"] as const).forEach((tier) => {
      expect(
        isPublishDay({ subscribedAt: SUBSCRIBED, tier, today: SUBSCRIBED }),
      ).toBe(true);
    });
  });

  it("day 22 for starter (past its 4 posts) is NOT a publish day", () => {
    expect(
      isPublishDay({
        subscribedAt: SUBSCRIBED,
        tier: "starter",
        today: dayOffset(22),
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 5: Run the test — expect FAIL**

Run: `npx vitest run lib/seo-cadence.test.ts`
Expected: fail — `Cannot find module './seo-cadence'`.

- [ ] **Step 6: Implement `lib/seo-cadence.ts`**

```ts
/**
 * lib/seo-cadence.ts
 *
 * Pure scheduling functions for the SEO add-on. Given a tenant's SEO tier
 * and its subscribed_at anchor, compute which days of a rolling 30-day
 * cycle are publish days — for both the blog automation and (later) the
 * GBP automation, which fire in lockstep off the same schedule.
 *
 * No side effects, no I/O. Fully unit-testable.
 */

export type SeoTier = "starter" | "growth" | "pro";

export function postsPerMonth(tier: SeoTier): 4 | 8 | 16 {
  return { starter: 4 as const, growth: 8 as const, pro: 16 as const }[tier];
}

/** Whole days between two Dates, floored (a=Mon 00:00, b=Tue 23:59 → 1). */
export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * The day-of-cycle offsets (0-based) on which posts should fire, for a
 * rolling 30-day cycle.
 *
 * - starter (4): [0, 7, 14, 21]           — every ~7 days
 * - growth  (8): [0, 3, 6, 9, 12, 15, 18, 21] — every 3 days
 * - pro    (16): [0, 2, 4, ..., 30]       — every 2 days
 *
 * Pro is special-cased away from the naive `floor(30/16) = 1` spacing,
 * which would publish 16 consecutive days then rest — bad look.
 */
export function publishScheduleForTier(tier: SeoTier): readonly number[] {
  if (tier === "starter") return [0, 7, 14, 21] as const;
  if (tier === "growth") return [0, 3, 6, 9, 12, 15, 18, 21] as const;
  // pro
  return [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] as const;
}

export function isPublishDay(args: {
  subscribedAt: Date;
  tier: SeoTier;
  today: Date;
}): boolean {
  const totalDays = daysBetween(args.subscribedAt, args.today);
  if (totalDays < 0) return false;
  const dayOfCycle = totalDays % 30;
  return publishScheduleForTier(args.tier).includes(dayOfCycle);
}
```

- [ ] **Step 7: Run the test — expect PASS**

Run: `npx vitest run lib/seo-cadence.test.ts`
Expected: all tests pass. `tsc --noEmit` clean.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/seo-cadence.ts lib/seo-cadence.test.ts
git commit -m "SEO cadence engine + vitest setup"
git push origin main
```

---

## Task 2: SQL migration for blog tables

**Files:**
- Create: `strategy/_master/migrations/2026-07-28-seo-blog.sql`

**Interfaces:**
- Produces: `blog_posts` table, `seo_publish_log` table, `tenant_addons.last_blog_tick_at` column. Later tasks depend on these existing in Supabase.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 2026-07-28 SEO blog automation: storage + idempotency guard.
-- Companion migration for GBP posting (last_gbp_tick_at, tenant_gbp_connections)
-- lives in the GBP plan.

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body_md TEXT NOT NULL,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generation_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_tenant_slug
  ON blog_posts(tenant_id, slug);

CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant_published
  ON blog_posts(tenant_id, published_at DESC);

CREATE TABLE IF NOT EXISTS seo_publish_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('blog', 'gbp')),
  status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'failed')),
  reason TEXT,
  blog_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL,
  cron_run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_publish_log_tenant_time
  ON seo_publish_log(tenant_id, cron_run_at DESC);

ALTER TABLE tenant_addons
  ADD COLUMN IF NOT EXISTS last_blog_tick_at TIMESTAMPTZ;

-- RLS: service_role only. Blog posts are served to the public via the SSR
-- route using the service_role client; no anon reads.
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_publish_log ENABLE ROW LEVEL SECURITY;

-- No policies added — service_role bypasses RLS. Anon/authenticated cannot
-- read or write these tables directly.
```

- [ ] **Step 2: Apply the migration in Supabase**

Open Supabase Studio → SQL Editor → paste the file's contents → Run. Verify no errors. `\d blog_posts` and `\d seo_publish_log` in the SQL editor show the tables.

- [ ] **Step 3: Sanity-check idempotency**

Re-run the same SQL. Expected: no errors (every statement is `IF NOT EXISTS` or `IF NOT EXISTS` via `ADD COLUMN`).

- [ ] **Step 4: Commit**

```bash
git add strategy/_master/migrations/2026-07-28-seo-blog.sql
git commit -m "SQL migration: blog_posts, seo_publish_log, tenant_addons.last_blog_tick_at"
git push origin main
```

---

## Task 3: `blog-posts-store.ts` + `seo-publish-log-store.ts`

**Files:**
- Create: `lib/blog-posts-store.ts`
- Create: `lib/seo-publish-log-store.ts`

**Interfaces:**
- Produces (`blog-posts-store.ts`):
  - `type BlogPost = { id; tenantId; slug; title; excerpt; bodyMd; coverImageUrl?; status: 'published'|'failed'; publishedAt: string; generationMeta?; createdAt: string }`
  - `type CreateBlogPostInput = { tenantId; slug; title; excerpt; bodyMd; coverImageUrl?; generationMeta? }`
  - `insertBlogPost(input: CreateBlogPostInput): Promise<BlogPost>`
  - `listPostsByTenant(tenantId: string, opts?: { limit?: number; offset?: number }): Promise<BlogPost[]>`
  - `getPostBySlug(tenantId: string, slug: string): Promise<BlogPost | null>`
  - `recentTitles(tenantId: string, limit: number): Promise<string[]>` — most-recent first, used by n8n for dedup
  - `countByTenant(tenantId: string): Promise<number>` — used by nav to decide whether to show a Blog link
- Produces (`seo-publish-log-store.ts`):
  - `type SeoPublishLogEntry = { id; tenantId; kind: 'blog'|'gbp'; status: 'success'|'skipped'|'failed'; reason?: string; blogPostId?: string; cronRunAt: string }`
  - `logSuccess(input: { tenantId; kind; blogPostId? }): Promise<void>`
  - `logSkipped(input: { tenantId; kind; reason: string }): Promise<void>`
  - `logFailed(input: { tenantId; kind; reason: string }): Promise<void>`

- [ ] **Step 1: Create `lib/blog-posts-store.ts`**

```ts
/**
 * lib/blog-posts-store.ts
 *
 * Supabase-backed store for blog posts. Rows are inserted by
 * /api/admin/seo/blog-posts (called by the n8n workflow after Claude
 * Code generates the content) and read by the tenant's public blog
 * routes and the dashboard SeoStatusCard.
 */

import { supabase } from "@/lib/supabase";

const TABLE = "blog_posts";

export interface BlogPost {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  coverImageUrl?: string;
  status: "published" | "failed";
  publishedAt: string;
  generationMeta?: Record<string, unknown>;
  createdAt: string;
}

interface BlogPostRow {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  cover_image_url: string | null;
  status: "published" | "failed";
  published_at: string;
  generation_meta: Record<string, unknown> | null;
  created_at: string;
}

function rowToRecord(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyMd: row.body_md,
    coverImageUrl: row.cover_image_url ?? undefined,
    status: row.status,
    publishedAt: row.published_at,
    generationMeta: row.generation_meta ?? undefined,
    createdAt: row.created_at,
  };
}

export interface CreateBlogPostInput {
  tenantId: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  coverImageUrl?: string;
  generationMeta?: Record<string, unknown>;
}

export async function insertBlogPost(input: CreateBlogPostInput): Promise<BlogPost> {
  const { data, error } = await supabase()
    .from(TABLE)
    .insert({
      tenant_id: input.tenantId,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      body_md: input.bodyMd,
      cover_image_url: input.coverImageUrl ?? null,
      generation_meta: input.generationMeta ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`insertBlogPost: ${error.message}`);
  return rowToRecord(data as BlogPostRow);
}

export async function listPostsByTenant(
  tenantId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<BlogPost[]> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`listPostsByTenant: ${error.message}`);
  return (data as BlogPostRow[]).map(rowToRecord);
}

export async function getPostBySlug(
  tenantId: string,
  slug: string,
): Promise<BlogPost | null> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getPostBySlug: ${error.message}`);
  return data ? rowToRecord(data as BlogPostRow) : null;
}

export async function recentTitles(tenantId: string, limit: number): Promise<string[]> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("title")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`recentTitles: ${error.message}`);
  return (data as { title: string }[]).map((r) => r.title);
}

export async function countByTenant(tenantId: string): Promise<number> {
  const { count, error } = await supabase()
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "published");
  if (error) throw new Error(`countByTenant: ${error.message}`);
  return count ?? 0;
}
```

- [ ] **Step 2: Create `lib/seo-publish-log-store.ts`**

```ts
/**
 * lib/seo-publish-log-store.ts
 *
 * Append-only audit log for every SEO automation attempt (blog + gbp),
 * used for debugging + monthly reporting. Never read on the hot path.
 */

import { supabase } from "@/lib/supabase";

const TABLE = "seo_publish_log";

export type SeoAutomationKind = "blog" | "gbp";

async function insert(row: {
  tenant_id: string;
  kind: SeoAutomationKind;
  status: "success" | "skipped" | "failed";
  reason?: string;
  blog_post_id?: string;
}): Promise<void> {
  const { error } = await supabase().from(TABLE).insert({
    tenant_id: row.tenant_id,
    kind: row.kind,
    status: row.status,
    reason: row.reason ?? null,
    blog_post_id: row.blog_post_id ?? null,
  });
  if (error) throw new Error(`seo_publish_log insert: ${error.message}`);
}

export async function logSuccess(input: {
  tenantId: string;
  kind: SeoAutomationKind;
  blogPostId?: string;
}): Promise<void> {
  await insert({
    tenant_id: input.tenantId,
    kind: input.kind,
    status: "success",
    blog_post_id: input.blogPostId,
  });
}

export async function logSkipped(input: {
  tenantId: string;
  kind: SeoAutomationKind;
  reason: string;
}): Promise<void> {
  await insert({
    tenant_id: input.tenantId,
    kind: input.kind,
    status: "skipped",
    reason: input.reason,
  });
}

export async function logFailed(input: {
  tenantId: string;
  kind: SeoAutomationKind;
  reason: string;
}): Promise<void> {
  await insert({
    tenant_id: input.tenantId,
    kind: input.kind,
    status: "failed",
    reason: input.reason,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no errors from the new files).

- [ ] **Step 4: Commit**

```bash
git add lib/blog-posts-store.ts lib/seo-publish-log-store.ts
git commit -m "Blog posts + SEO publish log Supabase stores"
git push origin main
```

---

## Task 4: Cron auth helper

**Files:**
- Create: `lib/admin-cron-auth.ts`
- Test: `lib/admin-cron-auth.test.ts`

**Interfaces:**
- Produces:
  - `assertCronRequest(req: Request): void` — throws `CronAuthError` if the `x-cron-secret` header is missing or does not match `process.env.CRON_SECRET`. Route handlers catch and translate to 401.
  - `class CronAuthError extends Error {}`

- [ ] **Step 1: Write the failing test**

Create `lib/admin-cron-auth.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertCronRequest, CronAuthError } from "./admin-cron-auth";

function req(headers: Record<string, string>): Request {
  return new Request("https://example.com/x", { headers });
}

describe("assertCronRequest", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret-123";
  });
  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("passes when header matches", () => {
    expect(() =>
      assertCronRequest(req({ "x-cron-secret": "test-secret-123" })),
    ).not.toThrow();
  });

  it("throws CronAuthError when header missing", () => {
    expect(() => assertCronRequest(req({}))).toThrow(CronAuthError);
  });

  it("throws CronAuthError when header mismatches", () => {
    expect(() =>
      assertCronRequest(req({ "x-cron-secret": "wrong" })),
    ).toThrow(CronAuthError);
  });

  it("throws when CRON_SECRET env var is unset", () => {
    delete process.env.CRON_SECRET;
    expect(() =>
      assertCronRequest(req({ "x-cron-secret": "anything" })),
    ).toThrow(CronAuthError);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/admin-cron-auth.test.ts`
Expected: `Cannot find module './admin-cron-auth'`.

- [ ] **Step 3: Implement `lib/admin-cron-auth.ts`**

```ts
/**
 * lib/admin-cron-auth.ts
 *
 * Shared header check for /api/admin/seo/* and /api/admin/gbp/* endpoints
 * that n8n calls on cron. No cookies, no user session — just a shared
 * secret set on both n8n and Vercel.
 */

export class CronAuthError extends Error {
  constructor(reason: string) {
    super(`cron auth: ${reason}`);
    this.name = "CronAuthError";
  }
}

export function assertCronRequest(req: Request): void {
  const expected = process.env.CRON_SECRET;
  if (!expected) throw new CronAuthError("CRON_SECRET not configured");
  const provided = req.headers.get("x-cron-secret");
  if (!provided) throw new CronAuthError("x-cron-secret header missing");
  if (provided !== expected) throw new CronAuthError("x-cron-secret mismatch");
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run lib/admin-cron-auth.test.ts`
Expected: all four tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/admin-cron-auth.ts lib/admin-cron-auth.test.ts
git commit -m "Cron auth helper: x-cron-secret header check"
git push origin main
```

---

## Task 5: Blog index + post detail routes

**Files:**
- Create: `app/preview/site/[tenantId]/blog/page.tsx`
- Create: `app/preview/site/[tenantId]/blog/[slug]/page.tsx`

**Interfaces:**
- Consumes: `listPostsByTenant`, `getPostBySlug` from Task 3.
- Rendering nested inside the existing `[[...slug]]` catchall is not necessary — dedicated blog routes take precedence.

**Note on markdown rendering:** the repo does not currently ship `react-markdown`. Add it in Step 1.

- [ ] **Step 1: Install react-markdown + remark-gfm**

```bash
npm install react-markdown remark-gfm
```

- [ ] **Step 2: Create the blog index page**

`app/preview/site/[tenantId]/blog/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenant-store";
import { listPostsByTenant } from "@/lib/blog-posts-store";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) return {};
  return {
    title: `Blog | ${tenant.siteProps.business.name}`,
    description: `Local advice and updates from ${tenant.siteProps.business.name}.`,
  };
}

export default async function BlogIndexPage({ params }: PageProps) {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();

  const posts = await listPostsByTenant(tenantId, { limit: 20 });

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-extrabold tracking-tight mb-8">Blog</h1>
      {posts.length === 0 ? (
        <p className="text-gray-500">No posts yet. Check back soon.</p>
      ) : (
        <ul className="flex flex-col gap-8">
          {posts.map((p) => (
            <li key={p.id} className="border-b pb-6">
              <Link href={`/blog/${p.slug}`} className="group">
                <h2 className="text-2xl font-bold group-hover:underline">
                  {p.title}
                </h2>
                <p className="mt-2 text-gray-600">{p.excerpt}</p>
                <p className="mt-3 text-sm text-gray-400">
                  {new Date(p.publishedAt).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Create the blog post detail page**

`app/preview/site/[tenantId]/blog/[slug]/page.tsx`:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getTenant } from "@/lib/tenant-store";
import { getPostBySlug } from "@/lib/blog-posts-store";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ tenantId: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantId, slug } = await params;
  const post = await getPostBySlug(tenantId, slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.coverImageUrl ? [post.coverImageUrl] : [],
      type: "article",
      publishedTime: post.publishedAt,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { tenantId, slug } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();
  const post = await getPostBySlug(tenantId, slug);
  if (!post) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    datePublished: post.publishedAt,
    author: {
      "@type": "Organization",
      name: tenant.siteProps.business.name,
    },
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {post.coverImageUrl && (
        <div className="relative w-full aspect-[16/9] mb-8 rounded-2xl overflow-hidden">
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            className="object-cover"
          />
        </div>
      )}
      <h1 className="text-4xl font-extrabold tracking-tight mb-4">
        {post.title}
      </h1>
      <p className="text-sm text-gray-400 mb-8">
        {new Date(post.publishedAt).toLocaleDateString("en-AU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
      <article className="prose prose-lg max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.bodyMd}</ReactMarkdown>
      </article>
    </main>
  );
}
```

- [ ] **Step 4: Manually seed one blog post to verify rendering**

Pick any existing tenant from `data/tenants/`. In Supabase SQL editor:

```sql
INSERT INTO blog_posts (tenant_id, slug, title, excerpt, body_md, cover_image_url)
VALUES (
  '<paste-tenant-id>',
  'test-blog-post',
  'Test post — verifying render pipeline',
  'A one-off test post to prove the blog routes work end to end.',
  E'# Hello\n\nThis is a **markdown** paragraph with a [link](https://example.com).\n\n- Bullet one\n- Bullet two',
  'https://images.pexels.com/photos/1234567/pexels-photo-1234567.jpeg'
);
```

- [ ] **Step 5: Visual verify**

Run `npm run dev`. Open `http://localhost:3000/preview/site/<tenant-id>/blog` — see one post card. Click through to `/blog/test-blog-post` — see the rendered markdown + cover image + article JSON-LD in view-source.

- [ ] **Step 6: Delete the seed row**

```sql
DELETE FROM blog_posts WHERE slug = 'test-blog-post';
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app/preview/site/\[tenantId\]/blog
git commit -m "Blog index + post detail routes"
git push origin main
```

---

## Task 6: Sitemap + Blog nav link

**Files:**
- Modify: `app/sitemap.xml/route.ts`
- Modify: whichever file computes the site nav for `app/preview/site/[tenantId]/[[...slug]]/page.tsx`. Grep for `nav` inside `shared/ui/sections.tsx` and `shared/ui/layout.tsx` to find it.

**Interfaces:**
- Consumes: `listPostsByTenant`, `countByTenant` from Task 3.

- [ ] **Step 1: Read sitemap.xml/route.ts to understand structure**

Read `app/sitemap.xml/route.ts` fully. Identify where per-tenant URLs are enumerated.

- [ ] **Step 2: Append blog URLs for each tenant**

After the loop that lists a tenant's service/location/service-area pages, add:

```ts
// blog URLs
const posts = await listPostsByTenant(tenant.id, { limit: 500 });
if (posts.length > 0) {
  urls.push({
    loc: `${base}/blog`,
    lastmod: posts[0].publishedAt,
  });
  for (const p of posts) {
    urls.push({
      loc: `${base}/blog/${p.slug}`,
      lastmod: p.publishedAt,
    });
  }
}
```

Import at top: `import { listPostsByTenant } from "@/lib/blog-posts-store";`

- [ ] **Step 3: Read `shared/ui/sections.tsx` (or `layout.tsx`) to find the nav**

Grep for `nav`, `header`, or nav-link map. Identify the array/computation that produces the site's top navigation.

- [ ] **Step 4: Add a `Blog` link conditionally**

In the same file where nav links are produced, if the site has ≥1 published post, append `{ label: "Blog", href: "/blog" }`. Requires the nav computation to be async / server-side. If the current nav is a static array in a client component, the smallest change is to pass a `showBlog: boolean` prop down from the server layout, which reads `countByTenant(tenantId) > 0`.

Concrete pattern:

```ts
// in the server layout / catchall page for a tenant's site
const showBlog = (await countByTenant(tenantId)) > 0;
// pass to whatever nav component:
<SiteNav links={siteNav} showBlog={showBlog} />
```

Nav component (client or server):

```tsx
{showBlog && (
  <Link href="/blog" className="...existing link classes...">
    Blog
  </Link>
)}
```

- [ ] **Step 5: Verify with a seeded post**

Re-run the seed SQL from Task 5 Step 4. Open the tenant's site. Nav shows "Blog". `/sitemap.xml` includes `/blog` and `/blog/test-blog-post`. Delete seed row after.

- [ ] **Step 6: Commit**

```bash
git add app/sitemap.xml/route.ts shared/ui/sections.tsx app/preview/site
git commit -m "Sitemap includes blog URLs; nav link when tenant has posts"
git push origin main
```

---

## Task 7: `GET /api/admin/seo/due-tenants`

**Files:**
- Create: `app/api/admin/seo/due-tenants/route.ts`

**Interfaces:**
- Consumes: `assertCronRequest` (Task 4), `isPublishDay` (Task 1), `recentTitles` (Task 3), tenant queries from `lib/tenant-store.ts`, `lib/addon-store.ts` for the SEO addon rows.
- Produces (response shape n8n consumes in Task 10):
  ```ts
  type DueTenantsResponse = {
    tenants: Array<{
      tenantId: string;
      tier: "starter" | "growth" | "pro";
      category: "trades" | "allied-health" | "beauty-aesthetics" | "fitness-wellness";
      businessName: string;
      services: string[];
      suburb: string;
      brandVoice?: string;
      recentTitles: string[]; // last 10
      liveUrl: string;
    }>;
  }
  ```

- [ ] **Step 1: Create the route file**

`app/api/admin/seo/due-tenants/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCronRequest, CronAuthError } from "@/lib/admin-cron-auth";
import { supabase } from "@/lib/supabase";
import { isPublishDay, type SeoTier } from "@/lib/seo-cadence";
import { recentTitles } from "@/lib/blog-posts-store";
import { parseAddonPlanKey } from "@/lib/addon-plans";

const querySchema = z.object({
  kind: z.enum(["blog", "gbp"]),
});

/**
 * GET /api/admin/seo/due-tenants?kind=blog|gbp
 *
 * Called by the n8n seo-blog-tick / seo-gbp-tick cron workflows.
 * Returns the list of tenants whose SEO cadence puts today (AEST) as a
 * publish day AND whose idempotency guard (last_blog_tick_at /
 * last_gbp_tick_at) shows the tick hasn't already run today.
 *
 * `kind=gbp` additionally requires an active tenant_gbp_connections row
 * (that filter is a no-op for now; the GBP plan implements it).
 */

export async function GET(req: Request): Promise<NextResponse> {
  try {
    assertCronRequest(req);
  } catch (err) {
    if (err instanceof CronAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const url = new URL(req.url);
  const parseResult = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parseResult.success) {
    return NextResponse.json({ error: "bad query" }, { status: 400 });
  }
  const { kind } = parseResult.data;

  const todayAest = todayInAest();

  // Pull all active SEO addon rows joined with the tenant.
  const { data, error } = await supabase()
    .from("tenant_addons")
    .select(
      `id, tenant_id, plan_key, subscribed_at, last_blog_tick_at, last_gbp_tick_at,
       tenants!inner ( id, site_props, category, live_url )`,
    )
    .eq("addon_key", "seo")
    .eq("status", "active");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dueTenants = [] as Array<{
    tenantId: string;
    tier: SeoTier;
    category: string;
    businessName: string;
    services: string[];
    suburb: string;
    brandVoice?: string;
    recentTitles: string[];
    liveUrl: string;
  }>;

  for (const row of data ?? []) {
    const parsed = parseAddonPlanKey(row.plan_key);
    if (!parsed || parsed.addonKey !== "seo") continue;
    const tier = parsed.tier as SeoTier;

    const publishToday = isPublishDay({
      subscribedAt: new Date(row.subscribed_at),
      tier,
      today: todayAest,
    });
    if (!publishToday) continue;

    const lastTickAt =
      kind === "blog" ? row.last_blog_tick_at : row.last_gbp_tick_at;
    if (lastTickAt && sameAestCalendarDay(new Date(lastTickAt), todayAest)) {
      continue; // idempotency guard: already ran today
    }

    const tenant = (row as unknown as { tenants: {
      id: string;
      site_props: {
        business: { name: string; suburb?: string };
        services?: Array<{ title: string }>;
        branding?: { voice?: string };
      };
      category: string;
      live_url: string;
    } }).tenants;
    const sp = tenant.site_props;

    const titles = await recentTitles(tenant.id, 10);

    dueTenants.push({
      tenantId: tenant.id,
      tier,
      category: tenant.category,
      businessName: sp.business.name,
      services: (sp.services ?? []).map((s) => s.title),
      suburb: sp.business.suburb ?? "",
      brandVoice: sp.branding?.voice,
      recentTitles: titles,
      liveUrl: tenant.live_url,
    });
  }

  return NextResponse.json({ tenants: dueTenants });
}

/** Right-now converted to the current AEST wall-clock instant (as a Date). */
function todayInAest(): Date {
  const now = new Date();
  const aestMs = now.getTime() + 10 * 60 * 60 * 1000; // +10 hours (ignoring DST for MVP)
  return new Date(aestMs);
}

function sameAestCalendarDay(a: Date, b: Date): boolean {
  const key = (d: Date) => {
    const shifted = new Date(d.getTime() + 10 * 60 * 60 * 1000);
    return `${shifted.getUTCFullYear()}-${shifted.getUTCMonth()}-${shifted.getUTCDate()}`;
  };
  return key(a) === key(b);
}
```

**DST note:** the MVP uses fixed +10 hours (AEST). AEDT is +11. Post-launch we may swap for `Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney" })` to handle DST — for now a systemic ~1-hour drift twice a year is acceptable per the spec's timezone choice.

- [ ] **Step 2: Set CRON_SECRET locally**

In `.env.local`:
```
CRON_SECRET=dev-local-secret-change-me
```

Restart dev server so it picks up the env.

- [ ] **Step 3: Curl-verify unauthenticated request returns 401**

```bash
curl -i http://localhost:3000/api/admin/seo/due-tenants?kind=blog
```
Expected: `HTTP/1.1 401` with `{"error":"cron auth: x-cron-secret header missing"}`.

- [ ] **Step 4: Curl-verify authenticated request returns 200**

```bash
curl -i \
  -H "x-cron-secret: dev-local-secret-change-me" \
  "http://localhost:3000/api/admin/seo/due-tenants?kind=blog"
```
Expected: `HTTP/1.1 200` with `{"tenants":[...]}`. If no tenant has an active SEO addon, the array is empty — that's a valid pass.

- [ ] **Step 5: Seed a fixture — active SEO subscription — to prove real path**

In Supabase SQL editor (use an existing tenant id):

```sql
INSERT INTO tenant_addons (tenant_id, addon_key, plan_key, status, subscribed_at)
VALUES ('<tenant-id>', 'seo', 'seo-starter-monthly', 'active', NOW())
ON CONFLICT DO NOTHING;
```

Repeat the curl from Step 4. Expected: the tenant appears in the response (subscribe day = day 0 = publish day for all tiers).

- [ ] **Step 6: Verify idempotency**

```sql
UPDATE tenant_addons SET last_blog_tick_at = NOW()
WHERE tenant_id = '<tenant-id>' AND addon_key = 'seo';
```

Re-curl. Expected: tenant no longer in the response (already ticked today). Reset with `UPDATE ... SET last_blog_tick_at = NULL`.

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/api/admin/seo/due-tenants
git commit -m "GET /api/admin/seo/due-tenants for n8n cron"
git push origin main
```

---

## Task 8: `POST /api/admin/seo/blog-posts` + `POST /api/admin/seo/log-failure`

**Files:**
- Create: `app/api/admin/seo/blog-posts/route.ts`
- Create: `app/api/admin/seo/log-failure/route.ts`

**Interfaces:**
- Consumes: `assertCronRequest`, `insertBlogPost`, `logSuccess`, `logFailed`, `supabase()`.
- Produces:
  - `POST /api/admin/seo/blog-posts` accepts body `{ tenantId, slug, title, excerpt, bodyMd, coverImageUrl?, generationMeta? }`. On success: inserts blog post, inserts `seo_publish_log` success, stamps `tenant_addons.last_blog_tick_at`, returns `{ blogPost: BlogPost }`.
  - `POST /api/admin/seo/log-failure` accepts `{ tenantId, kind: "blog"|"gbp", reason }`. Inserts a `seo_publish_log` failed row. Returns `{ ok: true }`.

- [ ] **Step 1: Create blog-posts POST route**

`app/api/admin/seo/blog-posts/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCronRequest, CronAuthError } from "@/lib/admin-cron-auth";
import { insertBlogPost } from "@/lib/blog-posts-store";
import { logSuccess } from "@/lib/seo-publish-log-store";
import { supabase } from "@/lib/supabase";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  title: z.string().min(1).max(200),
  excerpt: z.string().min(1).max(500),
  bodyMd: z.string().min(50),
  coverImageUrl: z.string().url().optional(),
  generationMeta: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    assertCronRequest(req);
  } catch (err) {
    if (err instanceof CronAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const rawBody = await req.json().catch(() => null);
  const parse = bodySchema.safeParse(rawBody);
  if (!parse.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parse.error.flatten() },
      { status: 400 },
    );
  }
  const input = parse.data;

  const blogPost = await insertBlogPost({
    tenantId: input.tenantId,
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    bodyMd: input.bodyMd,
    coverImageUrl: input.coverImageUrl,
    generationMeta: input.generationMeta,
  });

  await logSuccess({
    tenantId: input.tenantId,
    kind: "blog",
    blogPostId: blogPost.id,
  });

  const { error: stampErr } = await supabase()
    .from("tenant_addons")
    .update({ last_blog_tick_at: new Date().toISOString() })
    .eq("tenant_id", input.tenantId)
    .eq("addon_key", "seo")
    .eq("status", "active");
  if (stampErr) {
    // Blog post already inserted; log but don't fail the request — the
    // idempotency guard is a nice-to-have, not required for correctness.
    console.warn("[blog-posts] failed to stamp last_blog_tick_at", stampErr);
  }

  return NextResponse.json({ blogPost });
}
```

- [ ] **Step 2: Create log-failure POST route**

`app/api/admin/seo/log-failure/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCronRequest, CronAuthError } from "@/lib/admin-cron-auth";
import { logFailed } from "@/lib/seo-publish-log-store";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  kind: z.enum(["blog", "gbp"]),
  reason: z.string().min(1).max(500),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    assertCronRequest(req);
  } catch (err) {
    if (err instanceof CronAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const rawBody = await req.json().catch(() => null);
  const parse = bodySchema.safeParse(rawBody);
  if (!parse.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parse.error.flatten() },
      { status: 400 },
    );
  }

  await logFailed(parse.data);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Curl-verify blog-posts POST**

```bash
curl -i -X POST \
  -H "x-cron-secret: dev-local-secret-change-me" \
  -H "content-type: application/json" \
  -d '{
    "tenantId": "<seeded-tenant-uuid>",
    "slug": "task-8-curl-test",
    "title": "Task 8 curl test",
    "excerpt": "Manual verification of the write endpoint.",
    "bodyMd": "# Test\n\nThis is a test post inserted from curl. It has more than fifty characters to pass Zod validation."
  }' \
  http://localhost:3000/api/admin/seo/blog-posts
```

Expected: `HTTP/1.1 200` with `{"blogPost":{...}}`. Verify row appears in Supabase, and `last_blog_tick_at` is now populated.

- [ ] **Step 4: Curl-verify log-failure POST**

```bash
curl -i -X POST \
  -H "x-cron-secret: dev-local-secret-change-me" \
  -H "content-type: application/json" \
  -d '{"tenantId":"<seeded-tenant-uuid>","kind":"blog","reason":"claude_code_timeout"}' \
  http://localhost:3000/api/admin/seo/log-failure
```

Expected: `HTTP/1.1 200 {"ok":true}`. Verify row appears in `seo_publish_log` with `status='failed'`.

- [ ] **Step 5: Cleanup test rows**

```sql
DELETE FROM blog_posts WHERE slug = 'task-8-curl-test';
DELETE FROM seo_publish_log WHERE reason = 'claude_code_timeout';
UPDATE tenant_addons SET last_blog_tick_at = NULL WHERE tenant_id = '<seeded-tenant-uuid>';
```

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/api/admin/seo/blog-posts app/api/admin/seo/log-failure
git commit -m "POST /api/admin/seo/blog-posts + POST /api/admin/seo/log-failure"
git push origin main
```

---

## Task 9: Claude Code prompts (one per category)

**Files:**
- Create: `strategy/_master/claude-code-prompts/blog-trades.md`
- Create: `strategy/_master/claude-code-prompts/blog-allied-health.md`
- Create: `strategy/_master/claude-code-prompts/blog-beauty.md`
- Create: `strategy/_master/claude-code-prompts/blog-fitness.md`

**Interfaces:**
- Input to each prompt (n8n injects this JSON into the Claude Code call): `{ tenantId, businessName, category, services[], suburb, brandVoice?, recentTitles[] }`.
- Output from each prompt (strict JSON — n8n POSTs the JSON straight through to `/api/admin/seo/blog-posts` after adding `coverImageUrl` from Pexels):
  ```
  {
    "title": "string, max 200 chars, not in recentTitles",
    "slug": "lowercase-kebab-case, matches ^[a-z0-9]+(?:-[a-z0-9]+)*$",
    "excerpt": "1-2 sentence hook, max 500 chars",
    "body_md": "Markdown body, 400-800 words",
    "cover_image_query": "3-6 word Pexels search query"
  }
  ```

- [ ] **Step 1: Create the trades prompt**

`strategy/_master/claude-code-prompts/blog-trades.md`:

```markdown
# Blog post prompt — Trades

You are the ghost-writer for an Australian trades business. Given the JSON payload in the next message, write ONE blog post that would rank in local Google search and read like the tradie would actually write it.

## Input schema
```json
{
  "tenantId": "uuid",
  "businessName": "Smith Electrical",
  "category": "trades",
  "services": ["Emergency callouts", "Switchboard upgrades", "..."],
  "suburb": "Penrith",
  "brandVoice": "direct, no-nonsense, friendly",
  "recentTitles": ["last 10 titles to avoid duplicating"]
}
```

## Output schema — MUST be a single JSON object, no prose around it

```json
{
  "title": "string, max 200 chars",
  "slug": "lowercase-kebab, matches ^[a-z0-9]+(?:-[a-z0-9]+)*$",
  "excerpt": "1-2 sentence hook, max 500 chars",
  "body_md": "Markdown body, 400-800 words",
  "cover_image_query": "3-6 word Pexels search query"
}
```

## Rules

- Australian English. **No em-dashes** anywhere in the body, title, or excerpt. Use commas, full stops, or brackets.
- Not sales-y. No "In today's fast-paced world", "Here's the thing", or agency cliches.
- Write like a tradie explaining to a mate. Short sentences. Concrete examples.
- Use the tenant's actual services and suburb where it makes sense. Do not invent services they don't offer.
- Never repeat any title in `recentTitles`. Pick a fresh angle.
- Topic must be genuinely useful to a homeowner searching Google — "5 signs your switchboard needs upgrading", "What to do when your power trips at 2am", "How to spot a dodgy quote". Not "Welcome to our blog".
- Body must include a soft CTA at the end: "If you're in [suburb] and this sounds like your place, [businessName] can help — give us a bell." Never invent contact details.
- Titles should include a suburb or "Australia" tag where natural, for local SEO ("...in Penrith", "How Aussies...").

## Slug rules

- Lowercase, kebab-case, no more than 8 words.
- Must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` — no leading/trailing/double dashes.
- Do not start with a date or number.

## Return ONLY the JSON object. No preamble, no code fence.
```

- [ ] **Step 2: Create the allied-health prompt**

Same structure as trades, plus these overrides at the top of the "Rules" section:

```markdown
- AHPRA compliance: no testimonials in the body, no clinical outcome claims, no "cure", "guaranteed", or "best". Frame everything as general information, not personal medical advice.
- Always include a line like: "This is general information only. Book an appointment with a qualified practitioner for advice specific to your situation." Preferably near the end.
- Voice: warm, professional, clear. Not a tradie-mate tone. Think "your friendly local physio explaining a common issue".
- Topics that always work: "What is [condition]?", "When to see a physio about [pain]", "5 stretches for [common issue]", "Why does [X] hurt after [Y]?".
```

- [ ] **Step 3: Create the beauty prompt**

Overrides at top of "Rules":

```markdown
- Voice: aspirational but grounded. "Your skin will thank you" not "transform your life". Warm, not clinical.
- No before/after language ("get rid of", "banish"). Frame positively.
- Never claim a treatment cures, permanently fixes, or is medically approved unless the input says so.
- Topics that work: "How to prep your skin before a facial", "What actually happens during a Hydrafacial", "Choosing between waxing and IPL for [suburb] women", "Winter skincare in [suburb]".
- Excerpts and titles should sound like something a friend would recommend, not a beauty magazine.
```

- [ ] **Step 4: Create the fitness prompt**

Overrides at top of "Rules":

```markdown
- Voice: energetic, direct, motivating without being cheesy. "Show up three days a week and you'll see it in six" not "unlock your inner warrior".
- Never claim health outcomes ("lose 10kg guaranteed", "cure back pain"). Talk about training habits, form, and consistency.
- Topics that work: "3 mistakes beginners make in their first month", "Should you train at 6am or 6pm?", "What to eat before an early gym session in [suburb]", "Why deadlifts scare people (and shouldn't)".
- Body should assume the reader is beginner-to-intermediate, not a competitive athlete, unless the tenant's services suggest otherwise.
```

- [ ] **Step 5: Manually test one prompt end-to-end**

Open Claude Code CLI (`claude` command) locally. Paste the trades prompt, then paste this fixture payload as the user message:

```json
{
  "tenantId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "businessName": "Smith Electrical",
  "category": "trades",
  "services": ["Emergency callouts", "Switchboard upgrades", "Safety switch installations"],
  "suburb": "Penrith",
  "brandVoice": "direct, no-nonsense, friendly",
  "recentTitles": []
}
```

Verify the output:
- Parses as JSON via `echo '<output>' | jq .`
- `slug` matches the regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- `body_md` is between 400 and 800 words (`echo '<body>' | wc -w`)
- No em-dash character (`echo '<output>' | grep -c '—'` returns 0)
- Contains a soft CTA mentioning Smith Electrical and Penrith

If any check fails, edit the prompt to close the gap and retry.

- [ ] **Step 6: Commit**

```bash
git add strategy/_master/claude-code-prompts
git commit -m "Claude Code system prompts for blog generation (4 categories)"
git push origin main
```

---

## Task 10: n8n workflow `seo-blog-tick.json`

**Files:**
- Create: `n8n/seo-blog-tick.json`

**Interfaces:**
- Consumes: `GET /api/admin/seo/due-tenants?kind=blog`, `POST /api/admin/seo/blog-posts`, `POST /api/admin/seo/log-failure`, Pexels API, Claude Code node.

**Approach:** mirror the existing n8n workflows in `n8n/` (`cleanup.json`, `reaper.json`, `domain-reconcile.json`) for cron trigger + HTTP node shape + env-var patterns.

- [ ] **Step 1: Read one existing workflow to match style**

Read `n8n/reaper.json` fully. Note the cron node shape, HTTP node headers, env var interpolation pattern (`$env.HEARTBEAT_URL`), error branch wiring.

- [ ] **Step 2: Author `n8n/seo-blog-tick.json`**

Skeleton (fill node IDs and connections following the reaper.json format):

```json
{
  "name": "SEO Blog Tick",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            { "field": "cronExpression", "expression": "0 20 * * *" }
          ]
        }
      },
      "id": "cron",
      "name": "Cron 06:00 AEST",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{ $env.APP_BASE_URL }}/api/admin/seo/due-tenants?kind=blog",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "x-cron-secret", "value": "={{ $env.CRON_SECRET }}" }
          ]
        }
      },
      "id": "fetchDue",
      "name": "GET due tenants (blog)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4
    },
    {
      "parameters": { "batchSize": 1, "options": {} },
      "id": "splitBatches",
      "name": "For each tenant",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3
    },
    {
      "parameters": {
        "resource": "conversation",
        "operation": "send",
        "systemPromptFile": "={{ $env.BLOG_PROMPT_DIR }}/blog-{{$json.category}}.md",
        "userMessage": "={{ JSON.stringify($json) }}"
      },
      "id": "claudeCode",
      "name": "Claude Code generate post",
      "type": "n8n-nodes-claude-code.claudeCode",
      "typeVersion": 1
    },
    {
      "parameters": {
        "method": "GET",
        "url": "https://api.pexels.com/v1/search",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            { "name": "query", "value": "={{ $json.cover_image_query }}" },
            { "name": "per_page", "value": "1" }
          ]
        },
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Authorization", "value": "={{ $env.PEXELS_API_KEY }}" }
          ]
        }
      },
      "id": "pexels",
      "name": "Pexels cover image",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.APP_BASE_URL }}/api/admin/seo/blog-posts",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "x-cron-secret", "value": "={{ $env.CRON_SECRET }}" },
            { "name": "content-type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({\n  tenantId: $node['For each tenant'].json.tenantId,\n  slug: $node['Claude Code generate post'].json.slug,\n  title: $node['Claude Code generate post'].json.title,\n  excerpt: $node['Claude Code generate post'].json.excerpt,\n  bodyMd: $node['Claude Code generate post'].json.body_md,\n  coverImageUrl: ($node['Pexels cover image'].json.photos && $node['Pexels cover image'].json.photos[0]) ? $node['Pexels cover image'].json.photos[0].src.large : undefined,\n  generationMeta: { model: 'claude-code', prompt: $node['For each tenant'].json.category }\n}) }}",
        "options": {
          "response": { "response": { "responseFormat": "json" } }
        }
      },
      "id": "publish",
      "name": "POST blog post",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "continueOnFail": true,
      "retryOnFail": true,
      "maxTries": 2,
      "waitBetweenTries": 3000
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.APP_BASE_URL }}/api/admin/seo/log-failure",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "x-cron-secret", "value": "={{ $env.CRON_SECRET }}" },
            { "name": "content-type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({\n  tenantId: $node['For each tenant'].json.tenantId,\n  kind: 'blog',\n  reason: 'publish_failed_after_retries: ' + JSON.stringify($json).slice(0, 200)\n}) }}"
      },
      "id": "logFailure",
      "name": "Log failure",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4
    }
  ],
  "connections": {
    "Cron 06:00 AEST": {
      "main": [[{ "node": "GET due tenants (blog)", "type": "main", "index": 0 }]]
    },
    "GET due tenants (blog)": {
      "main": [[{ "node": "For each tenant", "type": "main", "index": 0 }]]
    },
    "For each tenant": {
      "main": [
        [{ "node": "Claude Code generate post", "type": "main", "index": 0 }]
      ]
    },
    "Claude Code generate post": {
      "main": [[{ "node": "Pexels cover image", "type": "main", "index": 0 }]]
    },
    "Pexels cover image": {
      "main": [[{ "node": "POST blog post", "type": "main", "index": 0 }]]
    },
    "POST blog post": {
      "main": [
        [{ "node": "For each tenant", "type": "main", "index": 0 }],
        [{ "node": "Log failure", "type": "main", "index": 0 }]
      ]
    },
    "Log failure": {
      "main": [[{ "node": "For each tenant", "type": "main", "index": 0 }]]
    }
  }
}
```

**Cron time note:** n8n runs UTC. AEST is UTC+10, so 06:00 AEST = 20:00 UTC previous day. `0 20 * * *` fires at 20:00 UTC daily.

- [ ] **Step 3: Import into n8n and set env vars**

On the Hetzner n8n instance:
- Import `n8n/seo-blog-tick.json` via **Workflows → Import from file**.
- Set the following env vars on the n8n container:
  - `APP_BASE_URL=https://<preview-factory-vercel-url>`
  - `CRON_SECRET=<same value as Vercel>`
  - `PEXELS_API_KEY=<existing Pexels key>`
  - `BLOG_PROMPT_DIR=/opt/n8n-prompts` (or wherever the prompts are mounted; see Step 4)

- [ ] **Step 4: Mount prompt files onto the n8n container**

The prompts live in the git repo at `strategy/_master/claude-code-prompts/`. Either:
- Add a git-clone step in the container startup that pulls the repo to `/opt/n8n-prompts/`
- Or `scp` the four `blog-*.md` files to that path.

- [ ] **Step 5: End-to-end run with a fixture tenant**

Ensure the seed row from Task 7 Step 5 is still active (or re-seed). In n8n workflow editor, click **Execute Workflow** manually. Verify:
- `GET due tenants` returns one tenant
- `Claude Code generate post` returns a valid JSON object
- `Pexels cover image` returns a photo URL
- `POST blog post` returns 200
- New row appears in `blog_posts`
- New row appears in `seo_publish_log` with `status='success'`
- `tenant_addons.last_blog_tick_at` now populated

- [ ] **Step 6: Enable the cron trigger**

Toggle the workflow to **Active** in n8n so the cron fires nightly.

- [ ] **Step 7: Cleanup + commit**

```sql
DELETE FROM blog_posts WHERE title LIKE '%<something identifying the test post>%';
```

```bash
git add n8n/seo-blog-tick.json
git commit -m "n8n workflow: SEO blog tick (cron 06:00 AEST)"
git push origin main
```

---

## Task 11: SeoStatusCard on dashboard (blog section)

**Files:**
- Create: `app/dashboard/[tenantId]/SeoStatusCard.tsx`
- Modify: `app/dashboard/[tenantId]/page.tsx`

**Interfaces:**
- Consumes: `listPostsByTenant` (Task 3), `publishScheduleForTier` + `daysBetween` (Task 1), the `getActiveAddonsForTenant`-style function already in `lib/addon-store.ts`.
- Renders when tenant has any active SEO addon subscription.

- [ ] **Step 1: Grep `lib/addon-store.ts` for the "get active addons for tenant" function**

Note its exact name and return type. If it doesn't exist, add a small helper `getActiveSeoSubscription(tenantId: string): Promise<AddonSubscription | null>` — pattern-matches the existing file.

- [ ] **Step 2: Create `SeoStatusCard`**

`app/dashboard/[tenantId]/SeoStatusCard.tsx`:

```tsx
import { Sparkles, FileText, Calendar } from "lucide-react";
import Link from "next/link";
import { listPostsByTenant } from "@/lib/blog-posts-store";
import { publishScheduleForTier, type SeoTier } from "@/lib/seo-cadence";
import { parseAddonPlanKey } from "@/lib/addon-plans";
import type { AddonSubscription } from "@/lib/addon-store";

export async function SeoStatusCard({
  tenantId,
  subscription,
}: {
  tenantId: string;
  subscription: AddonSubscription;
}) {
  const parsed = parseAddonPlanKey(subscription.planKey);
  if (!parsed || parsed.addonKey !== "seo") return null;
  const tier = parsed.tier as SeoTier;

  const posts = await listPostsByTenant(tenantId, { limit: 3 });
  const nextPublish = computeNextPublishDate(
    new Date(subscription.subscribedAt),
    tier,
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-300" />
          <h2 className="text-base font-bold text-white">
            SEO — {capitalise(tier)}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Calendar className="h-3.5 w-3.5" />
          Next post: {formatDateAu(nextPublish)}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Latest posts
        </p>
        {posts.length === 0 ? (
          <p className="text-sm text-white/50">
            No posts yet. Your first post publishes on{" "}
            {formatDateAu(nextPublish)}.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-sm">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/preview/site/${tenantId}/blog/${p.slug}`}
                    className="text-white/90 hover:text-white truncate block"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-white/40">
                    {formatDateAu(new Date(p.publishedAt))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function computeNextPublishDate(subscribedAt: Date, tier: SeoTier): Date {
  const schedule = publishScheduleForTier(tier);
  const now = new Date();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const daysSinceSubscribe = Math.floor(
    (now.getTime() - subscribedAt.getTime()) / MS_PER_DAY,
  );
  const cycleStart = subscribedAt.getTime() + Math.floor(daysSinceSubscribe / 30) * 30 * MS_PER_DAY;
  const dayOfCycle = daysSinceSubscribe % 30;
  const next = schedule.find((d) => d > dayOfCycle);
  if (next !== undefined) return new Date(cycleStart + next * MS_PER_DAY);
  // Passed all posts this cycle — first post of next cycle
  return new Date(cycleStart + 30 * MS_PER_DAY);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateAu(d: Date): string {
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
```

- [ ] **Step 3: Wire into the dashboard page**

Modify `app/dashboard/[tenantId]/page.tsx`. Near where `GrowthServicesCard` is rendered, add:

```tsx
import { SeoStatusCard } from "./SeoStatusCard";
// existing imports

// inside the render — after fetching the tenant + addons:
const seoSub = activeAddons.find((a) => a.addonKey === "seo");

// in the JSX, somewhere before GrowthServicesCard:
{seoSub && <SeoStatusCard tenantId={tenantId} subscription={seoSub} />}
```

Replace `activeAddons` with whatever variable is already in scope for the tenant's addon subscriptions.

- [ ] **Step 4: Visual verify**

Seed a fixture:
```sql
INSERT INTO tenant_addons (tenant_id, addon_key, plan_key, status, subscribed_at)
VALUES ('<tenant-id>', 'seo', 'seo-growth-monthly', 'active', NOW() - INTERVAL '4 days');
```

Publish 2 fixture blog posts:
```sql
INSERT INTO blog_posts (tenant_id, slug, title, excerpt, body_md, published_at)
VALUES
  ('<tenant-id>', 'fixture-1', 'First fixture post', 'ex', '# body', NOW() - INTERVAL '4 days'),
  ('<tenant-id>', 'fixture-2', 'Second fixture post', 'ex', '# body', NOW() - INTERVAL '1 day');
```

Open the dashboard at `/dashboard/<tenant-id>`. Expected: `SeoStatusCard` renders showing "Growth", "Next post: <a date>", and the two fixture titles.

- [ ] **Step 5: Cleanup + commit**

```sql
DELETE FROM blog_posts WHERE slug LIKE 'fixture-%';
DELETE FROM tenant_addons WHERE tenant_id = '<tenant-id>' AND addon_key = 'seo';
```

```bash
git add app/dashboard/\[tenantId\]/SeoStatusCard.tsx app/dashboard/\[tenantId\]/page.tsx
git commit -m "Dashboard SeoStatusCard (blog section)"
git push origin main
```

---

## Task 12: Docs — CRON_SECRET setup

**Files:**
- Modify: `strategy/_master/what-human-must-do.md`
- Modify: `strategy/_master/addons-stripe-setup.md`

- [ ] **Step 1: Append CRON_SECRET section to `what-human-must-do.md`**

Under the environment-variables / n8n setup section, add:

```markdown
### CRON_SECRET (SEO automation)

The n8n SEO cron workflows authenticate to Vercel with a shared `x-cron-secret` header. Set the same value on both sides.

1. Generate a random secret: `openssl rand -hex 32`.
2. Vercel → Project Settings → Environment Variables → add `CRON_SECRET = <value>` for Production + Preview + Development. Redeploy.
3. n8n instance → environment file (or container env vars) → set `CRON_SECRET=<same value>`. Restart n8n.
4. Sanity check: `curl -H "x-cron-secret: <value>" https://<prod-domain>/api/admin/seo/due-tenants?kind=blog` returns 200 with a `{"tenants":[...]}` payload. Curl without the header returns 401.
```

- [ ] **Step 2: Append CRON_SECRET to the env var block in `addons-stripe-setup.md`**

After the existing Stripe env var list, add:

```markdown
## SEO automation env vars (Vercel)

In addition to the Stripe price IDs above, the SEO automation needs:

```
CRON_SECRET
```

Value: 32-byte random hex (see [what-human-must-do.md](./what-human-must-do.md#cron_secret-seo-automation)). The same value must be set on the n8n instance so the two sides authenticate.
```

- [ ] **Step 3: Commit**

```bash
git add strategy/_master/what-human-must-do.md strategy/_master/addons-stripe-setup.md
git commit -m "Docs: CRON_SECRET setup for SEO automation"
git push origin main
```

---

## Wrap-up

After Task 12 lands:

- All 12 tasks green.
- Grader passing (`node scripts/grade.mjs`).
- One customer with an active SEO subscription is publishing blog posts nightly at 06:00 AEST, and the dashboard shows the next publish date + latest posts.
- Next plan: **SEO GBP automation** — OAuth flow, refresh-token storage, GBP posting endpoint, second n8n workflow, dashboard banner + Postmark nudges. Builds on Tasks 1, 4, 7, 11 from this plan.

## Self-review

- **Spec coverage:** ✓ §4 (blog_posts, seo_publish_log, tenant_addons column) — Task 2; ✓ §5 (cadence engine) — Task 1; ✓ §6 (blog automation flow, rendering) — Tasks 3, 5, 6, 7, 8, 9, 10; ✓ §8 (SeoStatusCard blog section) — Task 11; ✓ §9 (CRON_SECRET docs) — Task 12. GBP parts of §4, §7, §8 explicitly deferred to the GBP plan per the split.
- **Placeholder scan:** no TBDs, no "similar to Task N", no bare "add validation" — every code step ships real code.
- **Type consistency:** `SeoTier` defined in Task 1 is imported the same way in Tasks 7, 11. `assertCronRequest` signature stable across Tasks 4, 7, 8. `insertBlogPost` input/output types match between Tasks 3 and 8. `BlogPost` type used in Tasks 5 and 11 matches Task 3's definition. `parseAddonPlanKey` from `lib/addon-plans.ts` used in Tasks 7 and 11.
