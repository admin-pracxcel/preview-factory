/**
 * app/components/MarketingHeader.tsx
 *
 * Sticky glass nav shown at the top of every marketing-host page (home,
 * niche landing pages, 404, legal). Async server component — reads the
 * session cookie so the auth link toggles between "Sign in", "Dashboard"
 * and "Admin Panel" without a client-side flash.
 *
 * The "How it works" and "Get started" links are absolute paths (`/…`),
 * so clicking from any page (including 404) lands on the home and scrolls
 * to the anchor.
 */

import Link from "next/link";
import { cookies as nextCookies } from "next/headers";
import {
  readSession,
  findLatestTenantForSession,
  type MutableCookies,
} from "@/lib/session";
import { isAdminSession } from "@/lib/admin";

export default async function MarketingHeader() {
  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  const sessionId = readSession(cookieStore);
  const [hasOwnedTenant, isAdmin] = await Promise.all([
    sessionId
      ? findLatestTenantForSession(sessionId).then((t) => t !== null)
      : Promise.resolve(false),
    isAdminSession(cookieStore),
  ]);

  return (
    <header className="sticky top-0 z-30 bg-black/95 border-b border-white/5 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <Link href="/" aria-label="Launcharoo">
          <img
            src="/images/launcharoo-logo-white.webp"
            alt="Launcharoo"
            className="h-6 w-auto"
          />
        </Link>
        <div className="flex items-center gap-6">
          <a
            href="/#how-it-works"
            className="hidden sm:block text-sm text-white/70 hover:text-white transition-colors"
          >
            How it works
          </a>
          {isAdmin ? (
            <Link
              href="/admin"
              className="hidden sm:block text-sm text-white/70 hover:text-white transition-colors"
            >
              Admin Panel
            </Link>
          ) : hasOwnedTenant ? (
            <Link
              href="/dashboard"
              className="hidden sm:block text-sm text-white/70 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <a
              href="/login"
              className="hidden sm:block text-sm text-white/70 hover:text-white transition-colors"
            >
              Sign in
            </a>
          )}
          <a
            href="/#industries"
            className="px-5 py-2 rounded-full bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors"
          >
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}
