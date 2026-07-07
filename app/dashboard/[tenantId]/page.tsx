/**
 * app/dashboard/[tenantId]/page.tsx
 * Client dashboard — post-payment management view.
 *
 * Accessible at /dashboard/<tenantId> after checkout completes.
 * Shows: site status, live URL, captured leads, billing portal link, edit request form.
 *
 * This is a server component — data is loaded at render time from the file store.
 * Interactive elements (copy button, billing portal, edit form) are in ui.tsx (client).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Globe,
  TrendingUp,
  Phone,
  Mail,
  LayoutDashboard,
  PenLine,
  ReceiptText,
} from "lucide-react";
import { getTenant } from "@/lib/tenant-store";
import { listLeads } from "@/lib/leads-store";
import { listEditRequests } from "@/lib/edit-requests-store";
import { CopyButton, BillingButton, EditRequestForm } from "./ui";

/* ------------------------------------------------------------------ meta */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  return {
    title: tenant ? `Dashboard — ${tenant.name}` : "Dashboard",
  };
}

/* ---------------------------------------------------------------- helpers */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
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
  const { label, cls } = map[status] ?? {
    label: status,
    cls: "bg-white/10 text-white/60 border border-white/10",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{label}</span>
  );
}

function sourceLabel(source: string) {
  return source === "call-click" ? "Phone tap" : source === "email-click" ? "Email click" : "Enquiry form";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ page */

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();

  const leads = (await listLeads(tenantId)).slice(0, 20);
  const editRequests = (await listEditRequests(tenantId)).slice(0, 5);

  const liveUrl = tenant.slug
    ? `https://${tenant.slug}.launcharoo.online`
    : `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/preview/site/${tenantId}`;

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      {/* ── top nav ── */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-blue-400" />
            <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold">
              Preview Factory
            </span>
          </div>
          <StatusBadge status={tenant.status} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 flex flex-col gap-8">

        {/* ── page heading ── */}
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight sm:text-4xl">
            {tenant.name}
          </h1>
          <p className="mt-1 text-white/40 text-sm">
            Your Preview Factory dashboard
          </p>
        </div>

        {/* ── site card ── */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-bold">Your site</h2>
          </div>

          {/* URL row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5">
              <span className="font-mono text-sm text-blue-400 break-all">{liveUrl}</span>
            </div>
            <div className="flex gap-2">
              <CopyButton text={liveUrl} label="Copy URL" />
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-600/40"
              >
                View site
              </a>
            </div>
          </div>

          {/* Status row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Status", value: tenant.status === "published" ? "Live" : "Preview" },
              { label: "Niche", value: tenant.niche },
              { label: "Category", value: tenant.category },
              { label: "Created", value: new Date(tenant.createdAt).toLocaleDateString("en-AU") },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-black/20 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
                <p className="mt-1 text-sm font-semibold text-white capitalize">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">

          {/* ── leads table ── */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <h2 className="text-base font-bold">Enquiries</h2>
              </div>
              <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-bold text-green-400">
                {leads.length}
              </span>
            </div>

            {leads.length === 0 ? (
              <p className="text-sm text-white/40 py-4 text-center">
                No enquiries yet. They&apos;ll appear here as soon as someone contacts you.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      {["Name", "Contact", "Type", "Date"].map((h) => (
                        <th
                          key={h}
                          className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td className="py-2.5 pr-3 font-medium text-white/80">
                          {lead.name ?? "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-white/60">
                          <div className="flex flex-col gap-0.5">
                            {lead.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0 text-white/30" />
                                {lead.phone}
                              </span>
                            )}
                            {lead.email && (
                              <span className="flex items-center gap-1 truncate max-w-[140px]">
                                <Mail className="h-3 w-3 shrink-0 text-white/30" />
                                {lead.email}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/50">
                            {sourceLabel(lead.source)}
                          </span>
                        </td>
                        <td className="py-2.5 text-[11px] text-white/40 whitespace-nowrap">
                          {formatDate(lead.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── right column: billing + edit request ── */}
          <div className="flex flex-col gap-6">

            {/* Billing card */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-purple-400" />
                <h2 className="text-base font-bold">Billing</h2>
              </div>
              <p className="text-sm text-white/50">
                Update your payment method, view invoices, or cancel your subscription.
              </p>
              <BillingButton tenantId={tenantId} />
            </section>

            {/* Edit request card */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-bold">Request a change</h2>
              </div>
              <p className="text-sm text-white/50">
                Describe what you&apos;d like changed in plain English. We&apos;ll send you a preview to approve before anything goes live.
              </p>

              {/* Recent requests */}
              {editRequests.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Recent requests
                  </p>
                  {editRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-xs"
                    >
                      <span className="text-white/60 truncate flex-1">{r.request}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.status === "applied"
                            ? "bg-green-500/15 text-green-400"
                            : r.status === "rejected"
                            ? "bg-red-500/15 text-red-400"
                            : r.status === "preview"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-white/10 text-white/40"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <EditRequestForm tenantId={tenantId} />
            </section>

          </div>
        </div>

        {/* ── footer ── */}
        <footer className="border-t border-white/5 pt-6 text-center text-xs text-white/20">
          <Link href="/" className="hover:text-white/40 transition-colors">
            Back to Preview Factory
          </Link>
          <span className="mx-3">·</span>
          <a href="tel:1800000000" className="hover:text-white/40 transition-colors">
            Support: 1800 XXX XXX
          </a>
        </footer>
      </main>
    </div>
  );
}
