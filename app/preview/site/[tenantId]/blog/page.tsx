import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getTenant } from "@/lib/tenant-store";
import { listPostsByTenant } from "@/lib/blog-posts-store";
import { SiteShell, Breadcrumbs } from "@/shared/ui/layout";
import { readingTimeMinutes, formatDateAU, upgradePexelsCoverUrl } from "@/lib/blog-formatting";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

/** Mirrors the effectiveBasePath logic in the catchall page. Marketing
 *  apex (launcharoo.online) is proxied but NOT a tenant host — keep the
 *  /preview/site/<id> prefix so iframed clicks resolve. */
async function resolveBasePath(tenantId: string): Promise<string> {
  const h = await headers();
  const raw = (h.get("x-launcharoo-host") ?? "").trim().toLowerCase();
  if (!raw) return `/preview/site/${tenantId}`;
  const bare = raw.startsWith("www.") ? raw.slice(4) : raw;
  if (bare === "launcharoo.online") return `/preview/site/${tenantId}`;
  return "";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) return {};
  return {
    title: `Blog | ${tenant.siteProps.business.name}`,
    description: `Local advice and updates from ${tenant.siteProps.business.name}.`,
  };
}

export default async function BlogIndexPage({ params }: PageProps) {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();

  const posts = await listPostsByTenant(tenantId, { limit: 20 });
  const basePath = await resolveBasePath(tenantId);
  const business = tenant.siteProps.business;
  const suburb = business.suburb;

  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${basePath || "/"}` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${basePath}/blog` },
    ],
  };

  return (
    <SiteShell
      site={tenant.siteProps}
      basePath={basePath}
      showBlog={true}
      jsonLd={[breadcrumbList]}
    >
      <Breadcrumbs
        crumbs={[
          { label: "Home", href: basePath || "/" },
          { label: "Blog", href: `${basePath}/blog` },
        ]}
      />

      {/* Brand-colored hero */}
      <section className="border-b border-black/5 bg-[var(--accent)] text-[var(--accent-fg)]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-80">
            The {business.name} blog
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Local advice, tips, and updates
            {suburb ? ` from ${suburb}` : ""}
          </h1>
          <p className="mt-4 max-w-2xl text-lg opacity-90">
            {`Practical, no-nonsense guides written for locals. New posts published regularly.`}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        {posts.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-zinc-50 p-10 text-center">
            <p className="text-lg font-semibold text-zinc-800">No posts yet</p>
            <p className="mt-2 text-sm text-zinc-500">
              Check back soon. Fresh advice is on the way.
            </p>
          </div>
        ) : (
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => {
              const mins = readingTimeMinutes(p.bodyMd);
              return (
                <li key={p.id}>
                  <Link
                    href={`${basePath}/blog/${p.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg"
                  >
                    {p.coverImageUrl ? (
                      <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100">
                        <Image
                          src={upgradePexelsCoverUrl(p.coverImageUrl) ?? p.coverImageUrl}
                          alt={p.title}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[16/10] bg-gradient-to-br from-zinc-100 to-zinc-200" />
                    )}
                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="text-xl font-bold leading-snug tracking-tight text-zinc-900 group-hover:text-[var(--accent)]">
                        {p.title}
                      </h2>
                      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-zinc-600">
                        {p.excerpt}
                      </p>
                      <p className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                        <span>{formatDateAU(p.publishedAt)}</span>
                        <span aria-hidden>·</span>
                        <span>{mins} min read</span>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </SiteShell>
  );
}
