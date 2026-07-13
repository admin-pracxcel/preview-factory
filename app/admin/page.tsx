/**
 * app/admin/page.tsx
 * Concierge home — the dashboard the founder lands on when they log in
 * with ADMIN_EMAIL. Regular owners still see /dashboard (their sites);
 * this route is the admin-only equivalent.
 *
 * Access control: gated by isAdminSession → 404 for anyone else, no hint
 * the route exists.
 *
 * Content:
 *   - Change-request pipeline counts (pending / in progress / resolved)
 *   - Direct link into /admin/edit-requests
 *   - Recent tenants list (all sites on the platform, newest first)
 *   - Link back to the admin's own sites at /dashboard
 */

import { cookies as nextCookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Inbox,
  Users,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isAdminSession } from "@/lib/admin";
import type { MutableCookies } from "@/lib/session";
import { LogoutButton } from "@/app/components/LogoutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Concierge — Launcharoo",
};

interface PipelineCounts {
  pending: number;
  inProgress: number;
  resolved: number;
}

interface RecentTenant {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  owner_email: string | null;
  created_at: string;
}

async function loadPipeline(): Promise<PipelineCounts> {
  const { data, error } = await supabase()
    .from("edit_requests")
    .select("status")
    .limit(1000);
  if (error) {
    console.error("[admin:home] pipeline load failed:", error);
    return { pending: 0, inProgress: 0, resolved: 0 };
  }
  let pending = 0;
  let inProgress = 0;
  let resolved = 0;
  for (const row of data ?? []) {
    const s = row.status as string;
    if (s === "pending") pending += 1;
    else if (s === "approved" || s === "processing") inProgress += 1;
    else resolved += 1;
  }
  return { pending, inProgress, resolved };
}

async function loadRecentTenants(limit = 10): Promise<RecentTenant[]> {
  const { data, error } = await supabase()
    .from("tenants")
    .select("id, name, slug, status, owner_email, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[admin:home] tenants load failed:", error);
    return [];
  }
  return (data ?? []) as unknown as RecentTenant[];
}

async function loadTenantCount(): Promise<number> {
  const { count, error } = await supabase()
    .from("tenants")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error("[admin:home] tenant count failed:", error);
    return 0;
  }
  return count ?? 0;
}

export default async function AdminHomePage() {
  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  const admin = await isAdminSession(cookieStore);
  if (!admin) notFound();

  const [pipeline, tenants, totalTenants] = await Promise.all([
    loadPipeline(),
    loadRecentTenants(),
    loadTenantCount(),
  ]);

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-blue-400" />
            <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold">
              Launcharoo
            </span>
            <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              Concierge
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              My sites
            </Link>
            <LogoutButton variant="text" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 flex flex-col gap-10">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight sm:text-4xl">
            Concierge dashboard
          </h1>
          <p className="mt-1 text-sm text-white/40">
            Everything on the platform, from one place.
          </p>
        </div>

        {/* Pipeline overview */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-blue-400" />
              <h2 className="text-base font-bold">Change requests</h2>
            </div>
            <Link
              href="/admin/edit-requests"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:border-blue-400/60 hover:bg-blue-500/20 hover:text-blue-100 transition-colors"
            >
              Open queue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Pending"
              value={pipeline.pending}
              cls="border-blue-500/30 bg-blue-500/10 text-blue-200"
              hint="Waiting on you"
            />
            <Stat
              label="In progress"
              value={pipeline.inProgress}
              cls="border-amber-500/30 bg-amber-500/10 text-amber-200"
              hint="Approved, running"
            />
            <Stat
              label="Resolved"
              value={pipeline.resolved}
              cls="border-white/10 bg-white/5 text-white/60"
              hint="Applied / rejected / failed"
            />
          </div>
        </section>

        {/* Tenants */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-400" />
              <h2 className="text-base font-bold">Recent tenants</h2>
              <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-bold text-green-400">
                {totalTenants} total
              </span>
            </div>
          </div>

          {tenants.length === 0 ? (
            <p className="text-sm text-white/40">No tenants yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tenants.map((t) => {
                const publicHost = t.slug ? `${t.slug}.launcharoo.online` : null;
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {t.name || "(untitled)"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-white/40">
                        {t.owner_email ?? "(no owner)"}
                        {publicHost && <> &middot; {publicHost}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                        {t.status}
                      </span>
                      <Link
                        href={`/dashboard/${t.id}`}
                        className="text-xs font-semibold text-blue-300 hover:text-blue-200"
                      >
                        Open →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  cls,
  hint,
}: {
  label: string;
  value: number;
  cls: string;
  hint: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs opacity-60">{hint}</p>
    </div>
  );
}
