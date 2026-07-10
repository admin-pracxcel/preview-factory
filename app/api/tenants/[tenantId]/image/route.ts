/**
 * app/api/tenants/[tenantId]/image/route.ts
 * PATCH — swap the image URL at a specific SiteProps path.
 *
 * Powers the click-to-swap flow in the preview editor. Templates render
 * some `<img>`s wrapped with `data-editable-image="<dotted.path>"`. When
 * the owner clicks one, an in-iframe overlay opens a picker in the parent
 * page; on selection, this endpoint patches siteProps at the given path.
 *
 * Only explicitly-allowed paths can be written. The allowlist stops a
 * bad payload from clobbering arbitrary fields via a crafted path.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant, saveTenant } from "@/lib/tenant-store";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { applyRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ALLOWED_PATHS: RegExp[] = [
  /^home\.about\.photo_url$/,
  /^about\.photo_url$/,
  /^services\.\d+\.hero_image$/,
  /^services\.\d+\.body_image$/,
  /^locations\.\d+\.hero_image$/,
  /^home\.gallery\.\d+\.image_url$/,
  // Home hero lives on overrides.hero_image_url (with a fallback to
  // branding.hero_image_url). Reachable via the CustomisePanel today; not
  // yet tagged in-template because the home hero has CTAs whose clicks the
  // full-area click-to-swap overlay would hijack. Allowlist is ready for
  // when the overlay grows a hero-friendly variant.
  /^overrides\.hero_image_url$/,
];

interface Body {
  path?: string;
  url?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await params;

  const cookieStore = (await cookies()) as unknown as MutableCookies;
  try {
    await assertOwnsTenant(cookieStore, tenantId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "not allowed" },
      { status: 403 },
    );
  }

  const limited = await applyRateLimit({
    key: `image-edit:tenant:${tenantId}`,
    limit: 60,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const path = typeof body.path === "string" ? body.path.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!path || !url) {
    return NextResponse.json(
      { error: "Both path and url are required." },
      { status: 400 },
    );
  }
  if (!ALLOWED_PATHS.some((re) => re.test(path))) {
    return NextResponse.json(
      { error: `Path ${path} is not editable.` },
      { status: 400 },
    );
  }
  // The URL is rendered directly into <img src>, so we accept only https
  // URLs (and reject anything longer than 2000 chars, which is well past
  // any real Pexels/Supabase URL).
  if (!/^https:\/\/\S+$/.test(url) || url.length > 2000) {
    return NextResponse.json(
      { error: "URL must be a https:// address under 2000 chars." },
      { status: 400 },
    );
  }

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  if (!tenant.siteProps) {
    return NextResponse.json(
      { error: "Site is still generating — try again in a minute." },
      { status: 409 },
    );
  }

  const next = structuredClone(tenant.siteProps) as Record<string, unknown>;
  const segments = path.split(".");
  const leaf = segments.pop();
  if (!leaf) {
    return NextResponse.json({ error: "Malformed path." }, { status: 400 });
  }

  let cursor: Record<string, unknown> | unknown[] = next;
  for (const seg of segments) {
    const key = /^\d+$/.test(seg) ? Number(seg) : seg;
    if (Array.isArray(cursor)) {
      if (typeof key !== "number" || cursor[key] === undefined) {
        return NextResponse.json(
          { error: `Path ${path} does not exist on this site.` },
          { status: 404 },
        );
      }
      cursor = cursor[key] as Record<string, unknown> | unknown[];
    } else {
      if (typeof key === "number" || cursor[key] === undefined) {
        return NextResponse.json(
          { error: `Path ${path} does not exist on this site.` },
          { status: 404 },
        );
      }
      cursor = cursor[key] as Record<string, unknown> | unknown[];
    }
  }

  if (Array.isArray(cursor)) {
    const idx = /^\d+$/.test(leaf) ? Number(leaf) : NaN;
    if (Number.isNaN(idx)) {
      return NextResponse.json({ error: "Malformed path." }, { status: 400 });
    }
    (cursor as unknown[])[idx] = url;
  } else {
    // Service pages have a mid-page body_image that falls back to hero_image
    // in the template when unset. If someone swaps the hero while body_image
    // is still undefined, the mid-page banner would appear to change too
    // (via the fallback). Freeze the mid-page to the OLD hero URL first so
    // the two become independent from the first swap onwards.
    const serviceHeroMatch = /^services\.(\d+)\.hero_image$/.exec(path);
    if (serviceHeroMatch) {
      const idx = Number(serviceHeroMatch[1]);
      const service = (
        (next.services as Record<string, unknown>[] | undefined) ?? []
      )[idx] as Record<string, unknown> | undefined;
      if (
        service &&
        service.body_image === undefined &&
        typeof service.hero_image === "string"
      ) {
        service.body_image = service.hero_image;
      }
    }
    (cursor as Record<string, unknown>)[leaf] = url;
  }

  await saveTenant({
    ...tenant,
    siteProps: next as typeof tenant.siteProps,
  });

  return NextResponse.json({ path, url });
}
