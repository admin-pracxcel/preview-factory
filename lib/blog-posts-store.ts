/**
 * lib/blog-posts-store.ts
 *
 * Supabase-backed store for blog posts. Rows are inserted by
 * /api/admin/seo/blog-posts (called by the n8n workflow after Claude
 * Code generates the content) and read by the tenant's public blog
 * routes and the dashboard SeoStatusCard.
 */

import { supabase } from "@/lib/supabase";

const TABLE = "blog_posts";

export interface BlogPost {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  coverImageUrl?: string;
  status: "published" | "failed";
  publishedAt: string;
  generationMeta?: Record<string, unknown>;
  createdAt: string;
}

interface BlogPostRow {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  cover_image_url: string | null;
  status: "published" | "failed";
  published_at: string;
  generation_meta: Record<string, unknown> | null;
  created_at: string;
}

function rowToRecord(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyMd: row.body_md,
    coverImageUrl: row.cover_image_url ?? undefined,
    status: row.status,
    publishedAt: row.published_at,
    generationMeta: row.generation_meta ?? undefined,
    createdAt: row.created_at,
  };
}

export interface CreateBlogPostInput {
  tenantId: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  coverImageUrl?: string;
  generationMeta?: Record<string, unknown>;
}

export async function insertBlogPost(input: CreateBlogPostInput): Promise<BlogPost> {
  const { data, error } = await supabase()
    .from(TABLE)
    .insert({
      tenant_id: input.tenantId,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      body_md: input.bodyMd,
      cover_image_url: input.coverImageUrl ?? null,
      generation_meta: input.generationMeta ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`insertBlogPost: ${error.message}`);
  return rowToRecord(data as BlogPostRow);
}

export async function listPostsByTenant(
  tenantId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<BlogPost[]> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`listPostsByTenant: ${error.message}`);
  return (data as BlogPostRow[]).map(rowToRecord);
}

export async function getPostBySlug(
  tenantId: string,
  slug: string,
): Promise<BlogPost | null> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getPostBySlug: ${error.message}`);
  return data ? rowToRecord(data as BlogPostRow) : null;
}

export async function recentTitles(tenantId: string, limit: number): Promise<string[]> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("title")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`recentTitles: ${error.message}`);
  return (data as { title: string }[]).map((r) => r.title);
}

export async function countByTenant(tenantId: string): Promise<number> {
  const { count, error } = await supabase()
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "published");
  if (error) throw new Error(`countByTenant: ${error.message}`);
  return count ?? 0;
}
