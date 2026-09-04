/**
 * app/api/intake/route.ts
 * POST /api/intake
 *
 * Async intake pipeline (Phase 4). Returns in <200ms with a tenantId, then
 * n8n drains the queue and fills in site_props out of band.
 *
 *   1. Validate body ({ gbpData?, placeId?, businessName?, niche, ... })
 *   2. Resolve GBP data (fetch from Places API if not supplied)
 *   3. Ensure the visitor has a session cookie (links tenant -> browser)
 *   4. Insert tenants row with status='queued'
 *   5. Insert jobs row with the generator CLI payload
 *   6. Fire the n8n webhook, fire-and-forget (never blocks the response)
 *   7. Return { tenantId, ... }
 *
 * The old synchronous "run generation inline then save" path is gone. The
 * client now polls GET /api/tenants/[id]/status until status transitions to
 * 'done' (success) or 'failed'.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchByPlaceId, fetchByName, type GbpData } from "@/lib/places-client";
import { resolveCategory } from "@/lib/generator-api";
import { createQueuedTenant, saveTenant, getTenant } from "@/lib/tenant-store";
import { reserveSlug } from "@/lib/slug";
import { enqueueJob } from "@/lib/jobs-store";
import { ensureSession, type MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

interface IntakeBody {
  /** Pre-fetched GBP payload (from /api/lookup). When provided, skip the Places fetch. */
  gbpData?: GbpData;
  placeId?: string;
  businessName?: string;
  niche: string;
  suburb?: string;
  /** Form-supplied category slug (e.g. "beauty", "fitness"). Authoritative when set. */
  category?: string;
  /** Owner mobile captured in the intake confirm step. Persisted on the
   *  tenant row so we can SMS the preview link and reach out for edits. */
  phone?: string;
  /** Campaign cohort tag (email marketing generation). When present, the
   *  request is treated as server-triggered: session cookie is skipped and
   *  the tenant is persisted with `campaign_source` + `expires_at` set.
   *  Requires the `x-worker-secret` header to match WORKER_SHARED_SECRET. */
  campaignSource?: string;
  /** Days until the campaign-generated preview expires. Only honoured when
   *  campaignSource is set. Defaults to 30. */
  expiryDays?: number;
}

const CAMPAIGN_DEFAULT_EXPIRY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: IntakeBody;
  try {
    body = (await request.json()) as IntakeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    gbpData: providedGbp,
    placeId,
    businessName,
    niche,
    suburb,
    category: formCategory,
    phone,
    campaignSource,
    expiryDays,
  } = body;

  if (!niche || typeof niche !== "string") {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }
  if (!providedGbp && !placeId && !businessName) {
    return NextResponse.json(
      { error: "gbpData, placeId, or businessName is required" },
      { status: 400 },
    );
  }

  // Campaign-generated intake: gate the campaign fields on the shared worker
  // secret. Without this a random visitor could set campaignSource to bypass
  // the 3h expiry (giving themselves a 30-day preview) or salt the analytics
  // cohorts with fake tags.
  const isCampaign = Boolean(campaignSource);
  if (isCampaign) {
    const expectedSecret = process.env.WORKER_SHARED_SECRET;
    const suppliedSecret = request.headers.get("x-worker-secret");
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "campaign intake requires x-worker-secret" },
        { status: 401 },
      );
    }
    if (typeof campaignSource !== "string" || !campaignSource.trim()) {
      return NextResponse.json(
        { error: "campaignSource must be a non-empty string" },
        { status: 400 },
      );
    }
    if (
      expiryDays !== undefined &&
      (typeof expiryDays !== "number" || expiryDays <= 0)
    ) {
      return NextResponse.json(
        { error: "expiryDays must be a positive number" },
        { status: 400 },
      );
    }
  }

  try {
    // 1. Resolve GBP data
    let gbpData: GbpData;
    if (providedGbp) {
      console.log(`[intake] using provided gbpData for "${providedGbp.name}".`);
      gbpData = providedGbp;
    } else {
      console.log(`[intake] fetching GBP for niche="${niche}"...`);
      gbpData = placeId
        ? await fetchByPlaceId(placeId, niche)
        : await fetchByName(businessName!, niche, suburb);
    }

    // 2. Resolve category — drives prompt selection + template routing
    const category = resolveCategory(niche, formCategory);
    console.log(
      `[intake] resolved category="${category}" (niche="${niche}", form="${formCategory ?? "none"}")`,
    );

    // 3. Session cookie — links this tenant to the visitor's browser for claim.
    // Campaign intake is server-triggered (n8n has no browser) so there's no
    // session to link; skip and let session_id stay null. The customer who
    // later clicks the email link gets their own session on first visit and
    // can claim via the standard email-owner match path.
    let sessionId: string | undefined;
    if (!isCampaign) {
      const cookieStore = (await cookies()) as unknown as MutableCookies;
      sessionId = await ensureSession(cookieStore, {
        ip: request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
    }

    // Campaign previews get an explicit expiry timestamp; organic flow leaves
    // it null and falls through to the default createdAt+3h rule in the
    // preview page.
    const expiresAt = isCampaign
      ? new Date(
          Date.now() + (expiryDays ?? CAMPAIGN_DEFAULT_EXPIRY_DAYS) * DAY_MS,
        ).toISOString()
      : undefined;

    // 4. Create the tenant row in status=queued (no site_props yet).
    const tenantId = await createQueuedTenant({
      category,
      name: gbpData.name,
      niche,
      placeId,
      gbpPhotos: gbpData.photos ?? [],
      sessionId,
      phone: phone?.trim() || undefined,
      campaignSource: isCampaign ? campaignSource!.trim() : undefined,
      expiresAt,
    });

    // 4b. Reserve a public subdomain slug for <slug>.launcharoo.online. The
    //     slug can be derived only after the tenant row exists (collision
    //     handling needs the tenantId in scope for owner-owns-same-slug case).
    //     Non-fatal — if reservation fails we leave slug null and log; the
    //     tenant is still usable via /preview/site/<tenantId>.
    try {
      const slug = await reserveSlug(gbpData.name, tenantId);
      const tenant = await getTenant(tenantId);
      if (tenant) await saveTenant({ ...tenant, slug });
    } catch (err) {
      console.warn(`[intake] slug reservation failed for ${tenantId}:`, err);
    }

    // 5. Enqueue the generator job with the CLI payload contract (see
    //    generator/cli.ts). Same shape as scripts/fixtures/gbp-trades.json.
    const jobId = await enqueueJob({
      tenantId,
      payload: {
        v: 1,
        tenant_id: tenantId,
        category,
        gbp_data: gbpData,
        uploaded_images: [],
      },
    });

    // 6. Fire n8n webhook — fire-and-forget. If n8n is down or the URL is
    //    unset, the job stays queued and n8n's 30s cron trigger picks it up.
    fireWorkerWebhook(jobId, tenantId).catch((err) => {
      console.warn("[intake] worker webhook fire-and-forget failed:", err);
    });

    console.log(
      `[intake] tenant ${tenantId} queued (job ${jobId})${isCampaign ? ` [campaign=${campaignSource!.trim()} expires=${expiresAt}]` : ""}`,
    );

    return NextResponse.json({
      tenantId,
      name: gbpData.name,
      niche,
      category,
      previewUrl: `/preview/${tenantId}`,
      sitePreviewUrl: `/preview/site/${tenantId}`,
      ...(isCampaign ? { campaignSource: campaignSource!.trim(), expiresAt } : {}),
    });
  } catch (err) {
    console.error("[intake] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Best-effort POST to the n8n webhook. Never throws — surface warnings via
 * the caller's .catch(). Missing URL is a non-error (dev without n8n).
 */
async function fireWorkerWebhook(jobId: string, tenantId: string): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    console.warn(
      "[intake] N8N_WEBHOOK_URL not set — job stays queued for n8n cron pickup",
    );
    return;
  }
  const secret = process.env.WORKER_SHARED_SECRET ?? "";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": secret,
    },
    body: JSON.stringify({ job_id: jobId, tenant_id: tenantId }),
    // Don't hold the request open for a slow worker.
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    console.warn(`[intake] worker webhook returned ${res.status}`);
  }
}
