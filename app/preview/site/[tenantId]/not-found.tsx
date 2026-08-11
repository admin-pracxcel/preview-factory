import Link from "next/link";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabase";
import { getTenant } from "@/lib/tenant-store";
import { tenantIdBySlug } from "@/lib/slug";
import { sitePropsSchema } from "@/shared/types/site-props";
import { SiteShell } from "@/shared/ui/layout";
import type { Metadata } from "next";

/**
 * app/preview/site/[tenantId]/not-found.tsx
 *
 * Tenant-scoped 404. Fires whenever the catchall page calls `notFound()`
 * on a URL served under a tenant subdomain or custom domain. Rendered
 * inside the tenant's own SiteShell so the visitor sees the customer's
 * brand, nav, and footer — NOT the Launcharoo marketing chrome.
 *
 * Tenant resolution:
 *   1. Read X-Launcharoo-Host (set by the Cloudflare Worker on proxied
 *      traffic). Slug subdomain → tenantIdBySlug. Custom domain → lookup
 *      by tenants.custom_domain.
 *   2. If host resolution fails (unusual routing edge cases) render a
 *      minimal neutral fallback so we NEVER leak the Launcharoo 404 into
 *      a tenant surface.
 *
 * The Launcharoo-branded 404 stays at app/not-found.tsx and only fires
 * on the marketing host.
 */

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

const MARKETING_HOST = "launcharoo.online";

async function resolveTenantIdFromHost(): Promise<string | null> {
  const h = await headers();
  const raw = (h.get("x-launcharoo-host") ?? "").trim().toLowerCase();
  if (!raw) return null;

  const host = raw.replace(/:\d+$/, "").replace(/^www\./, "");
  if (host === MARKETING_HOST) return null;

  // Slug subdomain <slug>.launcharoo.online
  if (host.endsWith(`.${MARKETING_HOST}`)) {
    const slug = host.slice(0, -(MARKETING_HOST.length + 1));
    return tenantIdBySlug(slug);
  }

  // Custom domain
  const { data } = await supabase()
    .from("tenants")
    .select("id")
    .eq("custom_domain", host)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export default async function TenantNotFound() {
  const tenantId = await resolveTenantIdFromHost();
  const tenant = tenantId ? await getTenant(tenantId) : null;
  const parsed = tenant ? sitePropsSchema.safeParse(tenant.siteProps) : null;

  if (!tenant || !parsed?.success) {
    return <MinimalFallback />;
  }

  const business = parsed.data.business.name;

  return (
    <SiteShell site={parsed.data} basePath="" showBlog={false}>
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
          Error 404
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900">
          We can&apos;t find that page.
        </h1>
        <p className="mt-4 text-lg text-zinc-600">
          The link might be broken or the page has moved. Head back to the
          {business ? ` ${business} ` : " "}home page.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-base font-semibold text-[var(--accent-fg)] transition-opacity hover:opacity-90"
        >
          Back to home
        </Link>
      </main>
    </SiteShell>
  );
}

/**
 * Neutral last-resort 404 shown when we can't resolve the tenant (e.g.
 * request came in with no Launcharoo host header, or a slug/domain that
 * has no matching tenant row). No brand chrome — safe on any host,
 * doesn't leak Launcharoo into a tenant context.
 */
function MinimalFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-24 text-center text-zinc-900">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        Error 404
      </p>
      <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight">
        Page not found.
      </h1>
      <p className="mt-4 max-w-md text-lg text-zinc-600">
        The link might be broken or the page has moved.
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
      >
        Back to home
      </Link>
    </div>
  );
}
