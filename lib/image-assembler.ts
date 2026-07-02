/**
 * lib/image-assembler.ts
 *
 * Post-processes a generated SiteProps blob to populate image URLs. The LLM
 * produces structure + copy; we own the images so we don't have to trust the
 * model to invent URLs (which it won't, or will hallucinate broken ones).
 *
 * Pool composition:
 *   1. Google Business Profile photos (most authentic — real business photos)
 *   2. Pexels stock photos — searched per-slot semantically so the images
 *      genuinely match what each slot depicts (service page uses the service
 *      title, gallery uses each caption, hero uses "<niche> interior", etc.)
 *   3. Global dedupe by Pexels photo ID so we never serve the same stock shot
 *      twice on one site.
 */

import type { SiteProps } from "@/shared/types/site-props";
import type { GbpData } from "@/lib/places-client";
import { searchPexelsHits } from "@/lib/pexels-client";

/** Generated gallery target when the LLM omits one. Matches example data norms. */
const DEFAULT_GALLERY_COUNT = 6;

/** Category-flavoured hero query modifiers keyed off common niche keywords. */
const HERO_MODIFIERS: Array<{ match: RegExp; suffix: string }> = [
  { match: /barber/i, suffix: "barber shop interior" },
  { match: /hair|salon/i, suffix: "hair salon interior" },
  { match: /nail/i, suffix: "nail salon interior" },
  { match: /lash|brow/i, suffix: "beauty studio close up" },
  { match: /beauty|aesthet|laser|skin|waxing|tanning/i, suffix: "beauty clinic treatment room" },
  { match: /gym|crossfit|boxing|fitness/i, suffix: "gym interior weights" },
  { match: /yoga|pilates/i, suffix: "yoga studio interior" },
  { match: /physio|chiro|osteo|podiatr|massage|myo/i, suffix: "physiotherapy clinic treatment" },
  { match: /dietit|dietet/i, suffix: "nutritionist consultation" },
  { match: /psychol|speech|occupational/i, suffix: "therapist consultation room" },
  { match: /plumb/i, suffix: "plumber at work" },
  { match: /electric/i, suffix: "electrician at work" },
  { match: /carpent/i, suffix: "carpenter woodworking" },
  { match: /paint/i, suffix: "house painter working" },
];

/** Gallery query rotation so a niche without captions still produces variety. */
const GALLERY_ROTATION = [
  "workspace",
  "tools close up",
  "hands at work",
  "finished result",
  "team",
  "detail shot",
];

interface QueryPlan {
  /** Semantic search terms fed to Pexels, e.g. "fade haircut". */
  query: string;
  /** How many hits we need for this query (accounting for global dedupe). */
  count: number;
  /** Slot destinations — where the resolved URLs go. */
  slots: Slot[];
}

type Slot =
  | { kind: "hero" }
  | { kind: "home-about" }
  | { kind: "about" }
  | { kind: "gallery"; index: number }
  | { kind: "service"; index: number }
  | { kind: "location"; index: number };

export async function assembleImages(siteProps: SiteProps, gbp: GbpData): Promise<SiteProps> {
  // ---- 1. Bootstrap the gallery if the LLM didn't emit one so we can assign
  // per-slot URLs in a stable way.
  if (!siteProps.home.gallery || siteProps.home.gallery.length === 0) {
    siteProps.home.gallery = Array.from({ length: DEFAULT_GALLERY_COUNT }, (_, idx) => ({
      id: `gallery-${idx + 1}`,
      image_url: "",
      alt: `${gbp.name} — work sample ${idx + 1}`,
    }));
  }

  // ---- 2. First, use GBP photos in slot order (hero → about → gallery → …).
  // Real business photos beat any stock image every time.
  const gbpPhotos = gbp.photos ?? [];
  const slotOrder: Slot[] = [
    { kind: "hero" },
    ...(siteProps.home.about ? [{ kind: "home-about" as const }] : []),
    ...(siteProps.about ? [{ kind: "about" as const }] : []),
    ...siteProps.home.gallery.map((_, i) => ({ kind: "gallery" as const, index: i })),
    ...siteProps.services.map((_, i) => ({ kind: "service" as const, index: i })),
    ...siteProps.locations.map((_, i) => ({ kind: "location" as const, index: i })),
  ];

  const filled = new Set<string>();
  const writeToSlot = (slot: Slot, url: string) => {
    filled.add(slotKey(slot));
    switch (slot.kind) {
      case "hero":
        siteProps.branding.hero_image_url = url;
        return;
      case "home-about":
        if (siteProps.home.about) siteProps.home.about.photo_url = url;
        return;
      case "about":
        if (siteProps.about) siteProps.about.photo_url = url;
        return;
      case "gallery":
        siteProps.home.gallery![slot.index].image_url = url;
        return;
      case "service":
        siteProps.services[slot.index].hero_image = url;
        return;
      case "location":
        siteProps.locations[slot.index].hero_image = url;
        return;
    }
  };

  for (let i = 0; i < gbpPhotos.length && i < slotOrder.length; i++) {
    writeToSlot(slotOrder[i], gbpPhotos[i]);
  }

  // ---- 3. Everything the GBP pool couldn't cover gets a semantic Pexels
  // query built from that slot's real content (caption, service title, etc.).
  const remaining = slotOrder.filter((s) => !filled.has(slotKey(s)));
  if (remaining.length === 0) {
    console.log(
      `[image-assembler] pool: ${gbpPhotos.length} GBP photos covered all ${slotOrder.length} slots (no Pexels needed)`
    );
    return siteProps;
  }

  const plans = buildQueryPlans(remaining, siteProps, gbp);
  const seen = new Set<number>();
  for (const plan of plans) {
    if (plan.slots.length === 0) continue;
    const hits = await searchPexelsHits(plan.query, plan.count);
    const fresh = hits.filter((h) => !seen.has(h.id));
    fresh.slice(0, plan.slots.length).forEach((h, i) => {
      seen.add(h.id);
      writeToSlot(plan.slots[i], h.url);
    });
  }

  // ---- 4. Belt-and-braces: anything still empty (Pexels down, rate-limited,
  // etc.) falls back to whatever URL we did find, cycled — better a repeat
  // than a broken image slot.
  const anyUrl =
    siteProps.branding.hero_image_url ||
    siteProps.home.about?.photo_url ||
    gbpPhotos[0] ||
    "";
  const stillEmpty = slotOrder.filter((s) => !filled.has(slotKey(s)));
  if (stillEmpty.length > 0 && anyUrl) {
    console.warn(
      `[image-assembler] ${stillEmpty.length} slot(s) unfilled after Pexels — falling back to first-available URL.`
    );
    for (const slot of stillEmpty) writeToSlot(slot, anyUrl);
  }

  console.log(
    `[image-assembler] pool: ${gbpPhotos.length} GBP + ${seen.size} unique Pexels = ${gbpPhotos.length + seen.size} for ${slotOrder.length} slots`
  );
  return siteProps;
}

function slotKey(slot: Slot): string {
  return "index" in slot ? `${slot.kind}:${slot.index}` : slot.kind;
}

/**
 * Group remaining slots by the search query they should each use, then return
 * one plan per unique query. Overloads a single Pexels call with all slots
 * that share a query so we get better dedupe and fewer API round-trips.
 */
function buildQueryPlans(remaining: Slot[], site: SiteProps, gbp: GbpData): QueryPlan[] {
  const niche = normaliseNiche(gbp.niche);
  const heroQuery = pickHeroQuery(niche);
  const byQuery = new Map<string, Slot[]>();

  const push = (q: string, s: Slot) => {
    const key = q.toLowerCase().trim();
    const arr = byQuery.get(key) ?? [];
    arr.push(s);
    byQuery.set(key, arr);
  };

  for (const slot of remaining) {
    switch (slot.kind) {
      case "hero":
      case "home-about":
      case "about": {
        push(heroQuery, slot);
        break;
      }
      case "gallery": {
        // Prefer the caption/alt text (real semantic hint), fall back to a
        // rotating "workspace / tools / team / detail" query per index so
        // slots without captions still produce variety.
        const item = site.home.gallery?.[slot.index];
        const caption = (item?.caption ?? item?.alt ?? "").trim();
        const semantic = looksMeaningful(caption)
          ? `${niche} ${caption}`
          : `${niche} ${GALLERY_ROTATION[slot.index % GALLERY_ROTATION.length]}`;
        push(semantic, slot);
        break;
      }
      case "service": {
        const svc = site.services[slot.index];
        const title = svc?.title ?? "";
        // "Fade haircut" → "fade haircut barber" so Pexels returns focused
        // shots but with niche context. Bare service titles like "hair cut"
        // still work because Pexels is tolerant.
        const semantic = looksMeaningful(title) ? `${title} ${niche}` : heroQuery;
        push(semantic, slot);
        break;
      }
      case "location": {
        // Suburb name alone is useless for Pexels — pair with niche + interior
        // so we at least get a category-appropriate shot.
        push(heroQuery, slot);
        break;
      }
    }
  }

  return Array.from(byQuery.entries()).map(([query, slots]) => ({
    query,
    count: slots.length,
    slots,
  }));
}

/** Normalise the niche keyword for use as a Pexels search anchor. */
function normaliseNiche(raw: string): string {
  const lower = raw.toLowerCase().trim();
  // Strip trailing qualifiers so "Barber Shop" → "barber", "Nail Salon" → "nail"
  return lower.replace(/\s+(shop|studio|salon|clinic|gym|centre|center|business)$/i, "").trim() || lower;
}

/** Pick a hero-query modifier for the niche (or fall back to the bare niche). */
function pickHeroQuery(niche: string): string {
  for (const rule of HERO_MODIFIERS) {
    if (rule.match.test(niche)) return rule.suffix;
  }
  return `${niche} shop interior`;
}

/**
 * Filter out obviously non-useful semantic hints (empty, one-word "photo",
 * generic "image N" placeholders) so we don't waste Pexels queries on them.
 */
function looksMeaningful(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  if (/^(image|photo|picture)\s*\d*$/i.test(trimmed)) return false;
  if (/^work sample/i.test(trimmed)) return false;
  return true;
}
