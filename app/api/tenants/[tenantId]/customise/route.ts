/**
 * PATCH /api/tenants/[tenantId]/customise
 *
 * Persists user customisations (brand colours, logo URL, hero image URL) into
 * the tenant's `siteProps.overrides`. Called from the preview page after every
 * change (debounced). The rendered site's `resolveTheme` already prefers
 * overrides over branding, so a hard refresh shows the saved state.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenant, saveTenant } from "@/lib/tenant-store";

export const runtime = "nodejs";

interface CustomiseBody {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  hero_image_url?: string;
  chrome_theme?: "light" | "dark";
  logo_height_px?: number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  // Tenants can be in a mid-generation state where siteProps or the
  // branding subtree isn't populated yet. Guard so the customise panel
  // gets a clean shape instead of a 500 — it'll show its own defaults.
  const siteProps = tenant.siteProps;
  if (!siteProps || !siteProps.branding) {
    console.warn(
      `[customise:GET] tenant=${tenantId} siteProps or branding missing — returning defaults`,
    );
    return NextResponse.json({
      primary_color: "#0066cc",
      secondary_color: "#0066cc",
      accent_color: "#0066cc",
      logo_url: "",
      hero_image_url: "",
      chrome_theme: "light",
      logo_height_px: 36,
      niche: tenant.niche,
      pending: true,
    });
  }
  const branding = siteProps.branding;
  const overrides = siteProps.overrides ?? {};
  return NextResponse.json({
    primary_color: overrides.primary_color ?? branding.primary_color,
    secondary_color: overrides.secondary_color ?? branding.secondary_color ?? branding.primary_color,
    accent_color: overrides.accent_color ?? branding.accent_color ?? branding.primary_color,
    logo_url: overrides.logo_url ?? branding.logo_url ?? "",
    hero_image_url: overrides.hero_image_url ?? branding.hero_image_url ?? "",
    chrome_theme: overrides.chrome_theme ?? "light",
    logo_height_px: overrides.logo_height_px ?? 36,
    niche: tenant.niche,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  let body: CustomiseBody;
  try {
    body = (await request.json()) as CustomiseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const next: CustomiseBody = {
    ...(tenant.siteProps.overrides ?? {}),
    ...(body.primary_color !== undefined ? { primary_color: body.primary_color } : {}),
    ...(body.secondary_color !== undefined ? { secondary_color: body.secondary_color } : {}),
    ...(body.accent_color !== undefined ? { accent_color: body.accent_color } : {}),
    ...(body.logo_url !== undefined ? { logo_url: body.logo_url } : {}),
    ...(body.hero_image_url !== undefined ? { hero_image_url: body.hero_image_url } : {}),
    ...(body.chrome_theme !== undefined ? { chrome_theme: body.chrome_theme } : {}),
    ...(body.logo_height_px !== undefined ? { logo_height_px: body.logo_height_px } : {}),
  };

  await saveTenant({
    ...tenant,
    siteProps: {
      ...tenant.siteProps,
      overrides: next,
    },
  });

  return NextResponse.json({ overrides: next });
}
