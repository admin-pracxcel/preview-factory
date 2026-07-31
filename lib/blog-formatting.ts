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

/**
 * Upgrade a Pexels image URL from its stored `large` variant (940x650) to
 * the `large2x` variant (1880x1300) by doubling the w/h query params.
 * Same rendered size, but 2x-DPR displays get a crisp source. Pexels URLs
 * that don't match the pattern (or aren't Pexels) pass through unchanged.
 * Applied at render time so existing rows benefit without a DB update.
 */
export function upgradePexelsCoverUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (!url.includes("images.pexels.com")) return url;
  // Only rewrite the exact `large` variant (940x650). Leave large2x, original,
  // and any other size Pexels serves untouched so this stays idempotent —
  // running the upgrader twice on the same URL must not keep doubling it.
  if (!/[?&]w=940(?:&|$)/.test(url) || !/[?&]h=650(?:&|$)/.test(url)) return url;
  return url.replace(/([?&])w=940(?=&|$)/, "$1w=1880").replace(/([?&])h=650(?=&|$)/, "$1h=1300");
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
