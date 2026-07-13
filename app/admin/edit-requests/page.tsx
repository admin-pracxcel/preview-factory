/**
 * app/admin/edit-requests/page.tsx
 * Concierge queue — every edit request (pending, approved, applied, rejected,
 * failed) grouped so the founder can see the whole pipeline at a glance.
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
import { LogoutButton } from "@/app/components/LogoutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Concierge — change requests" };

type Status =
  | "pending"
  | "approved"
  | "processing"
  | "applied"
  | "rejected"
  | "failed"
  | "preview"
  | "error";

interface Row {
  id: string;
  tenant_id: string;
  request: string;
  status: Status;
  created_at: string;
  resolved_at: string | null;
  admin_note: string | null;
  reject_reason: string | null;
  error: string | null;
  tenants: { name: string | null; owner_email: string | null } | null;
}

/* ---- rendering groups ---- */

const GROUPS: Array<{ title: string; statuses: Status[]; hint: string }> = [
  {
    title: "Pending",
    statuses: ["pending"],
    hint: "Waiting for you to approve or reject.",
  },
  {
    title: "In progress",
    statuses: ["approved", "processing"],
    hint: "Approved and running through the workflow.",
  },
  {
    title: "Resolved",
    statuses: ["applied", "rejected", "failed", "preview", "error"],
    hint: "Completed, rejected, or failed.",
  },
];

/* ---- page ---- */

export default async function AdminEditRequestsPage() {
  const cookieStore = (await cookies()) as unknown as MutableCookies;
  const admin = await isAdminSession(cookieStore);
  if (!admin) notFound();

  const { data, error } = await supabase()
    .from("edit_requests")
    .select(
      "id, tenant_id, request, status, created_at, resolved_at, admin_note, reject_reason, error, tenants(name, owner_email)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <Shell>
        <p className="text-red-400">Failed to load queue: {error.message}</p>
      </Shell>
    );
  }

  const rows = (data ?? []) as unknown as Row[];
  const grouped: Record<string, Row[]> = {};
  for (const g of GROUPS) grouped[g.title] = [];
  for (const row of rows) {
    for (const g of GROUPS) {
      if (g.statuses.includes(row.status)) {
        grouped[g.title].push(row);
        break;
      }
    }
  }

  return (
    <Shell>
      <div className="mb-8 flex items-center justify-between gap-4">
        <p className="text-sm text-white/50">
          {rows.length === 0
            ? "Nothing here yet."
            : `Showing the most recent ${rows.length} request${rows.length === 1 ? "" : "s"}.`}
        </p>
        <div className="flex items-center gap-2 text-xs text-white/40">
          {GROUPS.map((g) => (
            <span
              key={g.title}
              className="rounded-full border border-white/10 px-2 py-0.5"
            >
              {g.title}: {grouped[g.title].length}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-10">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">{g.title}</h2>
                <p className="text-xs text-white/40">{g.hint}</p>
              </div>
              <span className="text-xs text-white/40">
                {grouped[g.title].length}
              </span>
            </div>
            {grouped[g.title].length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-white/30">
                No {g.title.toLowerCase()} requests.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {grouped[g.title].map((row) => (
                  <RequestRow key={row.id} row={row} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Shell>
  );
}

/* ---- row + badge ---- */

function RequestRow({ row }: { row: Row }) {
  const trailing =
    row.status === "rejected"
      ? row.reject_reason
      : row.status === "failed"
      ? row.error
      : row.admin_note;

  return (
    <li className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-white">
            {row.tenants?.name ?? row.tenant_id}
          </h3>
          <p className="mt-0.5 text-xs text-white/40">
            {row.tenants?.owner_email ?? "(no owner email)"} &middot;{" "}
            {new Date(row.created_at).toLocaleString("en-AU")}
            {row.resolved_at && (
              <>
                {" "}
                &middot; resolved{" "}
                {new Date(row.resolved_at).toLocaleString("en-AU")}
              </>
            )}
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>

      <blockquote className="mb-3 whitespace-pre-wrap rounded-xl border border-white/5 bg-black/30 p-4 text-sm text-white/85">
        {row.request}
      </blockquote>

      {trailing && (
        <p className="mb-3 whitespace-pre-wrap rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs text-white/60">
          <span className="font-semibold text-white/50">
            {row.status === "rejected"
              ? "Reject reason: "
              : row.status === "failed"
              ? "Error: "
              : "Admin note: "}
          </span>
          {trailing}
        </p>
      )}

      <Link
        href={`/admin/edit-requests/${row.id}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/30 hover:bg-white/5 hover:text-white transition-colors"
      >
        Open &rarr;
      </Link>
    </li>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    pending: {
      label: "Pending",
      cls: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    },
    approved: {
      label: "Approved",
      cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    },
    processing: {
      label: "Processing",
      cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    },
    applied: {
      label: "Applied",
      cls: "bg-green-500/15 text-green-300 border-green-500/30",
    },
    rejected: {
      label: "Rejected",
      cls: "bg-white/5 text-white/50 border-white/10",
    },
    failed: {
      label: "Failed",
      cls: "bg-red-500/15 text-red-300 border-red-500/30",
    },
    preview: {
      label: "Preview",
      cls: "bg-white/5 text-white/40 border-white/10",
    },
    error: {
      label: "Error",
      cls: "bg-red-500/10 text-red-400 border-red-500/20",
    },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${cls}`}
    >
      {label}
    </span>
  );
}

/* ---- shell ---- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="font-[family-name:var(--font-sora)] text-lg font-extrabold hover:text-white/80 transition-colors"
            >
              Launcharoo
            </Link>
            <span className="text-xs uppercase tracking-widest text-white/40">
              Concierge
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Dashboard
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-6 font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight">
          Change requests
        </h1>
        {children}
      </main>
    </div>
  );
}
