# What You Must Do — Preview Factory Founder Checklist

**Who this is for:** You, the founder. Not your developer.

The developer gets `deployment-checklist.md`. That document covers everything technical.
This document covers everything **only you can do** — legal, financial, identity-verified accounts,
strategic decisions, and content approvals. It is in the order you need to do it.

---

## Before you hand anything to your developer

These steps are BLOCKED until you complete them. The developer cannot start until
several of these are done.

### 1. Register your business (Day 1, ~30 minutes)

You need an ABN to buy an Australian domain, receive Stripe payouts, and comply with
the Australian Spam Act 2003.

- [ ] **Sole trader:** Register a free ABN at [abr.business.gov.au](https://abr.business.gov.au).
  Takes 5 minutes, active within 28 days (usually instant for sole traders).
- [ ] **Or Pty Ltd:** Register via [asic.gov.au](https://asic.gov.au) or a company registration
  service like Cleardocs (~$538, 1-2 business days). Only needed if you want limited liability
  or plan to raise investment. A sole trader ABN is fine to start.
- [ ] Write down your ABN (11 digits). You will enter it at least 4 times in the steps below.

### 2. Choose and register your domain (Day 1, ~15 minutes, ~$20/yr)

Your domain locks in your brand and is needed before your developer can configure DNS.

- [ ] Decide on your domain. `mysitehq.com.au` is a recommendation — it is available, short,
  and positions the product as a platform. Alternatives: `previewsite.com.au`, `sitehq.com.au`,
  `livepreview.com.au`. Check at [ventraip.com.au](https://ventraip.com.au) or
  [crazydomains.com.au](https://crazydomains.com.au).
- [ ] Register the domain. Cost: ~$20 AUD/yr for `.com.au`. You need to enter your ABN in the
  eligibility field (eligibility type: "ABN").
- [ ] After registration, tell your developer what domain you chose. They will handle the DNS
  configuration.

### 3. Create a Stripe account and connect your bank (Day 1–2, ~30 minutes)

Stripe handles all customer payments. It requires your identity and your Australian bank
account — your developer cannot set this up for you.

- [ ] Go to [stripe.com](https://stripe.com) → Create account. Use your business email.
- [ ] Complete the identity verification (name, date of birth, home address, ABN). Stripe needs
  this to comply with Australian financial regulations.
- [ ] Add your Australian bank account for payouts (Settings → Bank accounts and scheduling).
  You will need your BSB and account number.
- [ ] Enable "Live mode" once verified (toggle at the top left of the Stripe dashboard).
- [ ] Hand your developer your Stripe account email address. They will create the products,
  prices, and webhook — they need your account, not your password.

  **Note on pricing:** Before your developer creates the Stripe products, you need to decide
  what to charge. Recommended starting prices based on the niche analysis:

  | Niche | Recommended entry price | Notes |
  |---|---|---|
  | Electrician | $49/mo + $99 setup | Strong LTV:CAC, high job value |
  | Plumber | $49/mo + $99 setup | Same economics as electrician |
  | House Cleaning | $39/mo + $49 setup | Higher churn risk, lower job value |
  | Physiotherapy | $59/mo + $99 setup | Higher willingness-to-pay, AHPRA niche |
  | Hair Salon | $39/mo + $79 setup | Price-sensitive, high competition |
  | Personal Trainer | $39/mo + $79 setup | Narrow margin, sequence last |

  The setup fee is one-time. It is what makes the first month unit-economics positive even
  if the customer churns immediately. Do not skip it.

### 4. Create a Meta Business Manager account (Day 2, ~20 minutes)

You need a personal Facebook account to create a Business Manager. This is tied to your
identity and cannot be delegated.

- [ ] Go to [business.facebook.com](https://business.facebook.com) → Create account.
- [ ] Enter your legal business name and business email.
- [ ] Create a Facebook Page for Preview Factory (or your chosen brand name) — required
  to run ads.
- [ ] Add a payment method (credit card) to your Ad Account.
- [ ] Do NOT turn on any campaigns yet. Just get the account created and verified.
- [ ] Note your Ad Account ID (it looks like `act_1234567890`). Your developer will need
  this to set up the Meta Pixel.

### 5. Set up your business email (Day 2, ~15 minutes, ~$10/mo)

You need an email at your domain (e.g. `hello@mysitehq.com.au`) before your developer
can verify your Postmark sender signature. Without this, automated emails cannot send.

- [ ] Option A (recommended): [Google Workspace](https://workspace.google.com) — $10 AUD/mo,
  takes 15 minutes, works exactly like Gmail. Use code `SWITCH2WORKSPACE` for first-month
  discount.
- [ ] Option B: [Zoho Mail](https://zoho.com/mail) — free for 1 user, adequate for this stage.
- [ ] Once set up, confirm you can send and receive email at `hello@[yourdomain].com.au`.
- [ ] Give your developer the email address. They will use it to verify the Postmark sender.

### 6. Make two content decisions (Day 2–3, 1 hour)

Your developer cannot make these for you.

**Decision A — Which niche to launch first?**

The analysis recommends: **Electrician or Plumber first** (best economics, cleanest targeting).

If you have a personal connection to a different trade or service niche, that is a reasonable
override — you will find it easier to speak to customers you know. Write down your answer.

**Decision B — What is your brand name and logo?**

The funnel pages currently say "Preview Factory." You may keep this or choose something else.
If you want a logo, you need to supply it (PNG, transparent background, at least 400px wide).
If you have no logo, the text wordmark is fine to start.

---

## While your developer is working

You do not need to wait. These run in parallel with the technical setup.

### 7. Prepare your first 10 test businesses (takes 30 minutes)

Before you run a single real ad, you need to test the full funnel with realistic data.
Find 10 real Australian businesses with Google Business Profiles that you will use for
testing (they will never know — you are just previewing sites, not contacting them).

- [ ] Go to Google Maps, search "electrician Surry Hills" (or your chosen niche + suburb).
- [ ] Pick 10 real businesses with at least 5 Google reviews and a profile photo.
- [ ] Write down their exact business names and suburbs. These are your test cases.

When your developer says the system is live, run all 10 through the funnel. This is how
you catch issues before real leads do.

### 8. Prepare ad creative (takes 2–4 hours or delegate to a designer)

Meta ads need creative to run. You have two practical options:

**Option A — Screen recording (free, 1 hour):**
Once the funnel is live, record your screen on your phone going through the full journey:
landing page → building page → preview reveal. Trim to 30 seconds. This "build in 60 seconds"
video is your first ad. It outperforms polished video because it feels real.

**Option B — Static before/after (free, 30 minutes):**
Take a screenshot of a competitor's poor-quality website (or a Google My Business listing
with no website) and put it next to a screenshot of your generated site. "Before → After."
This works especially well for trades.

Either way, your first ad headline should be:
> **"See your new website in 60 seconds. No credit card needed."**

Subtext:
> **"We pull your Google Business Profile and build a complete local website while you watch."**

Keep the landing page URL to the niche-specific page: `mysitehq.com.au/for/trades`
(not the homepage).

### 9. Write down your SMS number for customer communications

Once your developer sets up Twilio, they will give you an Australian mobile number
(e.g. `0412 XXX XXX`). This is the number your customers will SMS to update their site.

- [ ] Save this number in your phone as "Preview Factory SMS" so you recognise it.
- [ ] Test it by sending yourself a message after setup is complete.
- [ ] Decide if you want to forward inbound SMS to your personal number or manage it
  through the Twilio console. Tell your developer.

---

## After your developer finishes

Your developer will tell you when the end-to-end test passes (Section 12 of the deployment
checklist). At that point, do the following before turning on any ads.

### 10. Walk through the funnel yourself (30 minutes)

Do this on your phone, not your laptop. Most of your future customers will do the same.

- [ ] Go to `https://[yourdomain].com.au/for/trades` on your phone.
- [ ] Enter a real business name, select "Electrician," enter a real Sydney suburb.
- [ ] Watch the building page. Does it feel smooth and credible?
- [ ] When the preview loads: does it feel like a real website a tradie would be proud of?
- [ ] Try the customise panel: change the colour, see if it updates.
- [ ] Tap "Save my site" — the Stripe checkout should open. You do NOT need to complete
  the payment. Just confirm it loads and shows the right price.
- [ ] Let the countdown run out (you can set the expiry to 2 minutes in Supabase for testing).
  Does the expired page load? Does a recovery email arrive in your test inbox?
- [ ] If anything feels wrong or looks wrong, note it down and tell your developer.

### 11. Turn on Meta ads (30 minutes after your developer confirms everything works)

- [ ] Go back to [business.facebook.com](https://business.facebook.com).
- [ ] Create your first campaign:
  - **Objective:** Leads
  - **Budget:** $30 AUD/day to start (not more — you need to calibrate CPL before scaling)
  - **Audience:** Australia only → Job titles: "Electrician," "Plumber," "Tradesperson,"
    "Licensed Electrician," "Master Plumber." Age 25–55. No interest targeting yet.
  - **Placements:** Facebook Feed + Instagram Feed only. Turn off Audience Network.
  - **Ad:** Use your screen recording or before/after image from Step 8.
  - **Landing page:** `https://[yourdomain].com.au/for/trades?utm_source=meta&utm_campaign=trades-launch`
- [ ] Run this for 7 days before changing anything.
- [ ] Target cost-per-lead: under $15 AUD. If you are paying more than $20, pause and
  review the ad creative before scaling.

### 12. Monitor the first two weeks (15 minutes/day)

- [ ] **Bookmark the n8n Executions page** (your developer will give you the URL,
  e.g. `https://n8n.[yourdomain].com.au`). Check it every morning. A red "Failed"
  execution needs attention — screenshot it and send it to your developer.
- [ ] **Check your Supabase `leads` table** once a day. Watch for leads that stay on
  `status = "gbp_found"` without progressing — this means the site generation is
  failing silently.
- [ ] **Reply to every recovery email opt-in** personally for the first 10 conversions.
  These are your earliest customers. A personal reply ("Hi, I noticed you checked out
  your preview — happy to jump on a quick call") converts at 30–40% and teaches you
  what objections to address in the automated sequences.
- [ ] **Track your cost-per-lead and cost-per-acquisition** in a simple spreadsheet.
  You are aiming for CPL < $15 and CPA < $80 (LTV:CAC target of ~4.5x on $49/mo).

---

## Decisions only you can make (summary)

| Decision | Where it matters | Recommendation |
|---|---|---|
| Business entity type | ABN registration | Sole trader to start, Pty Ltd at month 3+ |
| Domain name | Everything | `mysitehq.com.au` or your own choice |
| Launch niche | Ad spend allocation | Electrician first — best economics |
| Pricing | Stripe products | $49/mo + $99 setup for trades |
| Brand name | All funnel pages | "Preview Factory" or your choice |
| Ad creative | Meta Ads | Screen recording of the funnel build |
| Daily ad budget | Meta Ads | $30/day to start, scale after CPL confirmed |

---

## Things you do NOT need to do

Your developer handles all of these from the deployment checklist:
- Installing n8n on Hetzner
- Configuring Supabase, Vercel, DNS records
- Importing n8n workflows
- Setting up Twilio, Postmark, Outscraper technically
- All environment variables and API keys
- The Meta Pixel integration
- End-to-end technical testing

---

## If you get stuck

The most common early blockers for non-technical founders, in order of frequency:

1. **ABN not yet active** — sole trader ABNs activate within minutes; Pty Ltd can take
   1-2 days. Do not delay domain or Stripe setup waiting for Pty Ltd. Register as a sole
   trader first and convert later if needed.

2. **Stripe identity verification declined** — usually because the name on the account
   does not match the ABN exactly. Use your legal name, not a nickname.

3. **Meta Business Manager flagged for review** — common for new accounts in the
   "financial products" or "business services" category. Upload your ABN certificate
   when prompted. Usually resolves in 24–48 hours.

4. **Domain not propagating** — DNS changes take up to 48 hours but usually under 30
   minutes via Cloudflare. If your developer says the site is deployed but you see
   "site can't be reached," wait 30 minutes and refresh.

5. **First leads not converting** — if you have leads but no paid conversions in the
   first week, the issue is almost always the preview experience, not the ads. Walk
   through the funnel on a cheap Android phone (not your high-end iPhone) — that is
   closer to your customer's experience.

---

*This document is part of Preview Factory — generated by the Preview Factory build system.*
*Last updated: 2026-06-20.*
