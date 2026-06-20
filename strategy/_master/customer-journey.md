# Customer Journey Specification

This document defines the customer experience for the Preview Factory funnel. All Phase E work must match this specification. When implementing pages and components, refine implementations against this document until they match.

## Phase 1: Discovery
User sees a niche-specific Meta ad. Creative shows preview screenshots or before/after. Clicks ad. Lands on `/` with 3-field form.

## Phase 2: Capture
Form has three visible fields: business name (text), niche (5-option dropdown plus Other), suburb (Google Places autocompleted, AU-restricted). No phone field visible at this stage. Submit triggers POST to n8n webhook + navigation to `/building?lead_id=xxx`.

## Phase 3: Loading screen
The `/building` page shows progressive phases, not a generic spinner. Each phase appears as it completes with a check mark. Sequence: "Looking up [Business Name] on Google" → on success show "✓ Found [Business Name]", "✓ [Address]", "✓ [Phone]", photo strip slides in → "Designing your site" → "Going live". Mid-sequence, capture phone with single inline field: "Where should we send your preview link?"

## Phase 4: GBP branching
Match confidence threshold 0.7 for auto-select. Below that triggers a disambiguation card showing 2-3 candidate businesses with name, address, photo. No GBP match at all triggers extended form (phone, address, 2-3 services, optional photo upload). The extended form path must feel like a natural continuation, not an error state.

## Phase 5: Generation and deployment
Behind the scenes: Claude generates full SiteProps for multi-page site, Vercel deploys, alias to `[slug].yourplatform.com.au`. Total time from form submit to live URL: 30-50 seconds. Loading screen must show visible progress every 3 seconds — never sit static.

## Phase 6: Preview reveal
Mobile: fullscreen site, slim top overlay with live countdown, sticky bottom CTA "Save my site — $X/mo". Desktop: site rendered in phone-shaped mockup centered, with countdown top and customise panel on right. Site shows actual business name, GBP photos, phone as tap-to-call, suburb in headlines. First impression must feel like "this is mine," not "this is generic."

## Phase 7: Customisation
Three options only: colour (8 preset swatches plus custom hex), logo (PNG/JPG/SVG upload, max 5MB, auto background removal), hero image (their GBP photos picker OR upload OR niche-curated stock library). No text editing. No section reordering. Each change triggers Vercel redeploy in 3-5 seconds. Countdown does NOT pause during customisation.

## Phase 8: Sharing
"Send to someone else" button next to "Save my site." Mobile: native share sheet. Desktop: copy link to clipboard. Anyone with the link can click "Save my site" during the 3-hour window.

## Phase 9: Decision and checkout
"Save my site" opens Stripe Checkout: $X setup + $Y/mo, email pre-filled, Apple Pay and Google Pay enabled. On success → `/welcome?subscription_id=xxx`.

## Phase 10: Expiry and recovery
Countdown reaches zero without payment → preview URL redirects to `/expired/[id]` with recovery CTA. Database row retained for 30 days. T+0, T+24h, T+72h, T+7d recovery emails fire.

## Phase 11: Welcome and onboarding
Welcome page shows permanent URL and SMS edit instructions. Welcome SMS + email fire immediately. Onboarding sequence at T+24h, T+72h, T+7d. Edit channel active via SMS to Twilio number.

## Phase 12: Ongoing operations
Monthly performance reports auto-generated from call tracking + GSC + GBP data. Upsell triggers fire on activation events, plateau detection, milestone moments. Renewal point surfaces annual prepay offer.

## Quality bar
Every page in this funnel must feel premium and intentional, not templated. Loading screens earn their place by showing real progress. Reveals build trust by showing actual customer data. Customisation feels free and immediate. The conversion moment feels obvious, not pressured.
