import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { getTenant } from "@/lib/tenant-store";
import { getPostBySlug } from "@/lib/blog-posts-store";
import { SiteShell } from "@/shared/ui/layout";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ tenantId: string; slug: string }>;
}

/** Mirrors the effectiveBasePath logic in the catchall page. */
async function resolveBasePath(tenantId: string): Promise<string> {
  const h = await headers();
  const launcharooHost = h.get("x-launcharoo-host") ?? "";
  if (launcharooHost.trim().length > 0) return "";
  return `/preview/site/${tenantId}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantId, slug } = await params;
  const post = await getPostBySlug(tenantId, slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.coverImageUrl ? [post.coverImageUrl] : [],
      type: "article",
      publishedTime: post.publishedAt,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { tenantId, slug } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();
  const post = await getPostBySlug(tenantId, slug);
  if (!post) notFound();

  const basePath = await resolveBasePath(tenantId);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    datePublished: post.publishedAt,
    author: {
      "@type": "Organization",
      name: tenant.siteProps.business.name,
    },
  };

  return (
    <SiteShell site={tenant.siteProps} basePath={basePath} showBlog={true} jsonLd={[articleJsonLd]}>
      <main className="mx-auto max-w-3xl px-6 py-16">
        {post.coverImageUrl && (
          <div className="relative w-full aspect-[16/9] mb-8 rounded-2xl overflow-hidden">
            <Image
              src={post.coverImageUrl}
              alt={post.title}
              fill
              className="object-cover"
            />
          </div>
        )}
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">
          {post.title}
        </h1>
        <p className="text-sm text-gray-400 mb-8">
          {new Date(post.publishedAt).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <article className="prose prose-lg max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.bodyMd}</ReactMarkdown>
        </article>
        <div className="mt-12">
          <Link href={`${basePath}/blog`} className="text-sm font-medium hover:underline">
            Back to blog
          </Link>
        </div>
      </main>
    </SiteShell>
  );
}
