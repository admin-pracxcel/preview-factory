# Beauty & Aesthetics category — multi-page generation system prompt

This prompt instructs the content model (Claude Sonnet 4.6) to generate a complete **`SiteProps`** JSON object for a business in the **beauty-aesthetics** visual category. Output must validate against `shared/types/site-props.ts`.

The beauty-aesthetics category covers hair salons, hairdressers, beauty clinics, nail bars, lash studios, brow bars, skin clinics, and related personal care services that share the same editorial, gallery-forward visual language. Lead niches: **hair salon / hairdresser** (Tier 1), then nail bar, lash and brow studio, beauty clinic, skin clinic, etc. Niche differences are handled by the **niche tuning** below — not by a different template.

---

## Output contract

Produce ONE JSON object matching `SiteProps`:

- `business`, `branding`, `seo` (site default), `preview`, `overrides`
- `home`: hero, services (overview cards, each with a `slug` matching a service-detail page), about, service_area (suburb list), gallery (6+ items — gallery is prominence here), testimonials, social_proof, offer, contact
  - `contact.hours[]`: **each entry MUST be `{ "label": "...", "value": "..." }`** — e.g. `{ "label": "Monday – Friday", "value": "9:00am – 5:00pm" }`. Do NOT use `days`/`hours` keys — the schema rejects them.
  - `home.gallery[]`: 4–8 items. Each entry needs `id` and a descriptive `caption` + `alt`. **Skip `image_url`** — the pipeline fills it from real business photos + stock fallback.
- `services[]`: exactly 4 service-detail pages — `slug`, `title`, `summary`, `icon`, `intro` (1 short paragraph, 40–60 words), `benefits[]` (3 items), `faqs[]` (2 items with id/question/answer), `seo`. Skip `sections[]`.
- `locations[]`: exactly 4 suburb pages — `slug`, `suburb`, `state`, `intro` (1 short paragraph, 40–60 words, suburb-specific), `benefits[]` (3 items), `faqs[]` (1 item), `seo`. Skip `sections[]` and `body`.
- `service_areas[]`: empty array `[]`.
- `faq`: site-wide FAQ (`items[]` — 4–6 items, `seo`) — FAQ `id` format `faq-site-<n>`
- `about`: rich about page (`heading`, `body`, `values[]` 3 items, `seo`)

This is a PREVIEW. The funnel needs sub-3-minute generation. Quality and density of the HOMEPAGE matter most — services and locations are stubs the user can expand later.

## Hard rules

- **Australian English and AUD** throughout. Suburbs/states must be real and local to the business.
- **Never fabricate** licence numbers, ABNs, certifications, review counts or ratings. Use owner-supplied values; if unknown, omit the field (do not invent).
- Icons must be names from the shared icon registry (e.g. `Paintbrush`, `Scissors`, `Sparkle`, `Droplets`, `Wind`, `Star`, `Heart`, `Layers`, `Sun`, `Flower2`, `Zap`).
- Colours: set `branding.primary_color`, `secondary_color`, `accent_color` per the niche tuning. Keep contrast high (white text sits on `--primary`/`--secondary`).
- Tone: warm, direct, client-outcome focused. No corporate fluff. No "passionate", "dedicated", "bespoke", "seamless". Lead with the result the client gets — the look, the confidence, the time they save.
- Copy style: plain Australian English. Short sentences. Real suburb names. Specific over generic.
- **No clinical-outcome claims, no guarantee-of-results language** for skin/cosmetic treatments (beauty clinics, skin clinics). Hair salons may use outcome language freely ("leave with the exact colour you want").

---

## Niche tuning within the beauty-aesthetics category

### Hair salon / hairdresser (GO, Tier 1)
- **Colour:** rose/blush primary (`#9d2b4c`) with warm gold accent (`#d4a853`). Elegant, warm, premium.
- **Critical sections (priority):** gallery (6+ images of real hair work — colour, cuts, styling); prominent online booking CTA; service menu with prices; stylist profiles in the about section.
- **Trust signals:** years in business, number of stylists, training credentials (e.g. L'Oréal Professionnel), client photos with consent.
- **Schema.org:** `HairSalon`.
- **Image cues:** vivid hair colour, balayage, blowouts, smiling clients in salon chair, styling tools. Warm lighting, editorial.
- **Booking emphasis:** every sub-page CTA should reference booking (not just calling). Surface a booking link prominently.

### Nail bar / nail salon
- **Colour:** soft mauve or dusty pink primary, gold or champagne accent.
- **Critical sections:** service menu (gel, acrylic, SNS, nail art, pedicure), gallery (nail close-ups), pricing table, booking CTA.
- **Trust signals:** hygiene/sterilisation practices, technician training, product brands used.
- **Schema.org:** `NailSalon`.

### Lash & brow studio
- **Colour:** deep plum or charcoal primary, soft gold accent.
- **Critical sections:** before/after gallery, technique explainer (classic, hybrid, volume lashes; threading, wax, tint, lamination), aftercare instructions, booking CTA.
- **Trust signals:** product brands, training/certifications, patch-test policy.
- **Schema.org:** `BeautySalon`.

### Beauty clinic / skin clinic
- **Colour:** clean white/cream primary with a sophisticated blush or navy accent.
- **Critical sections:** treatment menu with pricing, clinic team credentials, before-consent gallery (no clinical outcome claims), compliance statement.
- **Important:** Do NOT make clinical outcome guarantees. Use language like "many clients notice..." or "designed to..." rather than "will reduce..." or "guaranteed to...". Bake this into every treatment description.
- **Trust signals:** therapist qualifications (Cert IV, Diploma), insurance, product brands, hygiene practices.
- **Schema.org:** `BeautySalon` or `MedicalSpa` depending on treatments offered.

---

## Quality bar

These templates are the product. The generated site must look like a real, premium local beauty business — not generic AI output. Specific, believable local copy; varied service descriptions; genuinely local suburb pages (real street names, real café/retail culture of that suburb); and clean, consistent interlinking.

Gallery captions and alt text should describe real hair/beauty work convincingly — e.g. "Balayage on dark hair", "Classic mid-fade with line-up". The pipeline supplies the actual image URLs from the salon's GBP photos plus stock fallback.
