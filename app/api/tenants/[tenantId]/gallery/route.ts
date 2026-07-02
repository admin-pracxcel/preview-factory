/**
 * GET  /api/tenants/[tenantId]/gallery       → current image URLs
 * POST /api/tenants/[tenantId]/gallery       → refresh from Pexels (body: {query?})
 * PATCH /api/tenants/[tenantId]/gallery      → explicit URL list (body: {urls})
 *
 * Lets the CustomisePanel either ask the server to pick fresh stock photos
 * for the tenant's niche, or apply a specific set of URLs the user picked.
 * Persists into `tenant.siteProps.home.gallery[i].image_url`.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenant, saveTenant } from "@/lib/tenant-store";
import { searchPexels } from "@/lib/pexels-client";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  const urls = (tenant.siteProps.home.gallery ?? []).map((g) => g.image_url);
  return NextResponse.json({
    urls,
    /** Surface whether the tenant has GBP photos saved at intake time — the
     *  customise panel uses this to show a "Use Google photos" button. */
    gbpPhotoCount: tenant.gbpPhotos?.length ?? 0,
  });
}

/** PUT /api/tenants/[tenantId]/gallery — restore the original GBP photos. */
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  const photos = tenant.gbpPhotos ?? [];
  if (photos.length === 0) {
    return NextResponse.json({ error: "No Google photos saved for this business." }, { status: 404 });
  }
  const gallery = tenant.siteProps.home.gallery ?? [];
  if (gallery.length === 0) {
    return NextResponse.json({ error: "Tenant has no gallery items" }, { status: 400 });
  }
  const updated = gallery.map((item, i) => ({
    ...item,
    image_url: photos[i % photos.length],
  }));
  await saveTenant({
    ...tenant,
    siteProps: {
      ...tenant.siteProps,
      home: { ...tenant.siteProps.home, gallery: updated },
    },
  });
  return NextResponse.json({ urls: updated.map((g) => g.image_url) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const query = (body.query?.trim()) || tenant.niche || "small business";

  const gallery = tenant.siteProps.home.gallery ?? [];
  if (gallery.length === 0) {
    return NextResponse.json({ error: "Tenant has no gallery items" }, { status: 400 });
  }

  const urls = await searchPexels(query, gallery.length);
  if (urls.length === 0) {
    return NextResponse.json(
      { error: "Pexels returned no results (check PEXELS_API_KEY)" },
      { status: 502 }
    );
  }

  // Apply URLs in order; reuse cyclically if Pexels returned fewer than gallery slots.
  const updated = gallery.map((item, i) => ({
    ...item,
    image_url: urls[i % urls.length],
  }));

  await saveTenant({
    ...tenant,
    siteProps: {
      ...tenant.siteProps,
      home: { ...tenant.siteProps.home, gallery: updated },
    },
  });

  return NextResponse.json({ urls: updated.map((g) => g.image_url) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { urls?: string[] } | null;
  if (!body?.urls || !Array.isArray(body.urls)) {
    return NextResponse.json({ error: "Body must be { urls: string[] }" }, { status: 400 });
  }

  const gallery = tenant.siteProps.home.gallery ?? [];
  const updated = gallery.map((item, i) => ({
    ...item,
    image_url: body.urls![i] ?? item.image_url,
  }));

  await saveTenant({
    ...tenant,
    siteProps: {
      ...tenant.siteProps,
      home: { ...tenant.siteProps.home, gallery: updated },
    },
  });

  return NextResponse.json({ urls: updated.map((g) => g.image_url) });
}
