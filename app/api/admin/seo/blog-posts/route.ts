import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCronRequest, CronAuthError } from "@/lib/admin-cron-auth";
import { insertBlogPost } from "@/lib/blog-posts-store";
import { logSuccess } from "@/lib/seo-publish-log-store";
import { supabase } from "@/lib/supabase";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  title: z.string().min(1).max(200),
  excerpt: z.string().min(1).max(500),
  bodyMd: z.string().min(50),
  coverImageUrl: z.string().url().optional(),
  generationMeta: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    assertCronRequest(req);
  } catch (err) {
    if (err instanceof CronAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const rawBody = await req.json().catch(() => null);
  const parse = bodySchema.safeParse(rawBody);
  if (!parse.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parse.error.flatten() },
      { status: 400 },
    );
  }
  const input = parse.data;

  const blogPost = await insertBlogPost({
    tenantId: input.tenantId,
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    bodyMd: input.bodyMd,
    coverImageUrl: input.coverImageUrl,
    generationMeta: input.generationMeta,
  });

  await logSuccess({
    tenantId: input.tenantId,
    kind: "blog",
    blogPostId: blogPost.id,
  });

  const { error: stampErr } = await supabase()
    .from("tenant_addons")
    .update({ last_blog_tick_at: new Date().toISOString() })
    .eq("tenant_id", input.tenantId)
    .eq("addon_key", "seo")
    .eq("status", "active");
  if (stampErr) {
    // Blog post already inserted; log but don't fail the request — the
    // idempotency guard is a nice-to-have, not required for correctness.
    console.warn("[blog-posts] failed to stamp last_blog_tick_at", stampErr);
  }

  return NextResponse.json({ blogPost });
}
