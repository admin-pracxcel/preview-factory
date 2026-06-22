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
 * Search for a business by name + niche using Places text search.
 * Falls back to the built-in fixture if GOOGLE_PLACES_API_KEY is not set.
 */
export async function fetchByName(name: string, niche: string): Promise<GbpData> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn(
      `[places-client] GOOGLE_PLACES_API_KEY not set — using Clearflow fixture for "${name}".`
    );
    return { ...FIXTURE_CLEARFLOW, niche };
  }

  // 1. Text search → first matching place ID
  const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({ textQuery: `${name} ${niche} Australia` }),
  });

  if (!searchRes.ok) {
    throw new Error(
      `Places text search failed: ${searchRes.status} ${await searchRes.text()}`
    );
  }

  const searchData = (await searchRes.json()) as { places?: Array<{ id: string }> };
  const placeId = searchData.places?.[0]?.id;
  if (!placeId) {
    throw new Error(`No Google Places results for "${name} ${niche}"`);
  }

  // 2. Fetch details for that place
  return fetchPlacesApiDetails(placeId, niche, apiKey);
}

/* ----------------------------------------------------------------- internals */

interface PlacesApiPlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  editorialSummary?: { text?: string };
  reviews?: Array<{
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
  }>;
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
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
    "reviews",
    "addressComponents",
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
  return mapToGbpData(place, niche);
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

  return { name, niche, suburb, state, phone, address, description, services: [], reviews };
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
