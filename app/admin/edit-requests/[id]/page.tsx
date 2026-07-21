/**
 * app/admin/edit-requests/[id]/page.tsx
 *
 * Full detail view for one edit request. Reached either from the queue
 * (session-auth) or the "Review this request" button in the concierge
 * email (?token=<signed>). Shows the original request + tenant context
 * and lets the admin approve (kicks off the n8n workflow) or reject
 * with a reason.
 *
 * Auth: 404 unless the caller either has an admin session OR presents a
 * valid signed token whose payload id matches this route param.
 */

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdminSession } from "@/lib/admin";
import { getEditRequest } from "@/lib/edit-requests-store";
import { getTenant } from "@/lib/tenant-store";
import { verifyApprovalToken } from "@/lib/edit-request-tokens";
import type { MutableCookies } from "@/lib/session";
import { ActionPanel, RetryPanel } from "./ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — review request" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SearchParams {
  token?: string;
}

export default async function EditRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!UUID_RE.test(id)) notFound();

  const cookieStore = (await cookies()) as unknown as MutableCookies;
  const authorised = await isAuthorised(cookieStore, id, token);
  if (!authorised) notFound();

  const editReq = await getEditRequest(id);
  if (!editReq) notFound();

  const tenant = await getTenant(editReq.tenantId);

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/admin/edit-requests"
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          ← Back to queue
        </Link>
        <StatusBadge status={editReq.status} />
      </div>

      <h1 className="mb-1 font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight">
        {tenant?.name ?? "Unknown tenant"}
      </h1>
      <p className="mb-6 text-sm text-white/40">
        {tenant?.ownerEmail ?? "(no owner email)"} &middot;{" "}
        Received {new Date(editReq.createdAt).toLocaleString("en-AU")}
        {tenant?.id && (
          <>
            {" "}
            &middot;{" "}
            <Link
              href={`/preview/${tenant.id}`}
              className="text-blue-300 hover:text-blue-200 transition-colors"
              target="_blank"
            >
              Open preview ↗
            </Link>
          </>
        )}
      </p>

      <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Original request
        </p>
        <blockquote className="whitespace-pre-wrap text-base text-white/90 leading-relaxed">
          {editReq.request}
        </blockquote>
      </section>

      {editReq.status === "pending" ? (
        <ActionPanel editRequestId={id} token={token ?? null} />
      ) : (
        <>
          <ResolvedSummary
            status={editReq.status}
            adminNote={editReq.adminNote}
            rejectReason={editReq.rejectReason}
            approvedBy={editReq.approvedBy}
            approvedAt={editReq.approvedAt}
            rejectedAt={editReq.rejectedAt}
            appliedAt={editReq.appliedAt}
            error={editReq.error}
            changeSummary={editReq.changeSummary}
          />
          {editReq.status === "failed" && <RetryPanel editRequestId={id} />}
        </>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ shell */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <img
            src="/images/launcharoo-logo-white.webp"
            alt="Launcharoo"
            className="h-6 w-auto"
          />
          <span className="text-xs uppercase tracking-widest text-white/40">
            Admin
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}

/* --------------------------------------------------------- status pill */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "Pending review",
      cls: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    },
    approved: {
      label: "Approved · workflow running",
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
  };
  const { label, cls } = map[status] ?? {
    label: status,
    cls: "bg-white/5 text-white/50 border-white/10",
  };
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

/* --------------------------------------------------- resolved summary */

interface ResolvedSummaryProps {
  status: string;
  adminNote?: string;
  rejectReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedAt?: string;
  appliedAt?: string;
  error?: string;
  changeSummary?: string;
}

function ResolvedSummary(p: ResolvedSummaryProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
        Outcome
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        {p.approvedAt && (
          <>
            <dt className="text-white/40">Approved</dt>
            <dd>
              {new Date(p.approvedAt).toLocaleString("en-AU")}{" "}
              {p.approvedBy && (
                <span className="text-white/40">by {p.approvedBy}</span>
              )}
            </dd>
          </>
        )}
        {p.rejectedAt && (
          <>
            <dt className="text-white/40">Rejected</dt>
            <dd>
              {new Date(p.rejectedAt).toLocaleString("en-AU")}{" "}
              {p.approvedBy && (
                <span className="text-white/40">by {p.approvedBy}</span>
              )}
            </dd>
          </>
        )}
        {p.appliedAt && (
          <>
            <dt className="text-white/40">Applied</dt>
            <dd>{new Date(p.appliedAt).toLocaleString("en-AU")}</dd>
          </>
        )}
        {p.adminNote && (
          <>
            <dt className="text-white/40">Admin note</dt>
            <dd className="whitespace-pre-wrap">{p.adminNote}</dd>
          </>
        )}
        {p.rejectReason && (
          <>
            <dt className="text-white/40">Reason</dt>
            <dd className="whitespace-pre-wrap">{p.rejectReason}</dd>
          </>
        )}
        {p.changeSummary && (
          <>
            <dt className="text-white/40">Summary</dt>
            <dd className="whitespace-pre-wrap">{p.changeSummary}</dd>
          </>
        )}
        {p.error && (
          <>
            <dt className="text-white/40">Error</dt>
            <dd className="whitespace-pre-wrap text-red-300">{p.error}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

/* -------------------------------------------------------------- auth */

async function isAuthorised(
  cookieStore: MutableCookies,
  id: string,
  token: string | undefined,
): Promise<boolean> {
  if (await isAdminSession(cookieStore)) return true;
  if (typeof token !== "string" || !token.trim()) return false;
  try {
    const verified = verifyApprovalToken(token.trim());
    return verified.editRequestId === id;
  } catch {
    return false;
  }
}
