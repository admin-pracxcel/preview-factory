/**
 * lib/places-client.ts
 * Google Places API (New) client — fetches a business profile and returns a
 * normalised GbpData payload suitable for the generator.
 *
 * Key resolution:
 *   GOOGLE_PLACES_API_KEY env var → real Places API call
 *   Not set                       → fixture data (Clearflow Plumbing, Melbourne)
 *
 * Human deploy note: create a Google Cloud API key with "Places API (New)"
 * enabled and add it as GOOGLE_PLACES_API_KEY. See
 * strategy/_master/deployment-checklist.md section "Google Places API".
 */

/* ----------------------------------------------------------------------- types */

export interface GbpData {
  name: string;
  niche: string;
  suburb: string;
  state: string;
  phone: string;
  address: string;
  description: string;
  services: string[];
  reviews: Array<{ author: string; rating: number; text: string }>;
  years_in_business?: number;
  /** Resolved URLs to public photos from the Google Business Profile. */
  photos?: string[];
  /** Aggregate Google rating (1.0–5.0). Used to build a real "on Google" USP. */
  rating?: number;
  /** Total review count on Google (not just the 5 we fetch text for). */
  reviewCount?: number;
}

/* ---------------------------------------------------------------------- fixture */

/** Built-in fixture — Clearflow Plumbing, Melbourne VIC. */
const FIXTURE_CLEARFLOW: GbpData = {
  name: "Clearflow Plumbing",
  niche: "plumber",
  suburb: "Southbank",
  state: "VIC",
  phone: "03 9012 4567",
  address: "Level 2, 101 Southbank Blvd, Southbank VIC 3006",
  description:
    "Clearflow Plumbing is a Melbourne-based licensed plumbing business serving the inner south and CBD fringe suburbs. We specialise in blocked drains, burst pipes, hot water systems, gas fitting, bathroom renovations, and general maintenance. Available 24/7 for emergencies — no call-out fee between 7am and 6pm weekdays.",
  services: [
    "Blocked drains (drain camera inspection, hydro-jet clearing)",
    "Burst pipes and emergency repairs",
    "Hot water systems (electric, gas, heat pump, continuous flow)",
    "Gas fitting and gas appliance installation",
    "Bathroom renovations and re-piping",
    "General plumbing maintenance",
    "Toilet and cistern repairs",
    "Tap and mixer replacement",
    "Stormwater and sewer drain repairs",
    "New home and renovation rough-in plumbing",
  ],
  reviews: [
    {
      author: "Sarah L.",
      rating: 5,
      text: "Called Clearflow at 10pm for a burst pipe under the kitchen sink. They were on the door in 45 minutes and had everything fixed before midnight. Incredibly professional and the price was fair. Won't use anyone else.",
    },
    {
      author: "Marcus T.",
      rating: 5,
      text: "Had a blocked drain that three other plumbers couldn't fix. Clearflow brought a camera and found a root intrusion near the boundary. Sorted it same day. Excellent work and very tidy.",
    },
    {
      author: "Priya and James K.",
      rating: 5,
      text: "We used Clearflow for our bathroom renovation in South Melbourne — new shower, vanity rough-in and toilet relocation. Turned up on time every day, finished on schedule, and the finish was perfect.",
    },
    {
      author: "David F.",
      rating: 4,
      text: "Good service for hot water system replacement. They quoted on the spot, came back the next morning, and the new unit has been running perfectly.",
    },
  ],
  years_in_business: 11,
};

/* ---------------------------------------------------------------- public API */

/**
 * Fetch GBP data by Google place ID.
 * Falls back to the built-in fixture if GOOGLE_PLACES_API_KEY is not set.
 */
export async function fetchByPlaceId(placeId: string, niche: string): Promise<GbpData> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn(
      `[places-client] GOOGLE_PLACES_API_KEY not set — using Clearflow fixture for place ${placeId}.`
    );
    return { ...FIXTURE_CLEARFLOW, niche };
  }
  return fetchPlacesApiDetails(placeId, niche, apiKey);
}

/**
 * Search for a business by name (with optional suburb for location scope)
 * using Places text search.
 * Falls back to the built-in fixture if GOOGLE_PLACES_API_KEY is not set.
 */
export async function fetchByName(
  name: string,
  niche: string,
  suburb?: string
): Promise<GbpData> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn(
      `[places-client] GOOGLE_PLACES_API_KEY not set — using Clearflow fixture for "${name}".`
    );
    return { ...FIXTURE_CLEARFLOW, niche };
  }

  // Some business names already contain a country/region suffix (e.g. "Gold
  // Electrical Services Australia") — re-appending suburb creates an over-long
  // query the matcher fails on. Build a stripped variant too.
  const stripped = name
    .replace(/[,\s]+(australia|au|aust|pty\s*ltd|pty|ltd|inc)\b\.?\s*$/i, "")
    .trim();
  const hasStripped = stripped.length > 0 && stripped !== name;

  // Use the suburb the user typed to scope the search. Works globally — no
  // hardcoded country assumptions.
  const variants = [
    suburb ? `${name} ${suburb}` : null,
    name,
    hasStripped && suburb ? `${stripped} ${suburb}` : null,
    hasStripped ? stripped : null,
    suburb ? `${name} ${niche} ${suburb}` : null,
  ].filter((q): q is string => q != null && q.length > 0);

  // Deduplicate while preserving order
  const queries = Array.from(new Set(variants));

  const attemptLog: string[] = [];

  for (const textQuery of queries) {
    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName",
      },
      body: JSON.stringify({ textQuery }),
    });

    const rawBody = await searchRes.text();
    if (!searchRes.ok) {
      throw new Error(
        `Places text search failed: ${searchRes.status} ${rawBody}`
      );
    }

    let parsed: { places?: Array<{ id: string; displayName?: { text?: string } }> };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new Error(`Places text search returned non-JSON: ${rawBody.slice(0, 200)}`);
    }

    const first = parsed.places?.[0];
    if (first?.id) {
      console.log(
        `[places-client] matched "${textQuery}" → ${first.displayName?.text ?? first.id}`
      );
      return fetchPlacesApiDetails(first.id, niche, apiKey);
    }

    attemptLog.push(`  "${textQuery}" → ${rawBody.slice(0, 160)}`);
  }

  // No Places match — business is likely not in Google's curated directory
  // (verified GBP). Synthesise a minimal GbpData from the form inputs so the
  // generator can still produce a site. The generator handles empty
  // reviews/services arrays gracefully.
  console.warn(
    `[places-client] No Google Places match for "${name}"${suburb ? ` in "${suburb}"` : ""}. Synthesising from form inputs. Variants tried:\n${attemptLog.join("\n")}`
  );
  return synthesiseGbpData(name, niche, suburb);
}

/**
 * Build a minimal GbpData from form inputs when Places has no match.
 * Parses "Sydney, NSW" / "Sydney NSW" / "London, UK" / "Toronto" into
 * suburb + state. State stays empty when the input is a single token.
 */
function synthesiseGbpData(name: string, niche: string, suburb?: string): GbpData {
  let suburbName = "";
  let state = "";
  if (suburb && suburb.trim()) {
    const cleaned = suburb.trim();
    const commaParts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
    if (commaParts.length >= 2) {
      suburbName = commaParts[0];
      state = commaParts[1];
    } else {
      const spaceParts = cleaned.split(/\s+/);
      const last = spaceParts[spaceParts.length - 1];
      // Treat a short uppercase trailing token as a state/region code
      if (spaceParts.length > 1 && last.length <= 3 && last === last.toUpperCase()) {
        state = last;
        suburbName = spaceParts.slice(0, -1).join(" ");
      } else {
        suburbName = cleaned;
      }
    }
  }

  const where = [suburbName, state].filter(Boolean).join(", ") || "the local area";
  return {
    name,
    niche,
    suburb: suburbName,
    state,
    phone: "",
    address: where,
    description: `${name} is a local ${niche} business serving ${where}.`,
    services: [],
    reviews: [],
  };
}

/* ----------------------------------------------------------------- internals */

interface PlacesApiPlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  editorialSummary?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
  }>;
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
  photos?: Array<{ name?: string; widthPx?: number; heightPx?: number }>;
}

async function fetchPlacesApiDetails(
  placeId: string,
  niche: string,
  apiKey: string
): Promise<GbpData> {
  const fields = [
    "displayName",
    "formattedAddress",
    "nationalPhoneNumber",
    "editorialSummary",
    "rating",
    "userRatingCount",
    "reviews",
    "addressComponents",
    "photos",
  ].join(",");

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields,
    },
  });

  if (!res.ok) {
    throw new Error(`Places API details failed: ${res.status} ${await res.text()}`);
  }

  const place = (await res.json()) as PlacesApiPlace;
  const data = mapToGbpData(place, niche);

  // Resolve up to 8 photo references to direct image URLs. The Places photo
  // endpoint returns a 302 redirect to a Google CDN URL — we follow it and
  // use the final URL so the browser doesn't need to handle the redirect.
  const photoRefs = (place.photos ?? []).slice(0, 8);
  if (photoRefs.length > 0) {
    data.photos = await resolvePhotoUrls(photoRefs, apiKey);
  }

  return data;
}

/**
 * Resolve Place photo references into direct CDN URLs.
 * Uses skipHttpRedirect=true so the API returns the URL as JSON instead of
 * redirecting — faster and avoids embedding our API key in the HTML.
 */
async function resolvePhotoUrls(
  photos: Array<{ name?: string; widthPx?: number; heightPx?: number }>,
  apiKey: string,
): Promise<string[]> {
  const results = await Promise.all(
    photos.map(async (p) => {
      if (!p.name) return null;
      const url = `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1600&maxHeightPx=1600&skipHttpRedirect=true`;
      try {
        const res = await fetch(url, { headers: { "X-Goog-Api-Key": apiKey } });
        if (!res.ok) {
          console.warn(`[places-client] photo resolve failed: ${res.status}`);
          return null;
        }
        const json = (await res.json()) as { photoUri?: string };
        return json.photoUri ?? null;
      } catch (err) {
        console.warn(`[places-client] photo resolve error:`, err);
        return null;
      }
    })
  );
  return results.filter((u): u is string => u != null);
}

function mapToGbpData(place: PlacesApiPlace, niche: string): GbpData {
  const name = place.displayName?.text ?? "Business";
  const address = place.formattedAddress ?? "";
  const phone = place.nationalPhoneNumber ?? "";
  const description =
    place.editorialSummary?.text ?? `${name} is a local ${niche} business serving the area.`;

  let suburb = "";
  let state = "";
  for (const comp of place.addressComponents ?? []) {
    const types = comp.types ?? [];
    if (types.includes("locality") || types.includes("sublocality_level_1")) {
      suburb = comp.longText ?? "";
    }
    if (types.includes("administrative_area_level_1")) {
      // Google returns the full state name (e.g. "Victoria"), we want abbreviation
      const full = comp.longText ?? "";
      state = AU_STATE_ABBR[full] ?? full;
    }
  }

  const reviews = (place.reviews ?? []).slice(0, 5).map((r) => ({
    author: r.authorAttribution?.displayName ?? "Customer",
    rating: r.rating ?? 5,
    text: r.text?.text ?? "",
  }));

  return {
    name,
    niche,
    suburb,
    state,
    phone,
    address,
    description,
    services: [],
    reviews,
    rating: typeof place.rating === "number" ? place.rating : undefined,
    reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : undefined,
  };
}

const AU_STATE_ABBR: Record<string, string> = {
  Victoria: "VIC",
  "New South Wales": "NSW",
  Queensland: "QLD",
  "South Australia": "SA",
  "Western Australia": "WA",
  Tasmania: "TAS",
  "Northern Territory": "NT",
  "Australian Capital Territory": "ACT",
};
