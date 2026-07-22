/**
 * app/recover/[id]/page.tsx
 *
 * "Recover my site now" handoff. Called from /expired/[id] when the
 * customer wants to bring an expired preview back so they can claim it.
 *
 * Behaviour:
 *   - Site data still intact (within 24h)  → un-expire, redirect to
 *                                            /preview/[id] where they can
 *                                            view + click Claim/Buy
 *   - Site data blanked (past 24h)          → redirect home with a
 *                                            regen intent flag (front page
 *                                            can pre-fill an intake form)
 *   - Tenant already claimed                → redirect to /dashboard/[id]
 *   - Tenant not found                      → 404
 *
 * Rendered as a server component so a plain <a href> link from the
 * /expired page does the recovery and lands the customer in the right
 * place without any client JS.
 */

import { notFound, redirect } from "next/navigation";
import { recoverTenant, getTenant } from "@/lib/tenant-store";

export const dynamic = "force-dynamic";

export default async function RecoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const result = await recoverTenant(id);

  if (result.ok) {
    redirect(`/preview/${id}`);
  }

  if (result.reason === "already_claimed") {
    redirect(`/dashboard/${id}`);
  }

  if (result.reason === "not_found") {
    // No such tenant at all — send them home so they can start fresh.
    // Not a 404 because the customer came here from a link they clicked;
    // dumping them on a bare 404 page is worse UX than the marketing page.
    redirect("/");
  }

  // result.reason === "no_site_props" — the reaper blanked the row past
  // 24h. Nothing to un-expire; offer regeneration. If we have the tenant's
  // Google place_id we could preseed intake; for now hand back to home.
  const tenant = await getTenant(id);
  if (!tenant) notFound();
  const placeId = tenant.placeId ?? "";
  const target = placeId
    ? `/?regen_place_id=${encodeURIComponent(placeId)}`
    : "/?recover_expired=1";
  redirect(target);
}
