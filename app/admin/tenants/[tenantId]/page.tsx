/**
 * app/admin/tenants/[tenantId]/page.tsx
 * Concierge-only tenant deep-view.
 *
 * Pulls everything the founder wants at a glance for support / audit:
 *   - identity (name, niche, category, slug, ID)
 *   - owner (email, session id, claim + cancel timestamps)
 *   - billing (subscription status, customer + subscription IDs, last
 *     paid + next-bill dates from Stripe, plan amount, cancel-at-period-end)
 *   - domain (custom domain, DNS status, assigned nameservers, verified date)
 *   - activity (lead count, edit-request breakdown)
 *   - timestamps (created / updated)
 *
 * Gated by isAdminSession → 404 for anyone else.
 */

import { cookies as nextCookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  LayoutDashboard,
  ChevronLeft,
  Building2,
  CreditCard,
  Globe,
  Activity,
  Clock,
  Mail,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isAdminSession } from "@/lib/admin";
import { getTenant } from "@/lib/tenant-store";
import { listLeads } from "@/lib/leads-store";
import { listEditRequests } from "@/lib/edit-requests-store";
import { retrieveSubscription } from "@/lib/stripe-client";
import type { MutableCookies } from "@/lib/session";
import { LogoutButton } from "@/app/components/LogoutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tenant details — Concierge",
};

/* ---------------------------------------------------------------- helpers */

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtUnix(sec: number | null | undefined): string {
  if (!sec) return "—";
  return fmtDate(new Date(sec * 1000).toISOString());
}

function fmtMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null) return "—";
  const value = amount / 100;
  const c = (currency ?? "aud").toUpperCase();
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: c,
    }).format(value);
  } catch {
    return `${c} ${value.toFixed(2)}`;
  }
}

function publicHost(t: {
  slug?: string;
  customDomain?: string;
  customDomainStatus?: string;
}): string | null {
  if (t.customDomain && t.customDomainStatus === "active") return t.customDomain;
  if (t.slug) return `${t.slug}.launcharoo.online`;
  return null;
}

/* ------------------------------------------------------------------ page */

export default async function AdminTenantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  const admin = await isAdminSession(cookieStore);
  if (!admin) notFound();

  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();

  // Get the raw row for the extra columns tenantRecord flattens away
  // (session_id, subscription_status, cancelled_at, updated_at, etc).
  const { data: raw } = await supabase()
    .from("tenants")
    .select(
      "session_id, subscription_status, cancelled_at, updated_at, billing_provider",
    )
    .eq("id", tenantId)
    .maybeSingle();

  const [leads, editRequests, subscription] = await Promise.all([
    listLeads(tenantId),
    listEditRequests(tenantId),
    retrieveSubscription(tenant.stripeSubscriptionId),
  ]);

  const editByStatus: Record<string, number> = {};
  for (const r of editRequests) {
    editByStatus[r.status] = (editByStatus[r.status] ?? 0) + 1;
  }

  const price = subscription?.items?.data?.[0]?.price;
  const host = publicHost(tenant);

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
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
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Concierge
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 flex flex-col gap-8">
        {/* Heading */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight sm:text-4xl">
              {tenant.name || "(untitled)"}
            </h1>
            <p className="mt-1 text-sm text-white/40">
              Concierge view — everything on file for this tenant.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/${tenantId}`}
              className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:border-blue-400/60 hover:bg-blue-500/20 hover:text-blue-100 transition-colors"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Tenant dashboard
            </Link>
            <Link
              href={`/preview/${tenantId}`}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 hover:border-white/30 hover:bg-white/5 hover:text-white transition-colors"
            >
              Preview editor
            </Link>
            {host && (
              <a
                href={`https://${host}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 hover:border-white/30 hover:bg-white/5 hover:text-white transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Live site
              </a>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Identity */}
          <Card icon={<Building2 className="h-5 w-5 text-blue-400" />} title="Identity">
            <Row label="Business name" value={tenant.name || "—"} />
            <Row label="Niche" value={tenant.niche || "—"} />
            <Row label="Category" value={tenant.category || "—"} />
            <Row label="Status" value={tenant.status} />
            <Row label="Slug" value={tenant.slug ?? "—"} mono />
            <Row label="Tenant ID" value={tenant.id} mono small />
            <Row label="Google Place ID" value={tenant.placeId ?? "—"} mono small />
          </Card>

          {/* Owner */}
          <Card icon={<Mail className="h-5 w-5 text-green-400" />} title="Owner">
            <Row
              label="Email"
              value={
                tenant.ownerEmail ? (
                  <a
                    href={`mailto:${tenant.ownerEmail}`}
                    className="text-blue-300 hover:text-blue-200 hover:underline"
                  >
                    {tenant.ownerEmail}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <Row
              label="Session ID"
              value={(raw?.session_id as string | null) ?? "—"}
              mono
              small
            />
            <Row label="Claimed at" value={fmtDate(tenant.publishedAt)} />
            <Row
              label="Cancelled at"
              value={fmtDate((raw?.cancelled_at as string | null) ?? null)}
            />
          </Card>

          {/* Billing */}
          <Card
            icon={<CreditCard className="h-5 w-5 text-purple-400" />}
            title="Billing"
            className="md:col-span-2"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Row
                  label="Provider"
                  value={(raw?.billing_provider as string | null) ?? "stripe"}
                />
                <Row
                  label="Subscription status"
                  value={
                    subscription?.status ??
                    (raw?.subscription_status as string | null) ??
                    "—"
                  }
                />
                <Row
                  label="Customer ID"
                  value={tenant.stripeCustomerId ?? "—"}
                  mono
                  small
                />
                <Row
                  label="Subscription ID"
                  value={tenant.stripeSubscriptionId ?? "—"}
                  mono
                  small
                />
              </div>
              <div className="flex flex-col gap-1">
                <Row
                  label="Plan"
                  value={
                    price
                      ? `${fmtMoney(price.unit_amount, price.currency)} / ${price.recurring?.interval ?? "period"}`
                      : "—"
                  }
                />
                <Row
                  label="Subscription started"
                  value={fmtUnix(subscription?.start_date)}
                />
                <Row
                  label="Last paid"
                  value={fmtUnix(subscription?.current_period_start)}
                />
                <Row
                  label="Next bill"
                  value={
                    subscription?.cancel_at_period_end
                      ? `${fmtUnix(subscription.current_period_end)} — will cancel`
                      : fmtUnix(subscription?.current_period_end)
                  }
                />
                {subscription?.cancel_at && (
                  <Row
                    label="Scheduled cancel"
                    value={fmtUnix(subscription.cancel_at)}
                  />
                )}
              </div>
            </div>
            {!process.env.STRIPE_SECRET_KEY && (
              <p className="mt-3 text-xs text-amber-300/70">
                STRIPE_SECRET_KEY not set — billing dates unavailable.
              </p>
            )}
            {process.env.STRIPE_SECRET_KEY &&
              tenant.stripeSubscriptionId &&
              !subscription && (
                <p className="mt-3 text-xs text-amber-300/70">
                  Couldn&apos;t reach Stripe (or subscription not found).
                </p>
              )}
          </Card>

          {/* Domain */}
          <Card
            icon={<Globe className="h-5 w-5 text-cyan-400" />}
            title="Domain"
            className="md:col-span-2"
          >
            <Row label="Launcharoo subdomain" value={tenant.slug ? `${tenant.slug}.launcharoo.online` : "—"} mono />
            <Row label="Custom domain" value={tenant.customDomain ?? "—"} mono />
            <Row label="Custom domain status" value={tenant.customDomainStatus ?? "—"} />
            <Row label="Verified at" value={fmtDate(tenant.customDomainVerifiedAt)} />
            <Row label="Cloudflare zone ID" value={tenant.cloudflareZoneId ?? "—"} mono small />
            {tenant.assignedNameservers && tenant.assignedNameservers.length > 0 && (
              <Row
                label="Assigned nameservers"
                value={
                  <ul className="mt-1 flex flex-col gap-0.5 font-mono text-xs text-white/80">
                    {tenant.assignedNameservers.map((ns) => (
                      <li key={ns}>{ns}</li>
                    ))}
                  </ul>
                }
              />
            )}
          </Card>

          {/* Activity */}
          <Card icon={<Activity className="h-5 w-5 text-amber-400" />} title="Activity">
            <Row label="Total leads" value={leads.length} />
            <Row label="Total change requests" value={editRequests.length} />
            {Object.keys(editByStatus).length > 0 && (
              <div className="mt-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">
                  By status
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {Object.entries(editByStatus).map(([s, n]) => (
                    <li
                      key={s}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-white/70"
                    >
                      {s}: {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Timestamps */}
          <Card icon={<Clock className="h-5 w-5 text-white/60" />} title="Timestamps">
            <Row label="Created at" value={fmtDate(tenant.createdAt)} />
            <Row
              label="Updated at"
              value={fmtDate((raw?.updated_at as string | null) ?? tenant.updatedAt)}
            />
            <Row label="Claimed at" value={fmtDate(tenant.publishedAt)} />
            <Row
              label="Cancelled at"
              value={fmtDate((raw?.cancelled_at as string | null) ?? null)}
            />
          </Card>
        </div>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function Card({
  icon,
  title,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono = false,
  small = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_1fr] items-baseline gap-3 py-1">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span
        className={`min-w-0 break-words ${mono ? "font-mono" : ""} ${small ? "text-xs" : "text-sm"} text-white/85`}
      >
        {value}
      </span>
    </div>
  );
}
