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
 *
 * Note: `live_url` is not a column on the tenants table — it is computed
 * in-code from the incoming request origin.
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
  const origin = new URL(req.url).origin;

  // Pull all active SEO addon rows joined with the tenant.
  // live_url is NOT a column on tenants — omitted from SELECT and computed below.
  const { data, error } = await supabase()
    .from("tenant_addons")
    .select(
      `id, tenant_id, plan_key, subscribed_at, last_blog_tick_at, last_gbp_tick_at,
       tenants!inner ( id, site_props, category )`,
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
      liveUrl: `${origin}/preview/site/${tenant.id}`,
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
