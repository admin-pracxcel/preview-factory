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
import { cookies as nextCookies, headers as nextHeaders } from "next/headers";
import {
  readSession,
  assertOwnsTenant,
  findLatestTenantForSession,
  type MutableCookies,
} from "@/lib/session";
import { isAdminSession } from "@/lib/admin";
import { getTenant, markFirstView } from "@/lib/tenant-store";
import { isLikelyBot } from "@/lib/bot-detection";
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

  const admin = await isAdminSession(cookieStore);

  // Click-to-start expiry (campaign tenants only). First non-bot,
  // non-admin visitor flips first_viewed_at and shortens expires_at to
  // NOW+5d. Everything downstream — the expiry redirect below, the
  // countdown UI, the reaper — reads the updated timestamp so the render
  // shows the real 5-day clock from first paint. markFirstView is a
  // no-op for organic tenants (campaign_source IS NULL) and for repeat
  // visits (first_viewed_at IS NOT NULL), enforced by the SQL WHERE.
  if (!admin && tenant.campaignSource && !tenant.firstViewedAt) {
    const ua = (await nextHeaders()).get("user-agent");
    if (!isLikelyBot(ua)) {
      const updated = await markFirstView(id);
      if (updated) {
        tenant.firstViewedAt = updated.firstViewedAt;
        tenant.expiresAt = updated.expiresAt;
      }
    }
  }

  // Expiry: same 3h soft-expiry rule as the public slug page, plus the
  // hard-expiry flag from the reaper. Everyone lands on /expired past the
  // window, no auth required. Campaign-generated previews (expiresAt set)
  // use that timestamp instead of the default createdAt+3h.
  if (!admin) {
    if (tenant.isExpired) redirect(`/expired/${id}`);
    if (!tenant.publishedAt) {
      if (tenant.expiresAt) {
        if (new Date(tenant.expiresAt).getTime() < Date.now()) {
          redirect(`/expired/${id}`);
        }
      } else {
        const ageMs = Date.now() - new Date(tenant.createdAt).getTime();
        if (ageMs > 3 * 3600_000) redirect(`/expired/${id}`);
      }
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

  return (
    <PreviewClient
      expiresAt={tenant.expiresAt ?? null}
      createdAt={tenant.createdAt}
      businessName={tenant.name}
    />
  );
}
