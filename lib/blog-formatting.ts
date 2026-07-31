/**
 * lib/blog-formatting.ts
 *
 * Tiny presentation helpers shared by the blog index + post pages.
 */

import GithubSlugger from "github-slugger";

/**
 * Estimated reading time in minutes at ~225 words per minute (typical for
 * scanning informational content). Minimum 1 minute so short posts don't
 * render as "0 min read".
 */
export function readingTimeMinutes(bodyMd: string): number {
  const words = bodyMd.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

/** Australian long date: "5 July 2026". */
export function formatDateAU(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Extract level-2 headings from a Markdown body, in order. Uses the same
 * github-slugger algorithm that rehype-slug applies to rendered headings,
 * so TOC anchors match the `id` attributes on the H2 elements.
 */
export function extractH2s(bodyMd: string): Array<{ id: string; text: string }> {
  const out: Array<{ id: string; text: string }> = [];
  const slugger = new GithubSlugger();
  const re = /^##\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyMd)) !== null) {
    const text = m[1].replace(/[*_`]/g, "").trim();
    if (!text) continue;
    out.push({ id: slugger.slug(text), text });
  }
  return out;
}
