import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getTenant } from "@/lib/tenant-store";
import { listPostsByTenant } from "@/lib/blog-posts-store";
import { SiteShell } from "@/shared/ui/layout";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

/** Mirrors the effectiveBasePath logic in the catchall page. */
async function resolveBasePath(tenantId: string): Promise<string> {
  const h = await headers();
  const launcharooHost = h.get("x-launcharoo-host") ?? "";
  if (launcharooHost.trim().length > 0) return "";
  return `/preview/site/${tenantId}`;
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

  return (
    <SiteShell site={tenant.siteProps} basePath={basePath} showBlog={true}>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight mb-8">Blog</h1>
        {posts.length === 0 ? (
          <p className="text-gray-500">No posts yet. Check back soon.</p>
        ) : (
          <ul className="flex flex-col gap-8">
            {posts.map((p) => (
              <li key={p.id} className="border-b pb-6">
                <Link href={`${basePath}/blog/${p.slug}`} className="group">
                  <h2 className="text-2xl font-bold group-hover:underline">
                    {p.title}
                  </h2>
                  <p className="mt-2 text-gray-600">{p.excerpt}</p>
                  <p className="mt-3 text-sm text-gray-400">
                    {new Date(p.publishedAt).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </SiteShell>
  );
}
