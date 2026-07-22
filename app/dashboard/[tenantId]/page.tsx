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

import { notFound, redirect } from "next/navigation";
import { cookies as nextCookies } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Globe,
  TrendingUp,
  PenLine,
  ReceiptText,
  ChevronLeft,
  Download,
} from "lucide-react";
import { getTenant } from "@/lib/tenant-store";
import { listLeads } from "@/lib/leads-store";
import { listEditRequests, countEditRequestsThisMonth } from "@/lib/edit-requests-store";
import { splitPlanKey, tierOf } from "@/lib/plans";
import {
  readSession,
  assertOwnsTenant,
  findLatestTenantForSession,
  type MutableCookies,
} from "@/lib/session";
import { CopyButton, BillingButton, EditRequestForm, CustomDomainCard, EditSiteCard, LeadsList } from "./ui";
import { AutoOpenAddonFunnel, GrowthServicesCard } from "./AddonFunnel";
import { LogoutButton } from "@/app/components/LogoutButton";
import { isAdminSession } from "@/lib/admin";
import { listActiveAddonsForTenant } from "@/lib/addon-store";

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

  // Ownership gate: only the session that created (or has been re-linked
  // to via magic-link) this tenant may see the dashboard. A signed-in
  // visitor on the wrong URL is redirected to their own tenant; no
  // session at all → /login.
  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  const sessionId = readSession(cookieStore);
  if (!sessionId) {
    redirect("/login");
  }
  // Admin sessions can open any tenant's dashboard for support / review.
  const admin = await isAdminSession(cookieStore);
  if (!admin) {
    try {
      await assertOwnsTenant(cookieStore, tenantId);
    } catch {
      // Wrong tenant → send to the sites list so they can pick which one to
      // manage. Signed-in visitors who own nothing bounce to /login.
      const ownId = await findLatestTenantForSession(sessionId);
      redirect(ownId ? "/dashboard" : "/login");
    }
  }

  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();

  const leads = (await listLeads(tenantId)).slice(0, 20);
  const editRequests = (await listEditRequests(tenantId)).slice(0, 5);
  const editsUsedThisMonth = await countEditRequestsThisMonth(tenantId);
  const activeAddons = await listActiveAddonsForTenant(tenantId);
  const activeAddonKeys = activeAddons.map((a) => a.addonKey);

  // Derive a small quota card for the "Request a change" section. Mirrors
  // the plan-aware logic in ChangeRequestsPanel; kept inline because this
  // is a server component and the visual is small.
  const quota = deriveQuotaForDashboard(tenant.planKey, editsUsedThisMonth);

  const liveUrl = tenant.slug
    ? `https://${tenant.slug}.launcharoo.online`
    : `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/preview/site/${tenantId}`;

  // Trigger the addon walkthrough exactly once, on the first dashboard load
  // after the custom domain is verified. Admins never see it — they'd trip
  // it repeatedly across tenants they don't own.
  const shouldShowAddonFunnel =
    !admin &&
    tenant.status === "published" &&
    !!tenant.customDomainVerifiedAt &&
    !tenant.funnelShownAt;

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      {shouldShowAddonFunnel && <AutoOpenAddonFunnel tenantId={tenantId} />}

      {/* ── top nav ── */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" aria-label="Launcharoo">
            <img
              src="/images/launcharoo-logo-white.webp"
              alt="Launcharoo"
              className="h-6 w-auto"
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              All sites
            </Link>
            <StatusBadge status={tenant.status} />
            <LogoutButton />
          </div>
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

        {/* ── grow your business (addons upsell — always visible) ── */}
        {tenant.status === "published" && (
          <GrowthServicesCard
            tenantId={tenantId}
            activeAddonKeys={activeAddonKeys}
          />
        )}

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

        {/* ── billing card (full width) ── */}
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

        <div className="grid gap-8 lg:grid-cols-2">

          {/* ── leads table ── */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <h2 className="text-base font-bold">Enquiries</h2>
                <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-bold text-green-400">
                  {leads.length}
                </span>
              </div>
              {leads.length > 0 && (
                <a
                  href={`/api/dashboard/${tenantId}/export/leads.csv`}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/70 hover:border-white/25 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </a>
              )}
            </div>

            <LeadsList leads={leads} />
          </section>

          {/* ── edit request card ── */}
          <section
            id="edit-request-form"
            className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-4 scroll-mt-24"
          >
            <div className="flex items-center gap-2">
              <PenLine className="h-5 w-5 text-amber-400" />
              <h2 className="text-base font-bold">Request a change</h2>
            </div>

            {/* Plan-aware quota — prominent so the owner knows their monthly
                headroom at a glance without opening the preview modal. */}
            <QuotaCard quota={quota} />

            <p className="text-sm text-white/50">
              Describe the change in plain English — copy tweaks, new sections, gallery updates, or anything else on the site. We&apos;ll email you when it&apos;s done. Basic details like phone, hours and address can be edited directly on your preview page.
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

/* -------------------------------------------------------------------------- */
/*  Quota card — shows plan-aware "N of 20 requests left this month"           */
/* -------------------------------------------------------------------------- */

interface DashboardQuota {
  kind: "starter" | "growth" | "pro" | "legacy" | "no-plan";
  used: number;
  cap?: number;
  remaining?: number;
  percentUsed?: number;
  exhausted?: boolean;
  headline: string;
  sub: string;
  tint: "emerald" | "amber" | "slate";
}

function deriveQuotaForDashboard(planKey: string | undefined, used: number): DashboardQuota {
  const parts = splitPlanKey(planKey);
  if (!parts) {
    return planKey
      ? {
          kind: "legacy",
          used,
          headline: "Unlimited requests",
          sub: "Your plan doesn't cap monthly requests. Fair use applies.",
          tint: "emerald",
        }
      : {
          kind: "no-plan",
          used,
          headline: "No active subscription",
          sub: "Requests are unlocked once you subscribe.",
          tint: "slate",
        };
  }
  const tier = tierOf(parts.tier);
  if (parts.tier === "starter") {
    return {
      kind: "starter",
      used,
      headline: "Not included on Starter",
      sub: "Upgrade to Growth (20/mo) or Pro (unlimited) to submit change requests.",
      tint: "amber",
    };
  }
  if (parts.tier === "growth") {
    const cap = tier.editsCap;
    const remaining = Math.max(0, cap - used);
    const percentUsed = Math.min(100, Math.round((used / cap) * 100));
    const exhausted = remaining === 0;
    return {
      kind: "growth",
      used,
      cap,
      remaining,
      percentUsed,
      exhausted,
      headline: exhausted
        ? "You've used all 20 requests this month"
        : `${remaining} of ${cap} requests left this month`,
      sub: exhausted
        ? "Quota resets on the 1st. Need more? Upgrade to Pro for unlimited requests under fair use."
        : `Growth includes 20 change requests per calendar month. Resets on the 1st.`,
      tint: exhausted ? "amber" : "emerald",
    };
  }
  // pro
  const softCap = tier.fairUseSoftCap ?? Infinity;
  const hardCap = tier.fairUseHardCap ?? Infinity;
  if (used >= hardCap) {
    return {
      kind: "pro",
      used,
      headline: "Fair-use ceiling reached",
      sub: "You've hit the monthly fair-use ceiling. Reach out to hello@launcharoo.online for headroom.",
      tint: "amber",
    };
  }
  if (used >= softCap) {
    return {
      kind: "pro",
      used,
      headline: `${used} requests this month`,
      sub: "Above the fair-use soft cap. We may follow up on very heavy usage.",
      tint: "amber",
    };
  }
  return {
    kind: "pro",
    used,
    headline: "Unlimited requests",
    sub: "Pro includes unlimited change requests within fair use. Resets on the 1st.",
    tint: "emerald",
  };
}

function QuotaCard({ quota }: { quota: DashboardQuota }) {
  const chip =
    quota.tint === "emerald"
      ? {
          border: "border-emerald-500/30",
          bg: "bg-emerald-500/10",
          text: "text-emerald-300",
          barBg: "bg-emerald-500/15",
          bar: "bg-emerald-400",
        }
      : quota.tint === "amber"
      ? {
          border: "border-amber-500/30",
          bg: "bg-amber-500/10",
          text: "text-amber-300",
          barBg: "bg-amber-500/15",
          bar: "bg-amber-400",
        }
      : {
          border: "border-white/10",
          bg: "bg-white/5",
          text: "text-white/70",
          barBg: "bg-white/10",
          bar: "bg-white/40",
        };

  return (
    <div className={`rounded-xl border ${chip.border} ${chip.bg} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-base font-bold ${chip.text}`}>{quota.headline}</p>
          <p className="mt-1 text-xs text-white/60">{quota.sub}</p>
        </div>
        {quota.kind === "growth" && (
          <div className="shrink-0 text-right">
            <div className={`text-2xl font-extrabold ${chip.text}`}>
              {quota.remaining}
              <span className="text-sm text-white/40 font-medium">
                {" "}
                / {quota.cap}
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              left
            </div>
          </div>
        )}
      </div>
      {quota.kind === "growth" && quota.percentUsed != null && (
        <div className={`h-1.5 rounded-full overflow-hidden ${chip.barBg}`}>
          <div
            className={`h-full ${chip.bar} transition-all duration-500 ease-out`}
            style={{ width: `${quota.percentUsed}%` }}
          />
        </div>
      )}
    </div>
  );
}
