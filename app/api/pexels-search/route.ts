/**
 * GET /api/pexels-search?q=<query>&count=<n>
 *
 * Thin proxy over Pexels search. Used by the CustomisePanel's hero-image tab
 * so the API key stays server-side (Pexels requires it in a header; we don't
 * want it in client JS).
 */

import { NextRequest, NextResponse } from "next/server";
import { searchPexels } from "@/lib/pexels-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }
  const count = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get("count") ?? "12", 10) || 12, 1), 30);
  const urls = await searchPexels(q, count);
  return NextResponse.json({ urls });
}
