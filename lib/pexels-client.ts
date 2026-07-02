/**
 * lib/pexels-client.ts
 *
 * Pexels API client — searches stock photography by keyword.
 * Free tier: 200 requests/hour, 20,000/month. No payment, no approval needed.
 *
 * Auth: PEXELS_API_KEY env var (free signup at https://www.pexels.com/api/).
 * If absent, returns an empty array (caller falls back to other sources).
 */

interface PexelsPhoto {
  id: number;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
  };
  alt?: string;
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[];
  total_results?: number;
}

export interface PexelsHit {
  id: number;
  url: string;
}

/**
 * Search Pexels for `count` photos matching `query`, returning hits with IDs
 * so callers can dedupe across multiple queries in the same session.
 * Fetches 3× count (Pexels-capped at 30) so callers can drop dupes and still
 * have enough left over.
 */
export async function searchPexelsHits(query: string, count: number): Promise<PexelsHit[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn(`[pexels] PEXELS_API_KEY not set — skipping search for "${query}".`);
    return [];
  }
  if (count <= 0) return [];

  // Over-fetch (3× target, capped at Pexels' per_page=30 headroom) so we have
  // extras to skip global duplicates + near-duplicates by photographer.
  const perPage = Math.min(Math.max(count * 3, 10), 30);
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;

  try {
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) {
      console.warn(`[pexels] search "${query}" failed: ${res.status} ${await res.text().catch(() => "")}`);
      return [];
    }
    const data = (await res.json()) as PexelsSearchResponse;
    const photos = data.photos ?? [];
    console.log(`[pexels] "${query}" → ${photos.length} photos (asked for ${count})`);
    return photos.map((p) => ({ id: p.id, url: p.src.large }));
  } catch (err) {
    console.warn(`[pexels] search "${query}" error:`, err);
    return [];
  }
}

/** Back-compat wrapper — returns URLs only. Used by the /api/tenants gallery route. */
export async function searchPexels(query: string, count: number): Promise<string[]> {
  const hits = await searchPexelsHits(query, count);
  return hits.slice(0, count).map((h) => h.url);
}
