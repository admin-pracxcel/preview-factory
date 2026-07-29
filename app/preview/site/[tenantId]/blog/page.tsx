import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenant-store";
import { listPostsByTenant } from "@/lib/blog-posts-store";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ tenantId: string }>;
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-extrabold tracking-tight mb-8">Blog</h1>
      {posts.length === 0 ? (
        <p className="text-gray-500">No posts yet. Check back soon.</p>
      ) : (
        <ul className="flex flex-col gap-8">
          {posts.map((p) => (
            <li key={p.id} className="border-b pb-6">
              <Link href={`/blog/${p.slug}`} className="group">
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
  );
}
