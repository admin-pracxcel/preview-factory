/**
 * POST /api/admin/tenants/[tenantId]/delete
 *
 * Hard-deletes a tenant and every row/object tied to it. Admin-only —
 * `isAdminSession` gates the route, so a missing/wrong cookie gets 404 and
 * the route stays hidden.
 *
 * Order matters: storage first (external side effect), then dependent rows,
 * then the tenants row last so a failure part-way leaves the tenant record
 * around for retry.
 *
 * Not touched — these tables are not tenant-scoped:
 *   sessions, magic_tokens, rate_limits, processed_events, worker_health
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { isAdminSession } from "@/lib/admin";
import type { MutableCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "previews";

async function removeStorageFolder(tenantId: string): Promise<void> {
  const { data, error } = await supabase()
    .storage.from(STORAGE_BUCKET)
    .list(tenantId, { limit: 1000 });
  if (error) {
    console.error(`[admin:delete] storage list failed for ${tenantId}:`, error);
    return;
  }
  if (!data || data.length === 0) return;
  const paths = data.map((obj) => `${tenantId}/${obj.name}`);
  const { error: removeError } = await supabase()
    .storage.from(STORAGE_BUCKET)
    .remove(paths);
  if (removeError) {
    console.error(`[admin:delete] storage remove failed for ${tenantId}:`, removeError);
  }
}

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await ctx.params;
  if (!tenantId) {
    return NextResponse.json({ error: "missing tenantId" }, { status: 400 });
  }

  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  const admin = await isAdminSession(cookieStore);
  if (!admin) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const client = supabase();

  const { data: tenant, error: fetchError } = await client
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .maybeSingle();
  if (fetchError) {
    console.error(`[admin:delete] tenant lookup failed for ${tenantId}:`, fetchError);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!tenant) {
    return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  }

  console.log(`[admin:delete] purging tenant=${tenantId} name="${tenant.name}"`);

  await removeStorageFolder(tenantId);

  const dependentTables = ["leads", "jobs", "edit_requests"] as const;
  for (const table of dependentTables) {
    const { error } = await client.from(table).delete().eq("tenant_id", tenantId);
    if (error) {
      console.error(`[admin:delete] ${table} delete failed for ${tenantId}:`, error);
      return NextResponse.json(
        { error: `failed to clear ${table}` },
        { status: 500 },
      );
    }
  }

  const { error: tenantDeleteError } = await client
    .from("tenants")
    .delete()
    .eq("id", tenantId);
  if (tenantDeleteError) {
    console.error(`[admin:delete] tenants delete failed for ${tenantId}:`, tenantDeleteError);
    return NextResponse.json(
      { error: "failed to delete tenant row" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
