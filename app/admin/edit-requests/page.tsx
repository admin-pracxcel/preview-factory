/**
 * app/admin/edit-requests/page.tsx
 * Concierge queue — lists pending change requests so the founder can action them.
 *
 * Gated by ADMIN_EMAIL. If the caller isn't the admin, we 404. No hint that
 * the route exists — no login prompt, no "access denied" — the URL just
 * looks like it doesn't exist.
 */

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isAdminSession } from "@/lib/admin";
import type { MutableCookies } from "@/lib/session";
import { ApplyForm } from "./ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Concierge — change requests" };

interface PendingRow {
  id: string;
  tenant_id: string;
  request: string;
  created_at: string;
  tenants: { name: string | null; owner_email: string | null } | null;
}

export default async function AdminEditRequestsPage() {
  const cookieStore = (await cookies()) as unknown as MutableCookies;
  const admin = await isAdminSession(cookieStore);
  if (!admin) notFound();

  const { data, error } = await supabase()
    .from("edit_requests")
    .select("id, tenant_id, request, created_at, tenants(name, owner_email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return (
      <Shell title="Change requests">
        <p className="text-red-400">Failed to load queue: {error.message}</p>
      </Shell>
    );
  }

  const rows = (data ?? []) as unknown as PendingRow[];

  return (
    <Shell title="Change requests">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-white/50">
          {rows.length === 0
            ? "Nothing pending."
            : `${rows.length} request${rows.length === 1 ? "" : "s"} waiting.`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/50">
          Inbox zero.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {row.tenants?.name ?? row.tenant_id}
                  </h2>
                  <p className="mt-0.5 text-xs text-white/40">
                    {row.tenants?.owner_email ?? "(no owner email)"} · {" "}
                    {new Date(row.created_at).toLocaleString("en-AU")}
                  </p>
                </div>
                <Link
                  href={`/dashboard/${row.tenant_id}`}
                  className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:border-white/30 hover:text-white"
                >
                  Open dashboard
                </Link>
              </div>

              <blockquote className="mb-4 whitespace-pre-wrap rounded-xl border border-white/5 bg-black/30 p-4 text-sm text-white/85">
                {row.request}
              </blockquote>

              <ApplyForm
                requestId={row.id}
                tenantName={row.tenants?.name ?? row.tenant_id}
              />
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold">
            Launcharoo
          </span>
          <span className="text-xs uppercase tracking-widest text-white/40">
            Concierge
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-6 font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight">
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}
