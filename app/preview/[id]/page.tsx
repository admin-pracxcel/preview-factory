/**
 * app/preview/[id]/page.tsx
 *
 * Ownership gate for the preview editor. Anonymous sessions can only see
 * the tenants they created; a signed-in visitor who lands on someone
 * else's URL gets bounced to their own most-recent tenant, and someone
 * with no session at all gets sent to /login.
 *
 * The interactive editor is a client component (PreviewClient) — this
 * server component is just the guard around it.
 */

import { redirect } from "next/navigation";
import { cookies as nextCookies } from "next/headers";
import {
  readSession,
  assertOwnsTenant,
  findLatestTenantForSession,
  type MutableCookies,
} from "@/lib/session";
import { isAdminSession } from "@/lib/admin";
import PreviewClient from "./PreviewClient";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = (await nextCookies()) as unknown as MutableCookies;

  const sessionId = readSession(cookieStore);
  if (!sessionId) {
    redirect("/login");
  }

  // Admin sessions can open any tenant's preview editor for support / review.
  const admin = await isAdminSession(cookieStore);
  if (!admin) {
    try {
      await assertOwnsTenant(cookieStore, id);
    } catch {
      // Session exists but doesn't own this tenant. Bounce to the sites
      // list so they can pick what to edit, or to /login if they own nothing.
      const ownId = await findLatestTenantForSession(sessionId);
      redirect(ownId ? "/dashboard" : "/login");
    }
  }

  return <PreviewClient />;
}
