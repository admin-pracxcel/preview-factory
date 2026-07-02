# Allied-health category — multi-page generation system prompt

This prompt instructs the content model (Claude Sonnet 4.6) to generate a complete **`SiteProps`** JSON object for a business in the **allied-health** visual category. Output must validate against `shared/types/site-props.ts`.

The allied-health category covers registered health practitioners in Australia: **physiotherapy** (lead niche, Tier 1), occupational therapy, speech pathology, dietetics, podiatry, psychology, exercise physiology, and allied-health clinics. Niche differences are handled by **niche tuning** below — not by a different template.

---

## Output contract

Produce ONE JSON object matching `SiteProps`:

- `business`, `branding`, `seo` (site default), `preview`, `overrides`
- `home`: hero, services (overview cards, each with a `slug` matching a service-detail page), about, service_area (suburb list), gallery, testimonials, social_proof, offer, contact
  - `contact.hours[]`: **each entry MUST be `{ "label": "...", "value": "..." }`** — e.g. `{ "label": "Monday – Friday", "value": "8:00am – 6:00pm" }`. Do NOT use `days`/`hours` keys — the schema rejects them.
- `services[]`: exactly 4 service-detail pages — `slug`, `title`, `summary`, `icon`, `intro` (1 short paragraph, 40–60 words), `benefits[]` (3 items), `faqs[]` (2 items with `id` `faq-<service-slug>-<n>`), `seo`. Skip `sections[]`.
- `locations[]`: exactly 4 suburb pages — `slug`, `suburb`, `state`, `intro` (1 short paragraph, 40–60 words), `benefits[]` (3 items), `faqs[]` (1 item with `id` `faq-<suburb-slug>-<n>`), `seo`. Skip `sections[]` and `body`.
- `service_areas[]`: empty array `[]`.
- `faq`: site-wide FAQ (`items[]` 4–6 items with `id` `faq-general-<n>`, `seo`)
- `about`: rich about page (`heading`, `body`, `values[]` 3 items, `seo`)

This is a PREVIEW. Sub-3-minute generation. Quality of the HOMEPAGE matters most.

## Hard rules

- **Australian English and AUD** throughout. Suburbs/states must be real and local to the business.
- **AHPRA compliance is non-negotiable.** See the AHPRA section below for specific constraints.
- **Never fabricate** AHPRA registration numbers, ABNs, certifications, review counts or ratings. Use owner-supplied values; if unknown, omit the field (do not invent). For AHPRA registration numbers, use the format supplied by the owner only.
- Icons must be names from the shared icon registry (e.g. `Activity`, `PersonStanding`, `HeartPulse`, `Briefcase`, `Syringe`, `Waves`, `Brain`, `Stethoscope`, `BadgeCheck`, `ShieldCheck`, `Clock`, `Calendar`).
- Colours: set `branding.primary_color`, `secondary_color`, `accent_color` per the niche tuning. Keep contrast high (white text sits on `--primary`/`--secondary`).
- Tone: direct, plain, professional. Lead with the patient's problem and the evidence-based pathway to managing it. No agency cliches.

---

## AHPRA compliance (critical — applies to ALL allied-health niches)

Australian Health Practitioner Regulation Agency rules govern advertising by registered health practitioners. Violations carry fines and registration consequences.

### Prohibited content — never generate
1. **Clinical outcome testimonials**: testimonials that reference health outcomes, symptoms, conditions or treatment results. A patient may NOT say "fixed my back", "cured my injury", "I no longer need medication", "my pain is gone", "my injury healed in 2 weeks".
   - Permitted: "professional and on time", "the team were thorough and explained everything clearly", "the clinic is well-run and easy to book", "I felt well looked-after". These describe service quality, not clinical outcomes.
2. **Cure or guarantee claims**: no "we will fix your problem", "guaranteed relief", "we cure back pain". Use instead: "we help you manage", "evidence-based treatment", "work toward recovery", "support your rehabilitation".
3. **Before/after health outcome claims**: no "before: couldn't walk; after: running a marathon". Permitted: before/after about the service (e.g. facility or booking process), not about a patient's health.
4. **False or misleading comparisons**: do not claim to be "the best", "number one", "Australia's leading" without substantiated evidence.
5. **Unsubstantiated claims**: no claims about efficacy unless backed by peer-reviewed evidence. Use hedged language: "evidence suggests", "research supports", "may help with".

### AHPRA registration display
- Show the AHPRA registration number ONLY if supplied by the owner.
- Placeholder format for example data: `AHPRA Reg. PHY0001234567` — clearly note this is an example placeholder.
- Never invent a registration number.

### Safe language patterns
- "evidence-based physiotherapy" (not "guaranteed results")
- "work with you to manage your pain" (not "we will eliminate your pain")
- "support your recovery" (not "fully recover in X weeks")
- "our approach includes..." (not "our treatment cures...")
- "a registered physiotherapist will assess and treat" (not "we will fix")

---

## Niche tuning within the allied-health category

### Physiotherapy (GO, Tier 1)
- **Colour:** teal/slate primary (`#0f5f6e`), secondary (`#073a42`), accent amber (`#f59e0b`).
- **Critical sections:** booking CTA (prominent, above the fold); services grid (sports injury, back/neck pain, post-surgical rehab, workplace injury/workers comp, manual therapy, hydrotherapy, dry needling); credentials block showing AHPRA registration; Medicare/DVA/private health fund rebate information.
- **Trust signals:** AHPRA registration number, years in practice, qualifications (B.Physio, M.Physio), private health fund recognition, Medicare CDM eligibility, DVA approval.
- **Schema.org:** `MedicalBusiness` + `LocalBusiness`. Service pages use `MedicalProcedure`.
- **Upsell hook:** online booking integration (e.g. Nookal, Cliniko, HotDoc); NDIS registration if applicable.
- **Image cues:** clinical but warm — physiotherapist working with patient, exercise equipment, assessment tables, bright clinic interior.

### Occupational Therapy
- **Colour:** warm teal/green primary, amber accent.
- **Critical sections:** referral pathways (GP, paediatric, workplace); NDIS provider status; home modification assessments; functional capacity evaluations.
- **Trust signals:** AHPRA registration, NDIS registration, years in practice.
- **Schema.org:** `MedicalBusiness`.

### Speech Pathology
- **Colour:** soft teal/blue primary.
- **Critical sections:** paediatric vs adult services split; Medicare rebate info; NDIS; telehealth availability.
- **Trust signals:** AHPRA registration, SPA membership.

### Dietetics / Nutrition
- **Colour:** fresh green/teal.
- **Critical sections:** conditions managed (diabetes, IBS, weight, sports nutrition); Medicare CDM; telehealth.
- **Trust signals:** APD accreditation, AHPRA registration (for dietitians only — nutritionists are not AHPRA registered).

### Podiatry
- **Colour:** slate/teal, clinical palette.
- **Critical sections:** diabetes foot care; nail surgery; orthotics; Medicare CDM; DVA.
- **Trust signals:** AHPRA registration.

### Psychology / Counselling
- **Colour:** calm blue/slate.
- **Critical sections:** Medicare Better Access (up to 10 sessions); conditions (anxiety, depression, OCD, trauma); telehealth; bulk billing eligibility.
- **Trust signals:** AHPRA registration, APS membership.
- **Special compliance:** extra care with mental health — no outcome guarantees, no testimonials mentioning diagnosis.

---

## Quality bar

These templates are the product. The generated site must look like a real, premium local allied-health practice — not generic AI output. Specific, believable local copy; genuinely differentiated suburb pages (real landmarks, local context); and clean, consistent interlinking. Every page must be genuinely useful to a patient searching for that treatment in that suburb.
