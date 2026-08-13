import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { getTenant } from "@/lib/tenant-store";
import {
  getPostBySlug,
  listPostsByTenant,
  type BlogPost,
} from "@/lib/blog-posts-store";
import { SiteShell, Breadcrumbs } from "@/shared/ui/layout";
import {
  extractH2s,
  formatDateAU,
  readingTimeMinutes,
  upgradePexelsCoverUrl,
} from "@/lib/blog-formatting";
import { TableOfContents } from "./toc";
import { FaqAccordion } from "./faq-accordion";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ tenantId: string; slug: string }>;
}

async function resolveBasePath(tenantId: string): Promise<string> {
  const h = await headers();
  const raw = (h.get("x-launcharoo-host") ?? "").trim().toLowerCase();
  if (!raw) return `/preview/site/${tenantId}`;
  const bare = raw.startsWith("www.") ? raw.slice(4) : raw;
  if (bare === "launcharoo.online") return `/preview/site/${tenantId}`;
  return "";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantId, slug } = await params;
  const post = await getPostBySlug(tenantId, slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.tldr ?? post.excerpt,
    openGraph: {
      title: post.title,
      description: post.tldr ?? post.excerpt,
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
  const business = tenant.siteProps.business;
  const headings = extractH2s(post.bodyMd);
  const readMins = readingTimeMinutes(post.bodyMd);

  // Related posts: 4 most recent, skip current, take 3.
  const recent = await listPostsByTenant(tenantId, { limit: 4 });
  const related = recent.filter((p) => p.slug !== post.slug).slice(0, 3);

  const jsonLd = buildJsonLd(post, tenant.siteProps.business.name, basePath);

  return (
    <SiteShell
      site={tenant.siteProps}
      basePath={basePath}
      showBlog={true}
      jsonLd={jsonLd}
    >
      <Breadcrumbs
        crumbs={[
          { label: "Home", href: basePath || "/" },
          { label: "Blog", href: `${basePath}/blog` },
          { label: post.title, href: `${basePath}/blog/${post.slug}` },
        ]}
      />

      <ArticleHero post={post} readMins={readMins} />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_240px]">
          {/* Body */}
          <div className="min-w-0">
            {post.tldr && <TldrCallout tldr={post.tldr} />}

            <article className="prose prose-lg mt-8 max-w-none prose-headings:scroll-mt-24 prose-headings:tracking-tight prose-h2:mt-12 prose-h2:text-2xl prose-h2:font-bold prose-h3:text-xl prose-h3:font-semibold prose-a:text-[var(--accent)] prose-a:no-underline hover:prose-a:underline prose-strong:text-zinc-900 prose-table:text-sm prose-th:bg-zinc-50 prose-th:text-zinc-800">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug]}
              >
                {post.bodyMd}
              </ReactMarkdown>
            </article>

            {post.keyTakeaways && post.keyTakeaways.length > 0 && (
              <KeyTakeaways items={post.keyTakeaways} />
            )}

            {post.faqs && post.faqs.length > 0 && (
              <section className="mt-14">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
                  Frequently asked questions
                </h2>
                <div className="mt-6">
                  <FaqAccordion faqs={post.faqs} />
                </div>
              </section>
            )}

            <AuthorBlock business={business} basePath={basePath} />
          </div>

          {/* Sticky TOC sidebar (desktop only) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <TableOfContents headings={headings} />
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <RelatedPosts related={related} basePath={basePath} />
        )}
      </div>
    </SiteShell>
  );
}

function ArticleHero({ post, readMins }: { post: BlogPost; readMins: number }) {
  return (
    <section className="border-b border-black/5 bg-[var(--accent)] text-[var(--accent-fg)]">
      <div className="mx-auto max-w-4xl px-4 py-14 sm:py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide opacity-80">
          Blog
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="mt-4 max-w-2xl text-lg opacity-90">{post.excerpt}</p>
        )}
        <p className="mt-6 flex items-center gap-2 text-sm font-medium opacity-75">
          <span>{formatDateAU(post.publishedAt)}</span>
          <span aria-hidden>·</span>
          <span>{readMins} min read</span>
        </p>
      </div>
      {post.coverImageUrl && (
        <div className="mx-auto max-w-4xl px-4 pb-14 sm:pb-20">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10">
            <Image
              src={upgradePexelsCoverUrl(post.coverImageUrl) ?? post.coverImageUrl}
              alt={post.title}
              fill
              sizes="(min-width: 1024px) 900px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      )}
    </section>
  );
}

function TldrCallout({ tldr }: { tldr: string }) {
  return (
    <aside
      aria-label="TL;DR"
      className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-6"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
        TL;DR
      </p>
      <p className="mt-2 text-base leading-relaxed text-zinc-800">{tldr}</p>
    </aside>
  );
}

function KeyTakeaways({ items }: { items: string[] }) {
  return (
    <section className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
      <h2 className="text-xl font-bold tracking-tight text-zinc-900">
        Key takeaways
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((t, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden
              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
            />
            <span className="text-base leading-relaxed text-zinc-800">{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AuthorBlock({
  business,
  basePath,
}: {
  business: { name: string; suburb?: string };
  basePath: string;
}) {
  return (
    <section className="mt-14 border-t border-zinc-200 pt-8">
      <p className="text-sm text-zinc-500">Written by</p>
      <p className="mt-1 text-lg font-bold text-zinc-900">{business.name}</p>
      {business.suburb && (
        <p className="text-sm text-zinc-600">Based in {business.suburb}</p>
      )}
      <Link
        href={basePath || "/"}
        className="mt-3 inline-block text-sm font-semibold text-[var(--accent)] hover:underline"
      >
        Visit our website →
      </Link>
    </section>
  );
}

function RelatedPosts({
  related,
  basePath,
}: {
  related: BlogPost[];
  basePath: string;
}) {
  return (
    <section className="mt-20 border-t border-zinc-200 pt-14">
      <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
        Keep reading
      </h2>
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((p) => (
          <li key={p.id}>
            <Link
              href={`${basePath}/blog/${p.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              {p.coverImageUrl && (
                <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100">
                  <Image
                    src={upgradePexelsCoverUrl(p.coverImageUrl) ?? p.coverImageUrl}
                    alt={p.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-base font-bold leading-snug text-zinc-900 group-hover:text-[var(--accent)]">
                  {p.title}
                </h3>
                <p className="mt-2 line-clamp-2 flex-1 text-sm text-zinc-600">
                  {p.excerpt}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function buildJsonLd(
  post: BlogPost,
  businessName: string,
  basePath: string,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.tldr ?? post.excerpt,
      image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
      datePublished: post.publishedAt,
      author: { "@type": "Organization", name: businessName },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: basePath || "/" },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${basePath}/blog` },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title,
          item: `${basePath}/blog/${post.slug}`,
        },
      ],
    },
  ];
  if (post.faqs && post.faqs.length > 0) {
    out.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }
  return out;
}
