/**
 * app/preview/[id]/page.tsx
 *
 * Ownership gate for the preview editor, with a deliberate carve-out:
 * unclaimed previews are viewable by anyone with the link. That's how a
 * customer who started on desktop can open the SMS preview link on their
 * phone and click Claim, without getting bounced to /login for a session
 * the phone has never had.
 *
 * Rules:
 *   - Tenant not found                → 404
 *   - Tenant expired (soft or hard)   → /expired  (no auth needed)
 *   - Tenant is claimed (published)   → session must own it, or admin
 *   - Tenant is unclaimed (preview)   → open access, no session required
 *
 * Note: the underlying edit APIs (contact, photo, copy) stay session-
 * gated via assertOwnsTenant. Cross-device access on an unclaimed
 * preview is view + claim only — a leaked link can't be vandalised.
 */

import { notFound, redirect } from "next/navigation";
import { cookies as nextCookies } from "next/headers";
import {
  readSession,
  assertOwnsTenant,
  findLatestTenantForSession,
  type MutableCookies,
} from "@/lib/session";
import { isAdminSession } from "@/lib/admin";
import { getTenant } from "@/lib/tenant-store";
import PreviewClient from "./PreviewClient";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = (await nextCookies()) as unknown as MutableCookies;

  const tenant = await getTenant(id);
  if (!tenant) notFound();

  // Expiry: same 3h soft-expiry rule as the public slug page, plus the
  // hard-expiry flag from the reaper. Everyone lands on /expired past the
  // window, no auth required.
  const admin = await isAdminSession(cookieStore);
  if (!admin) {
    if (tenant.isExpired) redirect(`/expired/${id}`);
    if (!tenant.publishedAt) {
      const ageMs = Date.now() - new Date(tenant.createdAt).getTime();
      if (ageMs > 3 * 3600_000) redirect(`/expired/${id}`);
    }
  }

  const isClaimed = tenant.status === "published" || !!tenant.publishedAt;

  // Claimed tenants keep the strict ownership gate. A random visitor with
  // the link should NOT be able to open the editor for a paid site.
  if (isClaimed && !admin) {
    const sessionId = readSession(cookieStore);
    if (!sessionId) {
      redirect("/login");
    }
    try {
      await assertOwnsTenant(cookieStore, id);
    } catch {
      const ownId = await findLatestTenantForSession(sessionId);
      redirect(ownId ? "/dashboard" : "/login");
    }
  }

  // Unclaimed → fall through and render the editor for anyone. Edit APIs
  // still enforce session ownership, so cross-device visitors can view
  // and click Claim/Buy but can't mutate the site.

  return <PreviewClient />;
}
