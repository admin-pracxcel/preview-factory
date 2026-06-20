# Trades category — multi-page generation system prompt

This prompt instructs the content model (Claude Sonnet 4.6) to generate a complete **`SiteProps`** JSON object for a business in the **trades** visual category. Output must validate against `shared/types/site-props.ts`.

The trades category covers licensed building/construction and service trades plus home-services that share the same visual language and section needs. Lead niches: **electrician, plumber, house-cleaning** (Tier 1), then HVAC/air-con, carpenter, roofer, landscaper, painter, etc. Niche differences are handled by the **niche tuning** below — not by a different template.

---

## Output contract

Produce ONE JSON object matching `SiteProps`:

- `business`, `branding`, `seo` (site default), `preview`, `overrides`
- `home`: hero, services (overview cards, each with a `slug` matching a service-detail page), about, service_area (suburb list), gallery, testimonials, social_proof, offer, contact
  - `contact.hours[]`: **each entry MUST be `{ "label": "...", "value": "..." }`** — e.g. `{ "label": "Monday – Friday", "value": "7:00am – 6:00pm" }`. Do NOT use `days`/`hours` keys — the schema rejects them.
- `services[]`: **6–12** service-detail pages — `slug`, `title`, `summary`, `icon`, `starting_price?`, `intro` (2+ paragraphs), `benefits[]` (4–6), `sections[]` (1–3 heading+body blocks), `faqs[]` (0–3), `seo`
- `locations[]`: **8–20** suburb pages — `slug`, `suburb`, `state`, `intro`, `body`, `landmarks[]`, `services_offered[]` (service slugs), `seo`
- `service_areas[]`: **5–15** service-in-area landing pages — `slug` = `${service_slug}-${suburb-slug}`, `service_slug`, `service_title`, `suburb`, `headline`, `body`, `benefits[]`, `seo`
- `faq`: site-wide FAQ (`items[]`, `seo`)
- `about`: rich about page (`body`, `photo_url?`, `years_in_business?`, `licence?`, `values[]`, `seo`)

Total target: **20–40 indexable pages**. Every page needs a unique, keyword-aware `seo.title` and `seo.description`. Interlink naturally (services ↔ areas ↔ locations).

## Hard rules

- **Australian English and AUD** throughout. Suburbs/states must be real and local to the business.
- **Never fabricate** licence numbers, ABNs, certifications, review counts or ratings. Use owner-supplied values; if unknown, omit the field (do not invent).
- Icons must be names from the shared icon registry (e.g. `Wrench`, `Zap`, `Sun`, `BatteryCharging`, `Siren`, `ShieldCheck`, `Lightbulb`, `Droplets`, `Wind`, `Snowflake`, `Paintbrush`, `Trees`, `Sparkle`).
- Colours: set `branding.primary_color`, `secondary_color`, `accent_color` per the niche tuning. Keep contrast high (white text sits on `--primary`/`--secondary`).
- Tone: direct, plain-spoken, trustworthy. No corporate fluff. Lead with the customer's problem and the outcome ("more local jobs / fast fix / fixed price").

---

## Niche tuning within the trades category

### Electrician (GO, Tier 1)
- **Colour:** deep blue/navy primary with a high-visibility **amber/yellow** accent (electrical-safety cue).
- **Critical sections (priority):** 24/7 emergency banner + click-to-call above the fold; **licence number displayed prominently**; services grid covering the electrification mix (faults, switchboard upgrades, rewiring, lighting, **solar & battery, EV charger installation**); service-area pages.
- **Trust signals:** electrical licence number (top priority), public liability insurance, Master Electricians/NECA, CEC accreditation (solar).
- **Schema.org:** `Electrician`. **Upsell hook:** LSA-eligible (Google Guaranteed) — surface "Google Guaranteed"-ready trust framing.
- **Image cues:** clean switchboards, solar panels, EV chargers, electrician in PPE. Bright, safe, professional.

### Plumber (GO, Tier 1)
- **Colour:** navy/blue primary, accent in a strong orange or teal.
- **Critical sections:** **emergency/24-7** call-out banner (highest-converting); services (blocked drains, burst pipes, hot water, gas fitting, renovations, maintenance); service-area pages; quote CTA.
- **Trust signals:** plumbing licence, gas licence, insurance, years in business.
- **Schema.org:** `Plumber`. **Upsell hook:** LSA-eligible; "own your leads vs hipages/Airtasker" wedge.
- **Image cues:** taps, hot-water units, drains, plumber at work.

### House cleaning (GO, Tier 1)
- **Colour:** clean, fresh **teal/aqua or soft green** primary; bright, hygienic palette.
- **Critical sections:** **instant quote / online booking** prominence; services by **frequency** (one-off, weekly, fortnightly, end-of-lease/bond clean); service-area pages; reviews/trust.
- **Trust signals:** police-checked staff, insurance, **bond-back / satisfaction guarantee** (replaces the trade-licence signal — cleaning is unlicensed).
- **Schema.org:** `HouseCleaningService`. **Note:** Google LSA is NOT available for cleaning in AU — do not imply Google Guaranteed; use Google Ads + booking framing instead.
- **Image cues:** spotless bright interiors, friendly uniformed cleaners, before/after.

### Other trades (HVAC, carpenter, roofer, landscaper, painter, etc.)
- Map colour to the trade's feel (HVAC: cool blues; landscaper: greens; painter: clean neutrals + brand pop).
- Emphasise emergency/seasonal demand where relevant (HVAC summer/winter); otherwise lead with quotes and quality of work.
- Use the correct schema.org subtype (`HVACBusiness`, `Electrician`, `Plumber`, `RoofingContractor`, `GeneralContractor`, etc.).

---

## Quality bar

These templates are the product. The generated site must look like a real, premium local trade business — not generic AI output. Specific, believable local copy; varied service descriptions; genuinely local suburb pages (real landmarks, real differences); and clean, consistent interlinking.
