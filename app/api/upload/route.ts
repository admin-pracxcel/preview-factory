/**
 * POST /api/upload
 *
 * Accepts multipart/form-data with a `file` and `tenantId` field. Streams the
 * bytes to the Supabase `previews` storage bucket at
 * `<tenantId>/<hash>.<ext>` and returns the object's public URL.
 *
 * - Session cookie must own the tenantId (assertOwnsTenant, Phase 3).
 * - Raster only: PNG/JPG/WebP. SVG is rejected because it can embed scripts.
 * - 5 MB cap.
 * - Hash-based object key gives automatic dedupe across same-content uploads
 *   within a tenant folder (re-upload = same key = upsert = free).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { supabase } from "@/lib/supabase";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

const BUCKET = "previews";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  const tenantId = form.get("tenantId");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }
  if (typeof tenantId !== "string" || !tenantId) {
    return NextResponse.json({ error: "Missing 'tenantId' field" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported type ${file.type}. Allowed: PNG, JPG, WebP.` },
      { status: 415 },
    );
  }

  // Session must own the tenant. Prevents random visitors from filling up a
  // competitor's storage folder or overwriting their logo by URL guess.
  const cookieStore = (await cookies()) as unknown as MutableCookies;
  try {
    await assertOwnsTenant(cookieStore, tenantId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "not allowed" },
      { status: 403 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
  const ext = EXT_BY_MIME[file.type];
  const objectPath = `${tenantId}/${hash}.${ext}`;

  const { error: uploadError } = await supabase()
    .storage.from(BUCKET)
    .upload(objectPath, buf, {
      contentType: file.type,
      // Same content -> same hash -> same key. Upsert makes the second POST a
      // no-op instead of a 409, so retries and re-crops "just work".
      upsert: true,
      cacheControl: "public, max-age=31536000, immutable",
    });
  if (uploadError) {
    console.error("[upload] Supabase storage upload failed:", uploadError);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }

  const { data: pub } = supabase().storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({ url: pub.publicUrl });
}
