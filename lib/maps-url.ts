/**
 * lib/maps-url.ts
 *
 * Parse a Google Maps link the user pasted into the intake confirm step and
 * hand back the pieces places-client needs to resolve it: a business name,
 * and (when present) a direct place_id.
 *
 * The user's clipboard almost always contains one of:
 *
 *   • https://maps.app.goo.gl/XXXXXX          (mobile Share → Copy link)
 *   • https://goo.gl/maps/XXXXXX              (legacy short link)
 *   • https://www.google.com/maps/place/<Name>/@lat,lng,17z/data=!…
 *   • https://www.google.com/maps/?q=place_id:ChIJ…
 *
 * Short links redirect (302) to the long URL. We follow one redirect to
 * unwrap the shortlink, then extract:
 *
 *   1. `placeId` if the URL contains a Places-API-compatible ChIJ id
 *   2. `businessName` from the `/place/<Name>/` path segment (URL-decoded)
 *
 * If we can't produce at least a business name we throw — the caller shows
 * the user a clear "couldn't read that link" message.
 *
 * We do NOT attempt to convert FID (`!1s0x…:0x…`) or CID (`?cid=…`) into
 * place_ids from this file — that requires a Places API call, and the
 * caller (places-client) is a better place to do that with the business
 * name in hand.
 */

export interface ParsedMapsUrl {
  /** URL-decoded business name pulled from the /place/<Name>/ path segment. */
  businessName: string;
  /** A Places-compatible ChIJ… id if the URL happens to contain one. */
  placeId?: string;
  /** The Google Maps feature ID from `!1s0xHEX:0xHEX` — a stable identifier
   *  for THE specific listing the user pasted. The modern Places API v1
   *  doesn't accept FIDs, but the legacy Place Details endpoint does, and
   *  hands back the ChIJ place_id we can then use with v1. */
  ftid?: string;
  /** Latitude scraped from `@lat,lng,zoom` or `!3d<lat>!4d<lng>`. */
  lat?: number;
  /** Longitude counterpart to `lat`. */
  lng?: number;
  /** The fully-resolved long URL after any shortlink redirect. Useful for logs. */
  resolvedUrl: string;
}

const SHORTLINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

/**
 * Follow a single 3xx redirect for known Maps shortlinks. Returns the
 * `Location` header if the response is a redirect, otherwise the original URL.
 * Never throws — bad networks fall through with the input URL.
 */
async function unwrapShortlink(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!SHORTLINK_HOSTS.has(parsed.hostname)) return url;

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      // Some CDNs care about UA — anything non-empty is fine.
      headers: { "user-agent": "Launcharoo/1.0 (+intake)" },
    });
    const location = res.headers.get("location");
    if (location && (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308)) {
      // Absolute URL usually; fall back to resolving against the shortlink host.
      try {
        return new URL(location, parsed.origin).toString();
      } catch {
        return location;
      }
    }
  } catch (err) {
    console.warn(`[maps-url] shortlink unwrap failed for ${url}:`, err);
  }
  return url;
}

/** Business-name segment from `/maps/place/<Name>/…`. Returns "" if not present. */
function extractBusinessName(pathname: string): string {
  const match = pathname.match(/\/maps\/place\/([^/]+)/i);
  if (!match) return "";
  try {
    // Google encodes spaces as `+` here, plus percent-encodes the rest.
    return decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
  } catch {
    return match[1].replace(/\+/g, " ").trim();
  }
}

/**
 * Extract `{lat, lng}` from either the `@lat,lng,zoom` path fragment or the
 * `!3d<lat>!4d<lng>` blob in the `data=` segment. Returns undefined if
 * neither is present or values are out of range.
 */
function extractCoords(url: URL): { lat: number; lng: number } | undefined {
  const full = url.toString();
  // Prefer !3d/!4d — Google adds these on the actual place pin, which is more
  // accurate than the @lat,lng camera position for our purposes.
  const dPin = full.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dPin) {
    const lat = parseFloat(dPin[1]);
    const lng = parseFloat(dPin[2]);
    if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  const at = full.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) {
    const lat = parseFloat(at[1]);
    const lng = parseFloat(at[2]);
    if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return undefined;
}

/** Extract the Google Maps feature ID from `!1s0xHEX:0xHEX` in the URL. */
function extractFtid(url: URL): string | undefined {
  const full = url.toString();
  const m = full.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  return m ? m[1] : undefined;
}

/** Direct Places `ChIJ…` id if the URL happens to include one. */
function extractPlaceId(u: URL): string | undefined {
  const candidates = [
    u.searchParams.get("place_id"),
    u.searchParams.get("query_place_id"),
    u.searchParams.get("cid"), // won't be a ChIJ id, but keep for future
  ].filter((v): v is string => !!v);
  for (const v of candidates) {
    if (/^ChIJ[A-Za-z0-9_-]+$/.test(v)) return v;
  }
  // ?q=place_id:ChIJ...
  const q = u.searchParams.get("q");
  if (q) {
    const m = q.match(/place_id:(ChIJ[A-Za-z0-9_-]+)/);
    if (m) return m[1];
  }
  return undefined;
}

/**
 * Parse any Google Maps link into a business name + optional direct place_id.
 * Throws when the input isn't recognisably a Maps URL — the API route turns
 * this into a friendly 400 for the client.
 */
export async function parseMapsUrl(input: string): Promise<ParsedMapsUrl> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Please paste a Google Maps link.");

  let asUrl: URL;
  try {
    asUrl = new URL(trimmed);
  } catch {
    throw new Error("That doesn't look like a link. Copy the URL from Google Maps and try again.");
  }

  const resolvedUrl = await unwrapShortlink(asUrl.toString());
  let resolved: URL;
  try {
    resolved = new URL(resolvedUrl);
  } catch {
    throw new Error("Couldn't read that Google Maps link. Try copying it again.");
  }

  if (!/google\.[a-z.]+$/.test(resolved.hostname) && !SHORTLINK_HOSTS.has(resolved.hostname)) {
    throw new Error("That link isn't a Google Maps link. Open your listing on Google Maps and copy the share link.");
  }

  const businessName = extractBusinessName(resolved.pathname);
  const placeId = extractPlaceId(resolved);
  const ftid = extractFtid(resolved);
  const coords = extractCoords(resolved);

  if (!businessName && !placeId && !ftid) {
    throw new Error("Couldn't read the business from that link. On Google Maps, use Share → Copy link on your listing.");
  }

  return {
    businessName: businessName || "",
    placeId,
    ftid,
    lat: coords?.lat,
    lng: coords?.lng,
    resolvedUrl,
  };
}
