# Niche Analysis Methodology

For each new niche, produce a complete analysis following this exact structure. Output goes in `strategy/niches/[niche-slug]/analysis.md`. Update `strategy/_master/niches-master.csv` and append to `strategy/_master/decision-log.md` after each analysis.

## Phase 1: Market sizing
Estimate the number of businesses in this niche in Australia. Use ABS industry data, IBISWorld summaries, Yellow Pages and Google Maps counts as triangulation. Output: estimated_business_count, geographic_distribution (top 10 metro areas with share), growth_rate_estimate, addressable_subset (businesses likely to be reachable via Meta).

## Phase 2: Customer profile
Define the typical operator in this niche:
- Annual business revenue range
- Team size (sole trader / small team / established practice)
- Decision-maker (owner / manager / spouse / partner)
- Current digital sophistication (no site / Facebook only / old WordPress / has a real site)
- Average customer transaction value
- Customer lifetime value to the business
- Typical marketing budget per month
- Booking/inquiry cycle (immediate emergency / scheduled / consultation-led)

## Phase 3: Willingness to pay
Determine the price point that's a clear no-brainer relative to value delivered. Reference points:
- What they currently spend on marketing per month
- Their customer LTV
- What a single new customer per month justifies
- What competitors (Wix, Squarespace, agencies) charge in this niche
- Pricing anchoring in adjacent services (POS systems, booking tools, etc.)

Output three tier prices: entry, growth, scale. Justify each with reference to one or more of the above. Do NOT default to $29/$59/$99. Some niches support higher entry prices and signaling matters; some require lower entry to clear the no-brainer bar.

## Phase 4: Meta ads targeting viability
Build the Meta targeting spec:
- Job titles available in Meta interests (verify against the master list in `strategy/research/meta-job-titles.md`)
- Behavioural targeting (small business owners, business page admins, specific behaviours)
- Geographic targeting recommendation
- Lookalike seed audience strategy
- Estimated CPM range
- Estimated CTR for relevant creative angle

If Meta doesn't have clean targeting for this niche, flag as `meta_targeting_viable: false`. Some niches will be untargetable via Meta — they require different channels and should likely be skipped for v1.

## Phase 5: Category mapping and tuning
Map this niche to one of seven visual categories: trades, allied-health, beauty-aesthetics, professional-services, hospitality, fitness-wellness, retail-boutique. Justify the mapping.

Then specify the niche-specific tuning within that category:
- Colour emphasis adjustment (still within category palette)
- Critical sections that need prominence (e.g., "before/after" for cosmetic, "emergency" for plumbers, "menu" for hospitality, "qualifications" for medical)
- Trust signal priorities (licences, certifications, association memberships, insurance)
- Content tone shifts within category voice (more formal / more direct / warmer)
- Image style cues for stock library fallback
- Schema.org subtype

Do NOT recommend building a new template unless the niche genuinely doesn't fit any of the seven categories. If no category fits, flag as `category_required: new` with rationale.

Reference `/templates/` to verify what exists. If the niche's required category template doesn't yet exist or isn't yet a multi-page site system, flag that as a build dependency in the analysis output.

## Phase 6: Niche-specific upsells
Map which upsells fit:
- SEO module relevance (high for service businesses with local search demand; low for appointment-only practices that fill via word of mouth)
- LSA availability (LSA is restricted to specific verticals; verify against Google's current eligibility list)
- Review acquisition value (priority varies by niche)
- Niche-specific upsells (online booking integration for salons, patient portal for healthcare, menu management for hospitality, quote calculator for trades, etc.)

## Phase 7: Unit economics
Project:
- Estimated CAC (Meta CPL in this category × free→paid conversion rate)
- Estimated LTV (entry price × average tenure projected for this niche)
- LTV:CAC ratio (target 3:1 minimum; below 2:1 fails)
- Payback period in months
- Bear/base/bull sensitivity on CAC and churn

## Phase 8: Competitive landscape
Who already serves this niche?
- Niche-specific web builders if any exist
- Generic builders with niche presence (Durable, Wix, Squarespace)
- Local Australian agencies dominating this vertical
- Pricing benchmarks in market

Identify the angle that differentiates Preview Factory in this niche.

## Phase 9: Decision
GO / HOLD / SKIP with rationale. Update `niches-master.csv` with all key fields. Append one paragraph to `decision-log.md` with date and summary.

## Phase 10: Implementation priority
If GO: assign priority tier:
- Tier 1: launch in first 90 days
- Tier 2: post-validation, months 4-6
- Tier 3: future expansion, months 7+

Note any niche-specific build requirements (new template, new schema type, new upsell module, special compliance considerations).

## Output discipline
Every analysis follows this structure exactly. Do not skip phases. If data isn't available for a pha
