# Meta Ads Targeting Universe — Australian Small-Service Businesses

**Purpose:** Master reference for Phase 4 (Meta ads targeting viability) of every niche analysis. This file defines the universe of job titles, interests, and behaviours available in Meta Ads Manager that can plausibly reach Australian owner-operators of small service businesses. Every niche analysis verifies its targeting spec against this list.

**Last researched:** 19 June 2026. Meta's targeting taxonomy changes frequently and without notice — re-verify any segment in live Ads Manager before committing budget.

---

## ⚠️ Read this before using the lists below

Three things make Meta targeting for this business fundamentally different from how it's usually imagined:

**1. We are doing B2B targeting on a consumer platform.** We want to reach the *owner* of a plumbing business, not homeowners who need a plumber. Meta is built for the latter. Almost every "interest" below (e.g. *Plumbing*, *Hairdresser*, *Café*) reaches **consumers interested in the topic AND practitioners mixed together** — it does not isolate business owners. To isolate owners you must **layer a behavioural segment** (see "The behavioural layer" — this is the workhorse for our model, not the job titles).

**2. Job-title targeting is self-reported and heavily degraded.** Facebook job titles come from what users typed in their profile years ago, with no verification. Meta purged thousands of options after the 2017 ProPublica scandal, removed sensitive segments in 2021–22, and deprecated a large tranche of low-usage/redundant detailed-targeting options on **15 January 2024** (enforced 18 March 2024). **Detailed-targeting exclusions were phased out across 2024** (final stage 31 January 2025) — you can no longer *exclude* by detailed targeting. For most blue-collar and small-service occupations in a market the size of Australia (~26.5M people), a specific job title like "Plumber" or "Dental hygienist" returns a **small, stale, or non-existent audience.** Treat job titles as a bonus, never the spine of an audience.

**3. Meta is actively pushing advertisers off manual targeting.** The platform now favours **Advantage+ audiences** and broad targeting, letting its ML find converters from a seed. For our niches the most durable strategy is **lookalikes from our own customer/lead lists + behavioural layer + broad geo**, with interests/job titles used only as an optional narrowing signal or lookalike seed.

### Reliability flags used below
- 🟢 **Reliable** — broad topic/industry interest or behavioural segment that almost certainly clears a usable audience size in AU (our working bar: ~50K+). Usually a *topic* interest (mixes consumers + pros) or a platform-maintained behaviour.
- 🟡 **Sparse** — exists but likely thin in AU, stale, or inconsistent. Usable only as a lookalike seed or stacked with other signals. Most *occupation job titles* fall here.
- 🔴 **Unreliable / likely unavailable** — frequently deprecated, sub-threshold, or never well-populated for AU. Do not build an audience on this alone.

> **Hard caveat on numbers:** Exact AU audience sizes are visible *only inside live Ads Manager* and shift constantly. I have **not** fabricated specific counts. Flags below are evidence-based judgements from Meta's documented behaviour and the self-reported nature of the data, **not** confirmed AU figures. **Before any niche goes GO, the analyst must open Ads Manager, set location = Australia, and record the actual displayed range.**

---

## The behavioural layer (use on almost every niche)

These are the segments that actually let us find *business owners*. They are platform-maintained (not free-text self-report), so they are far more reliable than occupation job titles. Stack one of these **with** a topic interest and tight geo to approximate "owner of a [niche] business in [suburb]."

| Segment | Path in Ads Manager | Reliability | Notes |
|---|---|---|---|
| **Small business owners** | Behaviors → (Digital activities / B2B) | 🟢 Reliable | The single most useful segment for us. Reported/modelled small-business owners. Broad — narrow with a topic interest + geo. |
| **Business decision-makers** | Demographics → Work → Industries | 🟢 Reliable | Decision-makers across engineering/IT, operations, HR, strategy, marketing, by job title. Broad but sizable. |
| **Business decision-maker titles and interests** | Demographics → Work → Industries | 🟢 Reliable | Industry-agnostic decision-makers by title + interests. Overlaps almost entirely with the above. |
| **IT decision-makers** | Demographics → Work → Industries | 🟡 Sparse (for us) | Narrow; irrelevant to most of our trades/service niches. |
| **New active business admins — <6 months** | Behaviors → Digital activities | 🟢 Reliable | Admins of Pages for businesses created in the last 6 months. Worldwide pool is large; shrinks with AU geo but still usable. Excellent for "just started, needs a website." |
| **New active business admins — <12 months** | Behaviors → Digital activities | 🟢 Reliable | As above, 12-month window. |
| **New active business admins — <24 months** | Behaviors → Digital activities | 🟢 Reliable | As above, 24-month window — largest of the three. |
| **Facebook Page admins** | Behaviors → Digital activities | 🟢 Reliable | People who admin a Page. Strong proxy for "runs a business with a FB presence" — directly matches our ICP (has GBP/FB, weak/no website). |
| **Engaged Shoppers** | Behaviors → Purchase behavior | 🟢 Reliable | Clicked a CTA recently. Not owner-specific but useful as a responsiveness layer. |
| **Technology early adopters** | Behaviors | 🟡 Sparse (for us) | Tangential; could correlate with willingness to adopt a SaaS site tool. |

**Custom & lookalike audiences (not "interests" but the highest-value targeting we have):**
- 🟢 **Customer-list Custom Audiences** — upload paying customers / trial signups (email, phone). Foundational once we have volume.
- 🟢 **Lookalike Audiences (AU 1–3%)** — seed from converters or a niche customer list. **This is the recommended spine** once any niche has ~100+ conversions; it sidesteps the unreliable job-title problem entirely.
- 🟢 **Website / pixel & engagement Custom Audiences** — retarget preview viewers, video viewers, lead-form openers, Page/IG engagers.

---

## Category 1 — Trades (construction & building)

Owner-operators, sole traders, small crews. **Reality:** occupation job titles here are the *weakest* in Meta — overwhelmingly self-reported, AU-thin, many deprecated. Topic interests are broad but mix in DIY consumers. **Always** stack with *Small business owners* / *New active business admins* + tight geo, or use lookalikes.

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Plumber / Plumbing | Interest (topic) | 🟢 Reliable (topic) | Mostly consumers + supply brands; layer behaviour to isolate owners. |
| Electrician / Electrical contractor | Interest (topic) | 🟢 Reliable (topic) | Same caveat. "Electrician" as job title 🟡. |
| Carpenter / Carpentry | Interest | 🟡 Sparse | Topic interest thin; job title sparse. |
| Builder / Construction / General contractor | Interest (topic) | 🟢 Reliable (topic) | Large topic audience; very mixed. |
| Tiler / Tiling | Interest | 🔴 Unreliable | Rarely a populated AU segment. |
| Painter / House painting | Interest | 🟡 Sparse | "Painting" interest is dominated by art, not the trade. |
| Plasterer / Rendering | Interest | 🔴 Unreliable | Effectively absent. |
| Roofer / Roofing | Interest | 🟡 Sparse | Topic exists; thin in AU. |
| Bricklayer / Concreter / Landscaper (hardscape) | Interest | 🔴 Unreliable | Use behaviour + geo only. |
| HVAC / Air conditioning installation | Interest | 🟡 Sparse | "Air conditioning" mixes appliance shoppers. |
| Welder / Fabrication | Interest | 🟡 Sparse | Hobbyist-heavy. |
| Cabinetmaker / Joinery | Interest | 🔴 Unreliable | Niche, thin. |
| Glazier / Fencing / Decking | Interest | 🔴 Unreliable | Not viable alone. |

**Category verdict:** Job titles 🔴/🟡. Topic interests 🟢 but contaminated by consumers. **Target via behaviour (Small business owners + New active business admins) + geo + lookalikes; use trade interests only as a secondary narrowing or lookalike seed.**

---

## Category 2 — Health & allied health

Mix of registered practitioners (often higher digital sophistication, may already have a site) and small independent clinics. Meta **removed health-related sensitive targeting**, so *condition-based* interests are gone; *profession* interests partly remain.

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Physiotherapy / Physiotherapist | Interest | 🟢 Reliable (topic) | Strong AU topic interest; mixes patients + practitioners. |
| Chiropractic / Chiropractor | Interest | 🟢 Reliable (topic) | Well-populated topic. |
| Dentistry / Dentist | Interest | 🟢 Reliable (topic) | Large topic audience. |
| Dental hygienist | Job title | 🟡 Sparse | Employee role, rarely the buyer; thin. |
| Podiatry / Podiatrist | Interest | 🟡 Sparse | Smaller topic. |
| Optometry / Optometrist | Interest | 🟡 Sparse | Topic thin; often corporate-owned. |
| Psychology / Psychologist / Counselling | Interest | 🟡 Sparse | Sensitive-adjacent; inconsistent. |
| Speech pathology / Occupational therapy | Interest | 🔴 Unreliable | Rarely populated in AU. |
| Dietitian / Nutritionist | Interest | 🟢 Reliable (topic) | "Nutrition" is huge but consumer-dominated. |
| Massage therapy / Remedial massage | Interest | 🟢 Reliable (topic) | Big topic; consumer-heavy. |
| Acupuncture / Naturopathy | Interest | 🟡 Sparse | Topic exists; thin. |
| General practitioner / Medical clinic | Interest | 🟡 Sparse | Mostly corporate; sensitive constraints. |

**Category verdict:** Topic interests for the bigger modalities (physio, chiro, dental, massage, nutrition) are 🟢 but patient-heavy. Practitioner job titles 🟡. **Layer Small business owners / Business decision-makers + geo; lookalikes from clinic-owner leads strongly preferred.** Note higher baseline digital sophistication → position on quality, not "you have no site."

---

## Category 3 — Beauty & aesthetics

Strong fit for Meta — heavily visual, owner is usually the operator and an active social user. Topic interests are large and beauty-engaged audiences skew toward the practitioners' world more than most trades.

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Hairdresser / Hair stylist / Hair salon | Interest | 🟢 Reliable (topic) | Large, highly engaged AU audience. |
| Barber / Barbershop | Interest | 🟢 Reliable (topic) | Strong, growing. |
| Beautician / Beauty salon | Interest | 🟢 Reliable (topic) | Large. |
| Nail technician / Nail salon / Manicure | Interest | 🟢 Reliable (topic) | Large, visual. |
| Cosmetology / Esthetician | Interest | 🟡 Sparse | US-centric terms; weaker in AU. |
| Makeup artist | Interest | 🟢 Reliable (topic) | Large; mixes hobbyists. |
| Eyelash extensions / Lash tech / Brows | Interest | 🟢 Reliable (topic) | Strong, trend-driven. |
| Spray tanning / Waxing | Interest | 🟡 Sparse | Thinner. |
| Cosmetic injectables / Dermal fillers / Botox | Interest | 🟡 Sparse | Sensitive-adjacent; ad-policy scrutiny on creative. |
| Laser hair removal / Skin clinic | Interest | 🟡 Sparse | Topic exists; policy-sensitive. |
| Day spa / Massage (beauty) | Interest | 🟢 Reliable (topic) | Large. |

**Category verdict:** Best-fit category for Meta. Topic interests 🟢 and the audience is unusually owner-adjacent (beauty pros follow beauty topics). **Stack with Small business owners + New active business admins + suburb geo.** Watch ad-policy constraints on injectables/skin-clinic creative.

---

## Category 4 — Hospitality

Owner runs the venue; often time-poor, low-margin (entry-price sensitive per business context). Topic interests are massive but almost entirely consumer (diners), so the behavioural layer is essential here.

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Café / Coffeehouse | Interest | 🟢 Reliable (topic) | Enormous — but ~all consumers. Useless without behaviour layer. |
| Restaurant / Restaurateur | Interest | 🟢 Reliable (topic) | Same caveat. "Restaurateur" job title 🟡. |
| Chef / Cook | Job title/Interest | 🟡 Sparse | "Chef" partly populated; many hobby cooks. |
| Bar / Pub / Bartending | Interest | 🟢 Reliable (topic) | Consumer-heavy. |
| Catering / Caterer | Interest | 🟡 Sparse | More owner-aligned than "restaurant," but thinner. |
| Food truck | Interest | 🟡 Sparse | Niche; enthusiast-heavy. |
| Bakery / Baker / Patisserie | Interest | 🟢 Reliable (topic) | Large; consumer-heavy. |
| Takeaway / Fast food | Interest | 🟢 Reliable (topic) | Consumer. |
| Winery / Brewery / Cellar door | Interest | 🟡 Sparse | Consumer + tourism. |

**Category verdict:** Topic interests 🟢 but the most consumer-contaminated of any category. **Behaviour layer (Small business owners / Page admins / New active business admins) + geo is mandatory; lookalikes from hospitality-owner leads strongly preferred.** Low margins → entry pricing must be a no-brainer.

---

## Category 5 — Professional services

Higher digital sophistication; many already have decent sites. The B2B decision-maker segments are most relevant here, but ROI for *our* product is weaker (they often don't need us).

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Accountant / Accounting / Bookkeeper | Interest/Job title | 🟢 Reliable (topic) | Topic large; "Bookkeeper" job title 🟡. |
| Tax agent / BAS agent | Interest | 🔴 Unreliable | AU-specific term, thin. |
| Lawyer / Solicitor / Legal services | Interest | 🟢 Reliable (topic) | Large topic; mixed. |
| Conveyancer | Interest | 🔴 Unreliable | AU niche, near-absent. |
| Mortgage broker / Finance broker | Interest | 🟡 Sparse | Credit-adjacent → Special Ad Category risk if creative promotes credit. |
| Financial adviser / planner | Interest | 🟡 Sparse | Credit/finance scrutiny. |
| Insurance broker | Interest | 🟡 Sparse | Thin. |
| Consultant / Business consultant | Job title/Interest | 🟡 Sparse | Vague; large but meaningless. |
| Marketing / Advertising agency | Interest | 🟢 Reliable (topic) | Large; competitors, not customers. |
| Architect / Draftsperson | Interest | 🟡 Sparse | Topic mixes design enthusiasts. |
| Surveyor / Town planner | Interest | 🔴 Unreliable | Near-absent. |

**Category verdict:** Use **Business decision-makers / Business decision-maker titles and interests** + topic interest + geo. Flag that finance/credit/insurance creative can trip **Special Ad Category (Credit)** restrictions, which *strip detailed targeting*. Lower product-fit overall.

---

## Category 6 — Retail (independent / bricks-and-mortar)

Owner-operated shops. Meta's *Engaged Shoppers* and *Small business owners* behaviours matter more than any retail job title.

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Retail / Retailer / Shopkeeper | Interest | 🟡 Sparse | Vague; consumer-shopping interests dominate. |
| Boutique / Fashion retail | Interest | 🟢 Reliable (topic) | Large; consumer. |
| Florist / Flower shop | Interest | 🟢 Reliable (topic) | Strong, visual, owner-adjacent. |
| Butcher / Greengrocer / Deli | Interest | 🟡 Sparse | Thin. |
| Bookshop / Gift shop / Homewares | Interest | 🟡 Sparse | Consumer-heavy. |
| Jeweller / Jewellery store | Interest | 🟢 Reliable (topic) | Large; consumer. |
| Bottle shop / Liquor store | Interest | 🟡 Sparse | Alcohol ad-policy constraints. |
| Newsagent / Convenience store | Interest | 🔴 Unreliable | Near-absent. |

**Category verdict:** Job titles 🟡/🔴. **Lean on Small business owners + Engaged shoppers + New active business admins + geo.** Florist is the standout owner-adjacent topic.

---

## Category 7 — Automotive

Owner-operated workshops, detailers, mobile mechanics. Strong consumer overlap with car enthusiasts.

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Mechanic / Auto repair / Car service | Interest | 🟢 Reliable (topic) | Large; enthusiast + consumer heavy. |
| Auto electrician | Interest | 🔴 Unreliable | AU term, thin. |
| Panel beater / Smash repair / Crash repair | Interest | 🔴 Unreliable | AU terms, near-absent. |
| Car detailing / Auto detailing | Interest | 🟢 Reliable (topic) | Strong, visual, owner-adjacent (enthusiast crossover). |
| Tyre fitting / Wheel alignment | Interest | 🟡 Sparse | Thin. |
| Car wash | Interest | 🟡 Sparse | Mixed. |
| Mobile mechanic | Interest | 🟡 Sparse | Growing but thin. |
| Windscreen / Auto glass | Interest | 🔴 Unreliable | Near-absent. |
| Motorcycle / Marine / Small engine repair | Interest | 🟡 Sparse | Enthusiast-heavy. |

**Category verdict:** Topic interests 🟢 (mechanic, detailing) but enthusiast-contaminated. **Behaviour + geo; lookalikes preferred.**

---

## Category 8 — Fitness

Owner-operators, PTs, studio owners. Highly social, visual, Meta-native — good fit, but "fitness" interests are gigantic and consumer-dominated.

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Personal trainer / Personal training | Interest/Job title | 🟢 Reliable (topic) | Large; "Personal trainer" job title more owner-aligned than most — 🟡. |
| Gym / Fitness centre | Interest | 🟢 Reliable (topic) | Enormous; consumer. |
| Yoga / Yoga instructor | Interest | 🟢 Reliable (topic) | Huge; consumer + teachers. |
| Pilates / Reformer Pilates | Interest | 🟢 Reliable (topic) | Strong, trending in AU. |
| CrossFit / Functional fitness | Interest | 🟢 Reliable (topic) | Strong community. |
| Martial arts / Boxing / BJJ | Interest | 🟢 Reliable (topic) | Large. |
| Dance studio | Interest | 🟡 Sparse | Mixed. |
| Swim school / Swimming lessons | Interest | 🟡 Sparse | Parent-targeted, thin as owner signal. |
| Nutrition coach / Online coach | Interest | 🟡 Sparse | Vague. |

**Category verdict:** Topic interests 🟢, owner-adjacency moderate (PTs/instructors do follow these). **Stack Small business owners + topic + geo.** Good Meta fit visually.

---

## Category 9 — Education (private / independent)

Tutors, driving instructors, music teachers, small RTOs. Fragmented; mostly sole traders.

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Tutor / Tutoring / Private tuition | Interest | 🟡 Sparse | Topic exists; parent-targeted more than owner. |
| Driving instructor / Driving school | Interest | 🟡 Sparse | Thin but specific. |
| Music teacher / Music school / Piano lessons | Interest | 🟡 Sparse | Mixed. |
| Dance / Performing arts school | Interest | 🟡 Sparse | See fitness. |
| Childcare / Early learning / Preschool | Interest | 🟡 Sparse | Parent-heavy; compliance-sensitive (minors). |
| Language school / ESL | Interest | 🔴 Unreliable | Thin. |
| Registered Training Organisation (RTO) / VET | Interest | 🔴 Unreliable | AU-specific, near-absent. |
| First aid / Trade short courses | Interest | 🔴 Unreliable | Thin. |

**Category verdict:** Weak for job-title/interest precision. **Behaviour (Small business owners) + geo + lookalikes only.** Many of these reach the *parent customer* not the *owner* — beware audience inversion.

---

## Category 10 — Pet services

Owner-operated, highly visual, Meta-native (pet content performs). Topic interests are huge but pet-owner-consumer dominated.

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Dog grooming / Pet grooming | Interest | 🟢 Reliable (topic) | Large; mixes pet owners. |
| Dog walking / Dog walker | Interest | 🟡 Sparse | Thin. |
| Pet sitting / Boarding / Kennels / Cattery | Interest | 🟡 Sparse | Thin. |
| Dog training / Dog trainer | Interest | 🟢 Reliable (topic) | Large; consumer-heavy. |
| Veterinary / Vet clinic | Interest | 🟢 Reliable (topic) | Large; corporate consolidation reduces SMB fit. |
| Pet shop / Pet supplies | Interest | 🟢 Reliable (topic) | Consumer. |
| Mobile dog wash | Interest | 🔴 Unreliable | AU niche, thin. |

**Category verdict:** Topic interests 🟢 but pet-owner-contaminated. **Behaviour + geo; lookalikes preferred.** Grooming and training are the better owner-adjacent topics.

---

## Category 11 — Home services (non-trade)

Cleaning, maintenance, and outdoor services — often sole traders or small crews. Among the better fits for our product (low digital sophistication, clear "more local calls" outcome).

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Cleaning / House cleaning / Commercial cleaning | Interest | 🟢 Reliable (topic) | Large; consumer + franchise. |
| End-of-lease / Bond cleaning | Interest | 🔴 Unreliable | AU term, thin. |
| Carpet cleaning | Interest | 🟡 Sparse | Mixed. |
| Gardening / Lawn care / Lawn mowing | Interest | 🟢 Reliable (topic) | Large; hobby gardeners dominate. |
| Landscaping / Landscape design | Interest | 🟢 Reliable (topic) | Large; consumer crossover. |
| Pest control | Interest | 🟡 Sparse | Specific; thinnish. |
| Pool cleaning / Pool maintenance | Interest | 🟡 Sparse | Pool-owner consumers dominate. |
| Removalist / Moving company | Interest | 🟡 Sparse | Consumer-intent ("moving house"). |
| Handyman / Property maintenance | Interest | 🟡 Sparse | Vague; DIY crossover. |
| Window cleaning / Pressure washing | Interest | 🔴 Unreliable | Thin. |
| Solar installation / Solar panels | Interest | 🟢 Reliable (topic) | Large but consumer-buyer dominated; energy ad policy. |
| Security / CCTV / Locksmith | Interest | 🟡 Sparse | Mixed. |

**Category verdict:** Topic interests 🟢/🟡, heavily consumer-contaminated. **Behaviour (Small business owners + New active business admins) + suburb geo is the spine; interests narrow only.** Strong product-fit niche group overall.

---

## Category 12 — Real estate

Agents, property managers, buyer's agents. **Compliance flag:** ads *promoting housing* fall under Meta's **Special Ad Category (Housing)**, which **removes most detailed targeting** (age/gender/detailed restricted). Our ads sell *websites to agents* (B2B), so they should not be Housing category — but anyone running the *agent's* property listings later will hit this. Document clearly per analysis.

| Job title / Interest | Type | Reliability | Notes |
|---|---|---|---|
| Real estate / Real estate agent | Interest | 🟢 Reliable (topic) | Large; mixes buyers/sellers + agents. |
| Property management / Property manager | Interest | 🟡 Sparse | Owner-adjacent but thin. |
| Buyer's agent / Buyers advocate | Interest | 🔴 Unreliable | AU niche, near-absent. |
| Mortgage broker | Interest | 🟡 Sparse | See professional services (Credit category risk). |
| Property developer | Interest | 🟡 Sparse | Mixed with investors. |
| Auctioneer | Interest | 🔴 Unreliable | Near-absent. |

**Category verdict:** Use **Business decision-makers + Small business owners + "Real estate" interest + geo.** Flag Special Ad Category (Housing/Credit) on downstream listing/finance creative. Agents often already have brand-mandated franchise sites → product-fit caveat.

---

## Category 13 — Other niches identified

Niches that don't fit cleanly above but appear in the AU small-service landscape:

| Niche | Best targeting route | Reliability | Notes |
|---|---|---|---|
| **Photographers / Videographers** (wedding, family, real estate) | "Photography" interest 🟢 + Small business owners + geo | 🟢 topic / 🟡 owner | Huge topic, hobbyist-dominated; lookalikes essential. Visual, Meta-native. |
| **Event & wedding planners** | "Wedding planning" interest 🟢 + behaviour | 🟡 | Consumer (engaged couples) contaminates heavily. |
| **Celebrants / DJs / Entertainers** | Interest 🟡 + Small business owners | 🟡 | Thin; behaviour-led. |
| **Trades-adjacent: tow trucks, scrap, skip bins** | Interest 🔴 | 🔴 | Near-absent; geo + behaviour only. |
| **Funeral services** | Interest 🟡 | 🔴 | Sensitive; ad-policy + audience constraints. |
| **Childcare / nannies / babysitting** | Interest 🟡 | 🟡 | Minors compliance; parent-targeted. |
| **Travel agents / tour operators** | "Travel agency" interest 🟢 | 🟢 topic / 🟡 owner | Consumer-traveller dominated. |
| **Trades supply / B2B wholesalers** | Business decision-makers 🟢 | 🟢 | B2B segments fit better here than consumer interests. |
| **Allied trades: signage, printing, upholstery** | Interest 🔴 | 🔴 | Behaviour + geo only. |

---

## Recommended targeting recipe for Preview Factory (all niches)

Because job titles are weak and most interests are consumer-contaminated, the **default audience architecture** for any niche should be:

1. **Spine (pick one):**
   - *Lookalike (AU 1–3%)* from converters/customer list — **preferred once we have seed volume**, or
   - *Behavioural*: **Small business owners** OR **New active business admins (<12/<24 mo)** OR **Facebook Page admins**.
2. **Narrowing layer (optional):** the niche's 🟢 topic interest (e.g. *Hairdresser*, *Café*, *Plumbing*) to bias toward the vertical — accepting it also pulls consumers.
3. **Geo:** metro/regional postcode clusters per business context (suburb-level where audience size allows).
4. **Creative as the real filter:** since audiences are imprecise, the *ad creative* (e.g. "Get more local jobs for your plumbing business") does the qualifying that targeting can't. Budget accordingly.
5. **Advantage+ test in parallel:** run a broad/Advantage+ audience against the manual stack; Meta's ML often wins for low-consideration SMB offers.

**Niches to flag `meta_targeting_viable: false` candidates:** any in the 🔴-dominant rows above (e.g. conveyancers, RTOs, panel beaters, signage) where neither a usable interest nor a strong behavioural proxy exists — these depend almost entirely on broad geo + creative + lookalikes and should be deprioritised for v1 unless a customer-list lookalike exists.

---

## Limitations & verification protocol

- **No fabricated AU numbers.** All flags are evidence-based judgements, not confirmed Ads Manager figures. The project rule stands: justify against real reference points, flag uncertainty.
- **Before any niche analysis cites this file in Phase 4**, the analyst must: open Ads Manager → set country = Australia → search the exact interest/behaviour → **record the displayed estimated audience size and date** in that niche's `analysis.md`. Treat ranges under ~50K as 🟡, under ~20K as effectively 🔴.
- **Taxonomy drift:** Meta renames/removes segments without notice (major purges Jan 2024; exclusion phase-out through Jan 2025). Re-verify quarterly.
- **Policy categories:** Credit (finance/mortgage/insurance), Housing (real estate listings), and Employment ads trigger **Special Ad Categories** that strip most detailed targeting. Health, alcohol, and cosmetic-injectable creative face content-policy review. Note per niche.

---

## Sources

- [Meta to Remove More Detailed Targeting Options — Social Media Today](https://www.socialmediatoday.com/news/metas-removing-detailed-targeting-options-ad-campaigns/704375/)
- [Facebook Detailed Targeting 2025 Update — Lebesgue](https://lebesgue.io/facebook-ads/facebook-detailed-targeting-2024-update)
- [Facebook plans to remove thousands of sensitive ad-targeting options — NBC News](https://www.nbcnews.com/news/amp/rcna5029)
- [Facebook Disables Employer Targeting, And B2B Marketers Must Adapt — AdExchanger](https://www.adexchanger.com/platforms/facebook-disables-employer-targeting-b2b-marketers-must-adapt/)
- [New B2B Targeting Options for Facebook Ads — Jon Loomer](https://www.jonloomer.com/b2b-targeting-facebook-ads/)
- [Core Audiences: How to Target Facebook Ads Using Behaviors — Jon Loomer](https://www.jonloomer.com/facebook-ads-targeting-behaviors/)
- [Meta's B2B targeting options on Facebook Ads (updated Sep 2025) — Bind Media](https://bind.media/insights/metas-new-b2b-targeting-options-on-facebook-ads)
- [Facebook Job Title Debacle: Alternate Targeting & Workaround Hacks — Aimclear](https://aimclear.com/facebook-job-title-debacle-alternate-targeting-workaround-hacks/)
- [How To Target Business Owners on Facebook Ads — Skyline Social](https://www.skylinesocial.com/target-business-owners-facebook-ads/)
