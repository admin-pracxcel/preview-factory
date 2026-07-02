/**
 * POST /api/upload
 *
 * Accepts a multipart/form-data file ("file") and stores it under
 * `public/uploads/<tenantId>/<hash>.<ext>`. Returns the public URL.
 *
 * - Hash-based filenames give automatic dedupe across same-content uploads.
 * - tenantId is required (so files don't collide across customers).
 * - 5 MB cap; images only.
 *
 * Production note: swap to S3 / Vercel Blob / R2 for real deployments. This
 * works for local dev and proves the contract.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
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
      { error: `Unsupported type ${file.type}. Allowed: PNG, JPG, WebP, SVG.` },
      { status: 415 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
  const ext = EXT_BY_MIME[file.type];
  const filename = `${hash}.${ext}`;

  const dir = join(process.cwd(), "public", "uploads", tenantId);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  const path = join(dir, filename);
  if (!existsSync(path)) await writeFile(path, buf);

  const url = `/uploads/${tenantId}/${filename}`;
  return NextResponse.json({ url });
}
