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
  LayoutDashboard,
  PenLine,
  ReceiptText,
} from "lucide-react";
import { getTenant } from "@/lib/tenant-store";
import { listLeads } from "@/lib/leads-store";
import { listEditRequests } from "@/lib/edit-requests-store";
import { CopyButton, BillingButton, EditRequestForm, CustomDomainCard, EditSiteCard, YourDataCard, ContactDetailsCard, LeadsList } from "./ui";

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

  // Pull the current contact details out of the tenant's SiteProps for the
  // inline edit card. Templates prefer home.contact over business.*, so we
  // hydrate the form the same way to avoid a "displayed vs. edited" mismatch.
  const initialContact = {
    phone:
      tenant.siteProps?.home?.contact?.phone ??
      tenant.siteProps?.business?.phone ??
      "",
    email:
      tenant.siteProps?.home?.contact?.email ??
      tenant.siteProps?.business?.email ??
      "",
    address: tenant.siteProps?.home?.contact?.address ?? "",
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      {/* ── top nav ── */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-blue-400" />
            <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold">
              Launcharoo
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
            Your Launcharoo dashboard
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

        {/* ── contact details card ── */}
        <ContactDetailsCard tenantId={tenantId} initial={initialContact} />

        {/* ── edit your site card ── */}
        <EditSiteCard tenantId={tenantId} />

        {/* ── custom domain card ── */}
        <CustomDomainCard
          tenantId={tenantId}
          initialState={{
            domain: tenant.customDomain,
            status: (tenant.customDomainStatus as
              | "choosing"
              | "pending_ns"
              | "pending_ssl"
              | "active"
              | "failed"
              | undefined) ?? null,
            nameservers: tenant.assignedNameservers ?? [],
            verifiedAt: tenant.customDomainVerifiedAt ?? null,
          }}
        />

        {/* ── your data card ── */}
        <YourDataCard tenantId={tenantId} />

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

            <LeadsList leads={leads} />
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
            <section
              id="edit-request-form"
              className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4 scroll-mt-24"
            >
              <div className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-bold">Request a change</h2>
              </div>
              <p className="text-sm text-white/50">
                Describe what you&apos;d like changed — phone number, email, address, hours, anything else. We&apos;ll email you when it&apos;s done, usually within 2 business hours.
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
            Back to Launcharoo
          </Link>
          <span className="mx-3">·</span>
          <a href="mailto:hello@launcharoo.online" className="hover:text-white/40 transition-colors">
            Support: hello@launcharoo.online
          </a>
        </footer>
      </main>
    </div>
  );
}
