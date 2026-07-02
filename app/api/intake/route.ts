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
import { createQueuedTenant } from "@/lib/tenant-store";
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
}

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

    // 3. Session cookie — links this tenant to the visitor's browser for claim
    const cookieStore = (await cookies()) as unknown as MutableCookies;
    const sessionId = await ensureSession(cookieStore, {
      ip: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    // 4. Create the tenant row in status=queued (no site_props yet).
    const tenantId = await createQueuedTenant({
      category,
      name: gbpData.name,
      niche,
      placeId,
      gbpPhotos: gbpData.photos ?? [],
      sessionId,
    });

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

    console.log(`[intake] tenant ${tenantId} queued (job ${jobId})`);

    return NextResponse.json({
      tenantId,
      name: gbpData.name,
      niche,
      category,
      previewUrl: `/preview/${tenantId}`,
      sitePreviewUrl: `/preview/site/${tenantId}`,
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
