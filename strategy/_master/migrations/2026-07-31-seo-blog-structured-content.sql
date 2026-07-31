-- 2026-07-31 SEO blog: structured-content columns.
-- Adds TL;DR, key takeaways, and FAQs to blog_posts so generated posts
-- can carry SEO-relevant structure (FAQPage rich result, callouts, TOC).
-- Idempotent; safe to re-apply.

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS tldr TEXT;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS key_takeaways JSONB;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS faqs JSONB;
