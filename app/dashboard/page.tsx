/**
 * app/dashboard/page.tsx
 *
 * "Your sites" — the multi-site landing page for a signed-in owner.
 * Lists every tenant this session owns (magic-link verify rewires
 * session_id across email-owned tenants, so cross-device is covered)
 * and gives a way in to each dashboard plus a "create another" affordance.
 *
 * Signed-out visitors bounce to /login. Signed-in visitors with no
 * tenants also bounce — logging in but owning nothing is only reachable
 * via an odd race (deleted tenants), and /login is the least-surprising
 * landing point.
 */

import { redirect } from "next/navigation";
import { cookies as nextCookies } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Globe, ArrowRight } from "lucide-react";
import { readSession, type MutableCookies } from "@/lib/session";
import {
  listTenantsForSession,
  type TenantSummary,
} from "@/lib/tenant-store";
import { LogoutButton } from "@/app/components/LogoutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your sites — Launcharoo",
};

/* ---------------------------------------------------------------- helpers */

function StatusBadge({ status }: { status: TenantSummary["status"] }) {
  const map: Record<TenantSummary["status"], { label: string; cls: string }> = {
    published: {
      label: "Live",
      cls: "bg-green-500/15 text-green-400 border border-green-500/30",
    },
    paid: {
      label: "Activating",
      cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    },
    preview: {
      label: "Preview",
      cls: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    },
  };
  const { label, cls } = map[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {label}
    </span>
  );
}

function publicHostFor(t: TenantSummary): string | null {
  if (t.customDomain && t.customDomainStatus === "active") return t.customDomain;
  if (t.slug) return `${t.slug}.launcharoo.online`;
  return null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ page */

export default async function DashboardListPage() {
  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  const sessionId = readSession(cookieStore);
  if (!sessionId) {
    redirect("/login");
  }

  const tenants = await listTenantsForSession(sessionId);

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      {/* Top nav */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" aria-label="Launcharoo">
            <img
              src="/images/launcharoo-logo-white.webp"
              alt="Launcharoo"
              className="h-6 w-auto"
            />
          </Link>
          <LogoutButton variant="text" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 flex flex-col gap-8">
        {/* Heading */}
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight sm:text-4xl">
            Your sites
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {tenants.length === 0
              ? "You haven't created any sites yet."
              : `${tenants.length} ${tenants.length === 1 ? "site" : "sites"} on this account.`}
          </p>
        </div>

        {/* Sites grid */}
        {tenants.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {tenants.map((t) => {
              const publicHost = publicHostFor(t);
              return (
                <Link
                  key={t.id}
                  href={`/dashboard/${t.id}`}
                  className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-white/25 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">
                        {t.name}
                      </h2>
                      {publicHost && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-mono text-white/50 truncate">
                          <Globe className="h-3 w-3 shrink-0" />
                          <span className="truncate">{publicHost}</span>
                        </p>
                      )}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>Updated {formatDate(t.updatedAt)}</span>
                    <span className="flex items-center gap-1 font-semibold text-blue-300 opacity-0 transition-opacity group-hover:opacity-100">
                      Manage
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-sm text-white/60">
              Create your first site to get started.
            </p>
          </div>
        )}

        {/* Create another */}
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] px-5 py-3 text-sm font-semibold text-white/70 hover:border-white/30 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create another site
          </Link>
        </div>

        {/* Footer */}
        <footer className="border-t border-white/5 pt-6 text-center text-xs text-white/20">
          <Link href="/" className="hover:text-white/40 transition-colors">
            Back to Launcharoo
          </Link>
          <span className="mx-3">&middot;</span>
          <a
            href="mailto:hello@launcharoo.online"
            className="hover:text-white/40 transition-colors"
          >
            Support: hello@launcharoo.online
          </a>
        </footer>
      </main>
    </div>
  );
}
