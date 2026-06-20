# Preview Factory — Deployment Checklist

**Purpose:** Take the codebase from local development to live revenue. Follow every
section in order. Do not skip ahead. Steps marked **COSTS MONEY** or **TOUCHES
CREDENTIALS** must be completed by you directly — nothing in this system does them
for you.

**Repo root referenced throughout:** `preview-factory-templates/`

**Primary domain referenced throughout:** `mysitehq.com.au` (substitute your chosen
.com.au domain wherever this appears)

---

## 0. Pre-requisites

Complete all of these before touching any account signup.

- [ ] You have a registered Australian business entity — either a sole trader ABN or a
  Pty Ltd ACN+ABN. An ABN is required to purchase a .com.au domain and to enable
  Stripe payouts to an Australian bank. If you do not have one, register at
  abr.business.gov.au (sole trader: free, instant; Pty Ltd: ~$538 via ASIC).
  **COSTS MONEY / TOUCHES CREDENTIALS**
- [ ] You have a dedicated credit or debit card available for account signups. Using a
  card with a low limit reduces fraud exposure during early testing.
- [ ] You have an Australian mobile number. Twilio requires verification that the
  purchasing account is authorised to hold Australian numbers — your personal
  mobile number is sufficient for this.
- [ ] Your laptop has Node.js 18 or later (`node --version`), git (`git --version`),
  and Docker Desktop installed and running.
- [ ] You have cloned the repo and can run `npm install` from the repo root without
  errors.
- [ ] You have decided on your .com.au domain. `mysitehq.com.au` is used throughout
  this document. If you choose a different domain, find-and-replace every occurrence
  before following any step.

---

## 1. Domain and DNS — Cloudflare

### 1a. Register the domain

**COSTS MONEY / TOUCHES CREDENTIALS**

- [ ] Go to ventraip.com.au (or your preferred auDA-accredited registrar; others
  include VentraIP, Crazy Domains, Netfleet).
- [ ] Search for `mysitehq.com.au`. Cost is approximately $20 AUD per year. .com.au
  domains require an ABN or ACN that matches the registrant details.
- [ ] In the registration form, enter your ABN in the "Eligibility" field. The
  eligibility type is "ABN" and the eligibility ID is your 11-digit ABN without
  spaces.
- [ ] Complete purchase. You will receive registrar login credentials by email. Save
  these in your password manager.
- [ ] Confirm you can log in to the VentraIP control panel and see the domain listed
  under "My Services".

### 1b. Create Cloudflare account and add domain

**TOUCHES CREDENTIALS**

- [ ] Go to cloudflare.com/sign-up. Create a free account using your business email
  address.
- [ ] In the Cloudflare dashboard, click "Add a Site". Type `mysitehq.com.au` and
  click "Add Site".
- [ ] Select the Free plan. Click "Continue".
- [ ] Cloudflare will scan existing DNS records. Do not modify anything Cloudflare
  finds at this stage — just click "Continue".
- [ ] Cloudflare will display two nameserver hostnames, for example:
  `aisha.ns.cloudflare.com` and `miles.ns.cloudflare.com`. Copy both.
- [ ] Log in to VentraIP. Go to "Manage Domain" for `mysitehq.com.au`. Find the
  "Nameservers" section. Replace the existing nameservers with the two Cloudflare
  nameservers. Save.
- [ ] Back in Cloudflare, click "Done, check nameservers". Propagation takes between
  5 minutes and 48 hours. You will receive a Cloudflare email when the domain is
  active.
- [ ] Once active, confirm the Cloudflare dashboard shows a green "Active" badge next
  to `mysitehq.com.au`.

### 1c. Add DNS records in Cloudflare

- [ ] In the Cloudflare dashboard for `mysitehq.com.au`, go to DNS → Records.
- [ ] Add record: Type `CNAME`, Name `*`, Target `cname.vercel-dns.com`, Proxy status
  **DNS only** (grey cloud icon, not orange). This is the wildcard record that routes
  `slug.mysitehq.com.au` subdomains to Vercel. **Do not enable the Cloudflare proxy
  (orange cloud) on this record** — Vercel requires direct DNS for custom domains.
- [ ] Add record: Type `CNAME`, Name `www`, Target `cname.vercel-dns.com`, Proxy
  status DNS only.
- [ ] Leave the `n8n` A record for now — you will add it in Section 9 once you have
  the Hetzner server IP.
- [ ] Vercel will request a TXT record for domain ownership verification during
  Section 3. Return to this DNS panel and add it when Vercel shows the value.

---

## 2. Supabase

**TOUCHES CREDENTIALS**

- [ ] Go to supabase.com. Click "Start your project". Sign in with GitHub or create an
  account with your business email.
- [ ] Click "New project". Fill in:
  - Organisation: create one named "Preview Factory" if not present
  - Project name: `preview-factory`
  - Database password: generate a strong password and save it in your password
    manager — this is the Postgres superuser password, not the API key
  - Region: `Southeast Asia (Singapore)` — this is the closest Supabase region to
    Australia and gives the lowest latency for your Vercel and n8n connections
  - Plan: Free tier is sufficient to start. Note: `pg_cron` (used for scheduled
    jobs) requires the Pro plan ($25 USD/mo). If you are on the Free tier, the
    expiry scheduler in workflow 05 uses an n8n Schedule trigger instead, which
    is already wired up in the workflow JSON and does not require `pg_cron`.
- [ ] Wait for the project to provision (approximately 2 minutes).

### 2a. Run the schema

- [ ] In the Supabase dashboard, go to SQL Editor (left sidebar).
- [ ] Click "New query".
- [ ] Open the file `strategy/_master/supabase-schema.sql` from the repo in a text
  editor. Select all content and copy it.
- [ ] Paste the entire SQL into the Supabase SQL Editor query window.
- [ ] Click "Run" (or press Cmd+Enter). The query runs as a single transaction.
- [ ] Confirm: the bottom panel shows "Success. No rows returned."
- [ ] Go to Table Editor → confirm these tables are present: `leads`, `sites`,
  `build_progress`, `subscriptions`, `customisations`, `events`,
  `recovery_attempts`, `monthly_reports`.
- [ ] Note: the `pg_cron` extension lines in the schema are wrapped in a `/* ... */`
  comment block and will not execute. They are documentation only. If you upgrade
  to Pro and wish to enable `pg_cron`, uncomment those lines and re-run only that
  block.

### 2b. Copy API keys

- [ ] Go to Project Settings (gear icon, bottom left) → API.
- [ ] Copy and save:
  - "Project URL" — looks like `https://abcdefghijkl.supabase.co`
  - "anon public" key — long JWT starting with `eyJ...`, labelled "anon public"
  - "service_role" secret key — long JWT starting with `eyJ...`, labelled
    "service_role" — **treat this like a password; it bypasses Row Level Security**
- [ ] Store all three in your password manager under "Supabase — preview-factory".

### 2c. Authentication settings

- [ ] Go to Authentication → Settings (in the left sidebar under "Auth").
- [ ] Under "Email", toggle "Enable email confirmations" to OFF. n8n handles
  transactional email; Supabase Auth email confirmations would interfere.
- [ ] Save.

### 2d. Realtime

- [ ] Go to Database → Replication (in the left sidebar).
- [ ] Confirm the `supabase_realtime` publication lists both `build_progress` and
  `sites`. The schema SQL ran `ALTER PUBLICATION supabase_realtime ADD TABLE ...`
  for both. If either is missing, run these two statements individually in the SQL
  Editor:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE build_progress;
  ALTER PUBLICATION supabase_realtime ADD TABLE sites;
  ```

---

## 3. Vercel

**COSTS MONEY / TOUCHES CREDENTIALS**

- [ ] Go to vercel.com. Sign in with the same GitHub account that has the repo. If you
  have not pushed the repo to GitHub yet, do so now:
  ```
  git remote add origin https://github.com/YOUR_USERNAME/preview-factory-templates.git
  git push -u origin main
  ```
- [ ] In the Vercel dashboard, click "Add New" → "Project". Find and import
  `preview-factory-templates`. Vercel will detect it as a Next.js project.
- [ ] **COSTS MONEY**: Vercel Pro plan is required ($20 USD/mo). The Free plan does
  not support wildcard custom domains (`*.mysitehq.com.au`). Upgrade: Team Settings
  → Billing → Upgrade to Pro. A credit card is required.
- [ ] Configure the project before deploying:
  - Framework Preset: Next.js (auto-detected)
  - Root Directory: leave blank (the Next.js app is at repo root)
  - Build Command: `npm run build` (default)
  - Output Directory: `.next` (default)
  - Do not deploy yet — add environment variables first (see step 3b).

### 3a. Add custom domains

- [ ] In Project Settings → Domains, click "Add".
- [ ] Add `mysitehq.com.au`. Vercel will provide a TXT record for verification. Go to
  Cloudflare DNS and add that TXT record exactly as shown (Name: `_vercel`, Value:
  the string Vercel gives you, Proxy: DNS only).
- [ ] Add `*.mysitehq.com.au` (the wildcard). Vercel will accept this once the root
  domain is verified and the wildcard CNAME is in place in Cloudflare (added in
  Section 1c).
- [ ] Add `www.mysitehq.com.au` and set it to redirect to `mysitehq.com.au` (Vercel
  handles this as a redirect configuration in the Domains panel).
- [ ] Wait for Vercel to show all domains as "Valid Configuration" with green ticks.

### 3b. Create a Vercel API token

- [ ] Go to Vercel Account Settings (your avatar, top right) → Tokens.
- [ ] Click "Create Token".
- [ ] Name: `preview-factory-n8n`, Scope: the `preview-factory-templates` project,
  Expiration: "No expiry" (or set a long expiry and calendar a reminder to rotate).
- [ ] Copy the token — it is shown only once. Save to password manager as "Vercel API
  Token — n8n".

### 3c. Note the Project ID

- [ ] In Project Settings → General, find "Project ID". It looks like
  `prj_xxxxxxxxxxxxxxxxxxxx`. Copy it.

### 3d. Add environment variables

Go to Project Settings → Environment Variables. Add each variable below. Set the
environment to "Production, Preview, Development" for all of them unless noted.
You will fill in values that are not yet known (e.g. Stripe Price IDs) after
completing the relevant section — return here and add them before the first test.

| Variable name | Where to get the value |
|---|---|
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | `https://n8n.mysitehq.com.au/webhook/lead-capture` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL (Section 2b) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key (Section 2b) |
| `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (Section 10) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key — `pk_live_...` (Section 4) |
| `STRIPE_SECRET_KEY` | Stripe secret key — `sk_live_...` (Section 4) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret — `whsec_...` (Section 4) |
| `STRIPE_PRICE_TRADES` | Stripe Price ID for Trades recurring — `price_...` (Section 4) |
| `STRIPE_PRICE_ALLIED_HEALTH` | Stripe Price ID for Allied Health recurring — `price_...` |
| `STRIPE_PRICE_BEAUTY` | Stripe Price ID for Beauty recurring — `price_...` |
| `STRIPE_PRICE_FITNESS` | Stripe Price ID for Fitness recurring — `price_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (Section 2b) — server only |
| `ANTHROPIC_API_KEY` | Anthropic API key — `sk-ant-...` (Section 8) |
| `VERCEL_TOKEN` | Vercel API token (Section 3b) |
| `VERCEL_PROJECT_ID` | Vercel Project ID (Section 3c) |
| `SITE_BASE_DOMAIN` | `mysitehq.com.au` |
| `NEXT_REVALIDATE_SECRET` | Generate a random 32-character string; save it — used by n8n workflow 04 to call `/api/revalidate` |

- [ ] After adding all variables, trigger a fresh deployment: Deployments → click
  "Redeploy" on the latest deployment, or push a trivial commit to `main`.
- [ ] Confirm the deployment succeeds (green "Ready" badge). If it fails, check the
  build log — the most common cause is a missing environment variable.

---

## 4. Stripe

**COSTS MONEY / TOUCHES CREDENTIALS**

### 4a. Create account and enable live payments

- [ ] Go to stripe.com. Sign up with your business email.
- [ ] Complete Stripe's identity verification for Australia. You will need:
  - Your ABN
  - Business address
  - Bank account details for payouts (BSB + account number)
  - Your personal identification (driver licence or passport)
- [ ] In Stripe Dashboard, confirm "Payments" shows as enabled (not "restricted" or
  "pending verification"). This may take 1–3 business days after submitting
  verification documents.
- [ ] Ensure you are viewing the **Live** environment (toggle in the top-left corner).
  Do not use Test mode for the production configuration steps below, though you
  should do your end-to-end test in Section 12 using test mode first.

### 4b. Add bank account for payouts

- [ ] Go to Settings → Bank accounts and scheduling.
- [ ] Click "Add bank account". Enter your Australian BSB and account number.
- [ ] Confirm the micro-deposit verification if Stripe requires it (two small deposits
  arrive in 1–2 business days; enter the amounts in Stripe to verify).

### 4c. Create Products and Prices

In Stripe Dashboard → Product catalogue → Add product:

- [ ] Product 1: "Trades Website"
  - Name: `Trades Website`
  - Pricing model: Recurring
  - Price: `$49.00 AUD` / month
  - Click "Add another price" → One time
  - Price: `$99.00 AUD`, name it "Setup fee"
  - Save. Copy the **recurring** Price ID (starts with `price_`) — this is
    `STRIPE_PRICE_TRADES`.

- [ ] Product 2: "Allied Health Website"
  - Name: `Allied Health Website`
  - Recurring price: `$59.00 AUD` / month
  - One-time setup: `$99.00 AUD`
  - Copy the recurring Price ID — this is `STRIPE_PRICE_ALLIED_HEALTH`.

- [ ] Product 3: "Beauty Website"
  - Name: `Beauty Website`
  - Recurring price: `$49.00 AUD` / month
  - One-time setup: `$99.00 AUD`
  - Copy the recurring Price ID — this is `STRIPE_PRICE_BEAUTY`.

- [ ] Product 4: "Fitness Website"
  - Name: `Fitness Website`
  - Recurring price: `$49.00 AUD` / month
  - One-time setup: `$99.00 AUD`
  - Copy the recurring Price ID — this is `STRIPE_PRICE_FITNESS`.

- [ ] Return to Vercel and fill in the four `STRIPE_PRICE_*` environment variables.

### 4d. Configure Stripe Checkout to pass lead_id in metadata

**This is a critical wiring step.** Workflow 07 (Stripe Webhook Handler) reads
`session.metadata.lead_id` to link a payment back to a Preview Factory lead. If
the Checkout session is created without `metadata.lead_id`, workflow 07 will throw
an error and the site will never go live.

When you build the Stripe Checkout session creation endpoint in the Next.js app
(or in n8n), ensure the session is created with:
```json
{
  "metadata": {
    "lead_id": "<the lead_id from the leads table>"
  }
}
```
This must be set at session creation time — it cannot be added retroactively.

### 4e. Create webhook endpoint

- [ ] In Stripe Dashboard → Developers → Webhooks → Add endpoint.
  - Endpoint URL: `https://n8n.mysitehq.com.au/webhook/stripe-webhook`
  - (You will not have this URL until Section 9. Add a placeholder URL now if
    needed and update it after n8n is running. Stripe allows editing the endpoint
    URL at any time.)
  - Events to send — select these three exactly:
    - `checkout.session.completed`
    - `customer.subscription.deleted`
    - `invoice.payment_failed`
  - Click "Add endpoint".
- [ ] On the endpoint detail page, click "Reveal" next to "Signing secret". Copy the
  `whsec_...` value. This is `STRIPE_WEBHOOK_SECRET`. Save to password manager.
- [ ] Add `STRIPE_WEBHOOK_SECRET` to Vercel environment variables and to the n8n
  variables list (Section 9d).

### 4f. Copy API keys

- [ ] Developers → API keys (ensure you are in Live mode, not Test mode).
- [ ] Copy the "Secret key" (`sk_live_...`). This is `STRIPE_SECRET_KEY`.
- [ ] Copy the "Publishable key" (`pk_live_...`). This is
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- [ ] Add both to Vercel environment variables.

### 4g. Enable Stripe Customer Portal

- [ ] Settings → Customer portal.
- [ ] Enable "Customer portal". This gives paying customers a self-serve URL to update
  payment methods and cancel subscriptions. Stripe hosts this; no code required.
- [ ] Note the portal URL — it is `https://billing.stripe.com/p/login/...`. You will
  reference this in the payment-failed email template in Postmark.

---

## 5. Twilio

**COSTS MONEY / TOUCHES CREDENTIALS**

- [ ] Go to twilio.com. Click "Sign up". Use your business email.
- [ ] Verify your email address and Australian mobile number.
- [ ] Complete Twilio's business verification. For Australian numbers you will need to
  provide your ABN and business address. This can take 1–5 business days.
- [ ] Once verified, go to Phone Numbers → Buy a Number:
  - Country: Australia
  - Type: Mobile
  - Select any available number. Cost is approximately $1.50 AUD/month.
  - Click "Buy".
- [ ] Note the purchased number in E.164 format: `+61XXXXXXXXX`. This is
  `TWILIO_FROM_NUMBER`.
- [ ] From the Twilio Console dashboard:
  - Copy "Account SID" — looks like `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`. This is
    `TWILIO_ACCOUNT_SID`.
  - Click "Show" next to "Auth Token". Copy it. This is `TWILIO_AUTH_TOKEN`.
- [ ] Save all three to your password manager under "Twilio — preview-factory".

---

## 6. Postmark

**TOUCHES CREDENTIALS**

- [ ] Go to postmarkapp.com. Click "Get Started Free". Create an account with your
  business email.
- [ ] In the Postmark dashboard, go to "Sender Signatures" (left sidebar).
- [ ] Click "Add Domain or Signature".
  - Select "Domain" (not single email address) for better deliverability.
  - Enter `mysitehq.com.au`.
  - Postmark will generate DNS records (DKIM and SPF). Add each record to
    Cloudflare DNS exactly as Postmark shows:
    - DKIM: a TXT record — Name is something like `20231101._domainkey`, Value is
      the `v=DKIM1; k=rsa; p=...` string. Proxy: DNS only.
    - Return-Path: a CNAME record — Name `pm-bounces`, Target
      `pm.mtasv.net`. Proxy: DNS only.
  - Click "Verify" in Postmark once you have added both records. DNS propagation
    may take up to 30 minutes.
- [ ] Once verified, go to "Servers" → "Create Server". Name: `preview-factory`.
  Message Stream: "Transactional" (default).
- [ ] Go to the new server → API Tokens. Copy the Server API token. This is
  `POSTMARK_SERVER_TOKEN`. Save to password manager.

### 6a. Create email templates

In the `preview-factory` server → Message Streams → Transactional → Templates:

Create each template below. For each: click "Create Template", enter the alias and
subject, write the HTML and text body, and save. Note the numeric Template ID
Postmark assigns (shown in the template list and URL).

- [ ] Template 1
  - Alias: `welcome-email`
  - Subject: `Your site is live at {{{permanent_url}}}`
  - Body: Congratulate the customer by name, show their live URL as a clickable
    link, explain what happens next (Google will index within 48 hours, monthly
    reports will follow).

- [ ] Template 2
  - Alias: `recovery-t0`
  - Subject: `Your preview expired — recover it in 2 clicks`
  - Body: The site they built is saved. Link to the recovery URL
    `https://mysitehq.com.au/expired/{{{lead_id}}}`. Urgency: data is held for
    30 days.

- [ ] Template 3
  - Alias: `recovery-t24h`
  - Subject: `Still thinking? Your site data is saved.`
  - Body: Softer follow-up. Show what their generated site looks like (use the
    `permanent_url` field even though the site is expired, link to the recover
    page).

- [ ] Template 4
  - Alias: `recovery-t72h`
  - Subject: `Last chance to recover your preview.`
  - Body: Stronger urgency. Offer a discount code if desired (leave a placeholder
    `{{{discount_code}}}` in the template body and populate it from n8n if you
    implement discounts later).

- [ ] Template 5
  - Alias: `recovery-t7d`
  - Subject: `We saved your site for 30 days. Here is your link.`
  - Body: Final recovery touch. After 30 days the data is purged. Recovery link
    again.

- [ ] Template 6
  - Alias: `onboarding-day1`
  - Subject: `Your site is indexed. Here is what to do next.`
  - Body: Day 1 post-purchase. Link to Google Search Console, suggest claiming
    GBP, show the site URL.

- [ ] Template 7
  - Alias: `onboarding-day3`
  - Subject: `SEO tip: sync your Google Business Profile.`
  - Body: Explain that linking the website URL in GBP boosts local rankings.
    Plain language, no jargon.

- [ ] Template 8
  - Alias: `onboarding-day7`
  - Subject: `One week in. How is it going?`
  - Body: Check-in. Show first call count from reporting (leave a
    `{{{call_count}}}` placeholder). Invite reply if they need anything.

- [ ] Template 9
  - Alias: `monthly-report`
  - Subject: `Your site performance report — {{{month}}}`
  - Body: Monthly metrics. Placeholders: `{{{call_count}}}`,
    `{{{search_impressions}}}`, `{{{search_clicks}}}`, `{{{permanent_url}}}`.

- [ ] Template 10
  - Alias: `upsell-seo`
  - Subject: `You are getting calls. Here is how to get more.`
  - Body: Triggered when monthly call count exceeds threshold. Upsell to SEO
    add-on tier.

- [ ] Record the numeric Postmark Template ID for each template. You will need these
  if you reference templates by ID rather than alias in n8n workflows.

---

## 7. Outscraper

**COSTS MONEY / TOUCHES CREDENTIALS**

- [ ] Go to outscraper.com. Click "Sign up". Use your business email.
- [ ] Verify your email.
- [ ] Go to Billing → Top Up Credits. Add a minimum of $10 USD. Google Business
  Profile lookups cost approximately $0.002 USD per request (500 lookups per $1).
  A budget of $10 is sufficient for several thousand lead captures during early
  testing.
- [ ] Go to API Keys → Generate Key. Name it `preview-factory`.
- [ ] Copy the API key. This is `OUTSCRAPER_API_KEY`. Save to password manager.
- [ ] Note the default rate limit on your plan (typically 10 requests per minute at
  the free/starter tier). If your ad spend generates more than 10 leads per
  minute, request a rate limit increase via Outscraper support before scaling.

---

## 8. Anthropic (Claude API)

**COSTS MONEY / TOUCHES CREDENTIALS**

- [ ] Go to console.anthropic.com. Sign in or create an account.
- [ ] Go to API Keys → Create Key. Name: `preview-factory-prod`.
- [ ] Copy the key — it starts with `sk-ant-`. This is `ANTHROPIC_API_KEY`. It is
  shown only once; save it to your password manager immediately.
- [ ] Go to Settings → Billing. Add a credit card.
- [ ] Go to Settings → Limits. Set a monthly spend limit of $100 USD to start. This
  prevents runaway costs during early testing. Increase this limit as you scale.
- [ ] Note: the workflows reference model `claude-sonnet-4-5`. Verify this model ID
  is available on your Anthropic account. If you have access to a newer model,
  update the model ID in workflow 03 (`strategy/_master/n8n-workflows/03-site-generation.json`)
  before importing. Check current model availability at docs.anthropic.com/en/docs/models-overview.
- [ ] Add `ANTHROPIC_API_KEY` to Vercel environment variables (Section 3d) and to
  the n8n variables list (Section 9d).

---

## 9. n8n on Hetzner VPS

**COSTS MONEY / TOUCHES CREDENTIALS**

### 9a. Provision the server

- [ ] Go to hetzner.com/cloud. Create an account. A credit card is required.
  **COSTS MONEY**: approximately €5.77/month for the CX21 server type.
- [ ] In the Hetzner Cloud Console, click "Add Server":
  - Location: Falkenstein (EU) or Nuremberg — choose whichever shows available
    capacity. Latency to Australia is similar for both (~270ms) and does not
    affect user experience because all n8n jobs are asynchronous.
  - Image: Ubuntu 22.04
  - Type: Shared vCPU → CX21 (2 vCPUs, 4 GB RAM, 40 GB disk)
  - SSH Keys: click "Add SSH Key" and paste your public SSH key
    (`~/.ssh/id_rsa.pub` or `~/.ssh/id_ed25519.pub`). If you do not have an SSH
    key pair, generate one: `ssh-keygen -t ed25519 -C "preview-factory"`
  - Name: `preview-factory-n8n`
  - Click "Create and Buy Now".
- [ ] Note the server's public IPv4 address from the server detail page. You will use
  it in the next step and when adding the DNS A record in Cloudflare.

### 9b. Add n8n DNS record in Cloudflare

- [ ] In Cloudflare DNS for `mysitehq.com.au`, add:
  - Type: A
  - Name: `n8n`
  - IPv4 address: the Hetzner server IP
  - Proxy: **DNS only** (grey cloud)
- [ ] This creates `n8n.mysitehq.com.au` pointing to your VPS.

### 9c. Install n8n and Caddy on the server

SSH into the server as root:
```
ssh root@[HETZNER_IP]
```

Run the following commands. Each command is shown separately so you can confirm
each step succeeds before proceeding.

**Install Docker:**
```bash
apt update && apt install -y docker.io docker-compose-plugin
systemctl enable docker
systemctl start docker
docker --version
```
Confirm `docker --version` returns a version string.

**Create the n8n directory and compose file:**
```bash
mkdir -p /opt/n8n
```

Create `/opt/n8n/docker-compose.yml` with the following content. Substitute a
strong password for `CHANGE_THIS_PASSWORD` before saving.
**TOUCHES CREDENTIALS — set a unique strong password before running:**
```yaml
version: "3.8"
services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=CHANGE_THIS_PASSWORD
      - N8N_HOST=n8n.mysitehq.com.au
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.mysitehq.com.au/
      - GENERIC_TIMEZONE=Australia/Sydney
      - N8N_LOG_LEVEL=info
      - EXECUTIONS_DATA_SAVE_ON_SUCCESS=all
      - EXECUTIONS_DATA_SAVE_ON_ERROR=all
      - EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true
    volumes:
      - n8n_data:/home/node/.n8n
volumes:
  n8n_data:
```

**Start n8n:**
```bash
docker compose -f /opt/n8n/docker-compose.yml up -d
docker ps
```
Confirm the n8n container shows status "Up".

**Install Caddy (HTTPS reverse proxy):**
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudflare.com/rpm/stable/cloudflare.list' | tee /etc/apt/sources.list.d/cloudflare.list 2>/dev/null || true
curl -1sLf 'https://dl.cloudflare.com/rpm/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/cloudflare.gpg
curl -1sLf 'https://dl.cloudflare.com/rpm/stable/cloudflare.list' | tee /etc/apt/sources.list.d/cloudflare.list
```
If the Cloudflare repository does not resolve (it is sometimes unavailable), use
the Caddy project's own repository instead:
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudflare.com/rpm/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudflare.com/rpm/stable/cloudflare.list' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
```
Simpler alternative that works reliably on Ubuntu 22.04:
```bash
apt install -y caddy
```
If `apt install -y caddy` fails because of the repository, use:
```bash
curl -fsSL https://getcaddy.com | bash -s personal
```
Or download the Caddy binary directly from github.com/caddyserver/caddy/releases,
pick `caddy_linux_amd64.tar.gz`, extract, and move to `/usr/local/bin/caddy`.

**Write the Caddyfile:**

Create `/etc/caddy/Caddyfile`:
```
n8n.mysitehq.com.au {
    reverse_proxy localhost:5678
}
```

**Start Caddy:**
```bash
systemctl enable caddy
systemctl start caddy
systemctl status caddy
```
Confirm Caddy is active. Caddy automatically obtains a Let's Encrypt TLS
certificate for `n8n.mysitehq.com.au`. This requires port 80 and 443 to be open
on the Hetzner firewall (they are open by default on Ubuntu 22.04 in Hetzner).

**Verify n8n is accessible:**
- [ ] Open `https://n8n.mysitehq.com.au` in your browser.
- [ ] You should see the n8n login page with a basic auth prompt.
- [ ] Log in with username `admin` and the password you set in the compose file.
- [ ] Complete the n8n owner setup wizard (email, password for the n8n account).
  Save these credentials in your password manager separately from the basic auth
  credentials.

### 9d. Import the workflow files

- [ ] In n8n, go to Settings → Import. Import each workflow file in numerical order:
  - `strategy/_master/n8n-workflows/01-lead-capture.json`
  - `strategy/_master/n8n-workflows/02-gbp-lookup.json`
  - `strategy/_master/n8n-workflows/03-site-generation.json`
  - `strategy/_master/n8n-workflows/04-vercel-deployment.json`
  - `strategy/_master/n8n-workflows/05-preview-expiry.json`
  - `strategy/_master/n8n-workflows/06-recovery-sequence.json`
  - `strategy/_master/n8n-workflows/07-stripe-webhook.json`
  - `strategy/_master/n8n-workflows/08-post-purchase-welcome.json`
  - `strategy/_master/n8n-workflows/09-onboarding-sequence.json`
  - `strategy/_master/n8n-workflows/10-monthly-reporting.json`
  - `strategy/_master/n8n-workflows/11-upsell-automation.json`

  To import: in n8n, click "..." on the top-right of any workflow view → "Import
  from File". Alternatively, open each `.json` file in a text editor, copy the
  contents, and use "Import from Clipboard".

- [ ] After importing all 11 workflows, note each workflow's numeric ID. Find it by:
  - Opening each workflow in n8n
  - Reading the URL: it will be `https://n8n.mysitehq.com.au/workflow/123`
    where `123` is the numeric ID
  - Or: in the Workflows list, each row shows an ID column

### 9e. Add n8n Variables

Go to Settings → Variables in n8n. Add each variable below using the exact
variable names shown. Values come from the accounts you have set up in earlier
sections.

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Supabase Project URL from Section 2b |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key from Section 2b |
| `ANTHROPIC_API_KEY` | Anthropic API key from Section 8 |
| `VERCEL_TOKEN` | Vercel API token from Section 3b |
| `VERCEL_PROJECT_ID` | Vercel Project ID from Section 3c |
| `SITE_BASE_DOMAIN` | `mysitehq.com.au` |
| `OUTSCRAPER_API_KEY` | Outscraper API key from Section 7 |
| `STRIPE_SECRET_KEY` | Stripe secret key from Section 4f |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret from Section 4e |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID from Section 5 |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token from Section 5 |
| `TWILIO_FROM_NUMBER` | Twilio AU number in E.164 format e.g. `+61412345678` |
| `POSTMARK_SERVER_TOKEN` | Postmark server API token from Section 6 |
| `POSTMARK_FROM_EMAIL` | `hello@mysitehq.com.au` |
| `CLOUDFLARE_TURNSTILE_SECRET` | Cloudflare Turnstile secret key from Section 10 |
| `NEXT_REVALIDATE_SECRET` | Same random string you set in Vercel env vars (Section 3d) |
| `WORKFLOW_ID_02_GBP_LOOKUP` | Numeric ID of workflow 02 — GBP Lookup (from URL) |
| `WORKFLOW_ID_03_SITE_GEN` | Numeric ID of workflow 03 — Site Generation |
| `WORKFLOW_ID_04_DEPLOY` | Numeric ID of workflow 04 — Vercel Deployment |
| `WORKFLOW_ID_05B_RECOVERY` | Numeric ID of workflow 06 — Recovery Sequence |
| `WORKFLOW_ID_08_WELCOME` | Numeric ID of workflow 08 — Post-Purchase Welcome |

Note on the recovery workflow ID: workflow 05 (Preview Expiry) calls the variable
`WORKFLOW_ID_05B_RECOVERY` and expects the numeric ID of workflow 06 (Recovery
Sequence). This naming is intentional — the expiry workflow triggers the recovery
workflow.

### 9f. Activate all workflows

- [ ] In n8n Workflows list, open each workflow and toggle the "Active" switch at the
  top right to ON.
- [ ] Do this for all 11 workflows.
- [ ] Confirm each shows "Active" in the workflow list.
- [ ] Workflow 05 (Preview Expiry) has a Schedule trigger. Once activated it will run
  every 5 minutes. You can confirm it is running by checking Executions after
  5 minutes — it should show a successful execution (it will find zero expired
  sites on the first run, which is expected).

---

## 10. Cloudflare Turnstile (Bot Protection)

- [ ] In the Cloudflare dashboard, go to "Turnstile" in the left sidebar (under the
  account level, not the domain level).
- [ ] Click "Add site".
  - Site name: `preview-factory-form`
  - Domain: `mysitehq.com.au`
  - Widget type: Managed (invisible challenge — users with clean browsers see no
    CAPTCHA puzzle; only suspicious traffic is challenged)
- [ ] Click "Create".
- [ ] On the next screen you will see:
  - Site Key (public): starts with `0x4AAAA...` — this is
    `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`. Add to Vercel.
  - Secret Key (private): starts with `0x4AAAA...` — this is
    `CLOUDFLARE_TURNSTILE_SECRET`. Add to n8n Variables.
- [ ] Add both values to the appropriate environment stores (Vercel and n8n) if not
  already done.

---

## 11. Verify the ISR revalidation endpoint exists in the Next.js app

Workflow 04 (Vercel Deployment) calls `POST https://mysitehq.com.au/api/revalidate`
with body `{ "slug": "...", "secret": "..." }`. This endpoint must exist in the
Next.js app and must:

1. Verify `secret` matches `NEXT_REVALIDATE_SECRET`.
2. Call `revalidatePath('/[slug]')` or the equivalent Next.js ISR revalidation
   for the customer's slug-based route.
3. Return `{ "revalidated": true }` on success.

- [ ] Confirm the file `app/api/revalidate/route.ts` (or `.js`) exists in the repo.
  If it does not exist, create it before deploying. This endpoint is load-bearing:
  without it, workflow 04 will throw an error and the site will not go live for
  new customers.

---

## 12. First end-to-end test

Run this test in a private/incognito browser window. Use Stripe test mode credentials
during this test (switch Stripe dashboard to Test mode, use Vercel Test environment
variables with test keys). Do this test before enabling live Stripe keys and before
turning on ads.

- [ ] Open `https://mysitehq.com.au/for/trades` in incognito mode.
- [ ] Fill in the form:
  - Business name: `Test Electrical`
  - Service type (niche): Electrician
  - Suburb: `Surry Hills NSW`
- [ ] Submit. Confirm the page redirects to `/building?lead_id=ld_...`.
- [ ] In n8n Executions, confirm workflow 01 (Lead Capture) shows status "Succeeded".
  If it shows "Failed", open the execution and read the error. Common causes:
  Turnstile secret not set, Supabase service role key wrong, or missing fields
  in the request body.
- [ ] In Supabase → Table Editor → `leads`, confirm a new row appeared with
  `status = 'new'`, then `status = 'gbp_found'` after a few seconds.
- [ ] In n8n Executions, confirm workflow 02 (GBP Lookup) shows "Succeeded".
- [ ] In n8n Executions, confirm workflow 03 (Site Generation) shows "Succeeded".
  Claude generation typically takes 10–30 seconds.
- [ ] In n8n Executions, confirm workflow 04 (Vercel Deployment) shows "Succeeded".
- [ ] The `/building` page should eventually navigate to `/preview/[lead_id]` or
  `https://test-electrical-surry-hills.mysitehq.com.au` (the slug is generated
  from the business name and suburb).
- [ ] In Supabase → `sites`, confirm a row exists with `status = 'preview'` and a
  non-null `permanent_url`.
- [ ] Open the `permanent_url` in your browser. The generated site should load.
- [ ] On the preview page (or the funnel's preview page), click "Save my site".
  Stripe Checkout should open.
- [ ] Complete checkout with Stripe's test card `4242 4242 4242 4242`, expiry any
  future date, CVC any 3 digits, postcode any 5 digits.
- [ ] In n8n Executions, confirm workflow 07 (Stripe Webhook Handler) shows
  "Succeeded".
- [ ] In n8n Executions, confirm workflow 08 (Post-Purchase Welcome) shows
  "Succeeded".
- [ ] In Twilio Console → Monitor → Logs → Messaging, confirm an SMS was sent to the
  number you used in the test (use your own mobile for testing).
- [ ] Check your email inbox for the welcome email. Confirm it arrived from
  `hello@mysitehq.com.au` with the correct subject line.
- [ ] In Supabase → `sites`, confirm the row now shows `status = 'live'` and
  `published_at` is set.
- [ ] In Supabase → `subscriptions`, confirm a row exists with the Stripe subscription
  ID and `status = 'active'`.
- [ ] Test expiry flow:
  - In Supabase → `sites`, find a row with `status = 'preview'` (create a new
    test lead if needed).
  - Edit the `expires_at` column value to 1 minute from now (use the Supabase
    Table Editor row editor).
  - Wait 1–6 minutes for workflow 05 to run on its 5-minute schedule.
  - Confirm the row's `status` changes to `'expired'`.
  - Confirm workflow 06 (Recovery Sequence) was triggered and shows "Succeeded"
    in Executions.
  - Confirm a recovery email arrived at the email address associated with that
    lead.
- [ ] Test recovery click: in the recovery email, click the recovery link. Confirm it
  leads to the correct page in the funnel.

Only proceed to Section 13 after all test steps above pass without errors.

---

## 13. Meta Ads setup

**COSTS MONEY / TOUCHES CREDENTIALS**

Complete this section only after the end-to-end test in Section 12 passes.

### 13a. Create Meta Business Manager

- [ ] Go to business.facebook.com. Log in with a personal Facebook account that you
  will use as the admin. Do not use a fake or throwaway account — Meta will flag
  it.
- [ ] Create a Business Manager: click "Create account", enter business name "Preview
  Factory" (or your trading name), your name, and business email.
- [ ] Complete business verification:
  - Business Manager → Settings → Business Info → Start Verification
  - You will need to provide ABN and potentially upload business registration
    documents. This process takes 1–5 business days.
  - Do not run ads until verification is complete.

### 13b. Create Ad Account

- [ ] In Business Manager → Accounts → Ad Accounts → Add → "Create a new ad account".
- [ ] Name: `Preview Factory — Trades`, currency: AUD, time zone: Australia/Sydney.
- [ ] Add payment: credit card (your business card). This card is charged automatically
  as you spend.
- [ ] Set a spending limit for the first month: in the ad account Settings → Billing
  → Account spending limit → set $1,000 AUD as a safety cap during testing.

### 13c. Connect a Facebook Page

- [ ] If you do not have a Facebook Page for Preview Factory, create one:
  Business Manager → Pages → Add → Create a new Page.
  Name: "Preview Factory", category: "Software", description: "Instant websites
  for Australian small businesses."
- [ ] Connect the page to your Business Manager and Ad Account.

### 13d. Install Meta Pixel

- [ ] In Events Manager → Connect Data Sources → Web → Meta Pixel.
- [ ] Name the pixel `preview-factory-pixel`.
- [ ] Copy the pixel ID (numeric, e.g. `1234567890`).
- [ ] Add the pixel base code to the Next.js app in `app/layout.tsx`. Use the `Script`
  component from `next/script` with strategy `afterInteractive`. The exact code
  snippet is available in Meta Events Manager → your pixel → "Continue" → "Install
  code manually".
- [ ] Add `NEXT_PUBLIC_META_PIXEL_ID=1234567890` to Vercel environment variables.
- [ ] Fire the "Lead" standard event on successful form submission (after the n8n
  webhook returns 200 and the user is redirected to `/building`). In Next.js, this
  is typically done with `fbq('track', 'Lead')` in the redirect handler.
- [ ] Verify the pixel is firing correctly: Meta Events Manager → Test Events → enter
  your site URL and watch for "Lead" events to appear in real time.

### 13e. Create first ad campaign

- [ ] Go to Ads Manager → Create.
- [ ] Campaign objective: "Leads" (not Traffic, not Conversions).
- [ ] Campaign name: `PF — Trades — Cold — [date]`.
- [ ] Budget: Campaign Budget Optimisation ON. Daily budget: $30 AUD/day.
- [ ] Ad Set:
  - Conversion location: Website
  - Performance goal: Maximise number of leads
  - Pixel: `preview-factory-pixel`
  - Conversion event: Lead
  - Targeting: Australia, All cities → add Job title targeting:
    - "Electrician"
    - "Plumber"
    - "Tradesperson"
    - "Self-employed tradesperson"
    - "Building contractor"
  - Age: 25–55
  - Placement: Manual → Facebook Feed, Instagram Feed. Remove Audience Network
    and Reels for the first test.
- [ ] Ad creative: upload a video or image showing the 60-second site build.
  Headline: "See your business website in 60 seconds." Primary text: "Type your
  business name. We do the rest. Free preview — no card needed."
  - Call to action button: "Learn More"
  - Destination URL: `https://mysitehq.com.au/for/trades?utm_source=meta&utm_medium=paid&utm_campaign=trades-cold`
- [ ] Publish the campaign. It will enter review (typically 24 hours).
- [ ] Create parallel campaigns for Allied Health, Beauty, and Fitness, each with
  relevant job title targeting and the correct landing page URL
  (`/for/allied-health`, `/for/beauty`, `/for/fitness`).

### 13f. Second Meta Business Manager (risk mitigation)

- [ ] Register a second personal Facebook account (use a real identity) and create a
  second Business Manager under a slightly different business name variant.
- [ ] Keep this second account dormant — no ads, no pixel events — until and unless
  the first account is restricted. Meta restrictions happen without warning;
  having a warm second account prevents complete ad channel loss.

---

## 14. Go-live verification

Run through this checklist the morning you intend to turn on live advertising.

**n8n**

- [ ] All 11 workflows imported and Active toggle is ON (green).
- [ ] Settings → Variables: all 21 variables from Section 9e are set.
- [ ] Executions history: no failed executions from the last 24 hours except those
  expected from the test run.

**Supabase**

- [ ] Table Editor: all 8 tables visible and populated with test data from Section 12.
- [ ] Realtime → Inspect: `build_progress` and `sites` tables appear in
  `supabase_realtime` publication.
- [ ] API settings: service_role key and anon key confirmed not rotated since
  Section 2.

**Vercel**

- [ ] Latest deployment shows green "Ready" badge.
- [ ] All 17 environment variables from Section 3d are set (check "Environment
  Variables" list — blank or missing values will show as empty strings).
- [ ] Domains: `mysitehq.com.au` and `*.mysitehq.com.au` both show "Valid
  Configuration".

**Stripe**

- [ ] Dashboard is in Live mode (not Test mode).
- [ ] Four products and prices are created; all four `STRIPE_PRICE_*` environment
  variables in Vercel match the live Price IDs.
- [ ] Webhook endpoint URL points to `https://n8n.mysitehq.com.au/webhook/stripe-webhook`
  and is enabled.
- [ ] Three webhook events selected: `checkout.session.completed`,
  `customer.subscription.deleted`, `invoice.payment_failed`.
- [ ] Customer Portal is enabled.
- [ ] Set up a Stripe alert for elevated dispute rate: Dashboard → Radar → Rules →
  or use Dashboard → Settings → Notifications → enable email alert for "Dispute
  rate exceeds 0.5%".

**Twilio**

- [ ] AU mobile number purchased and confirmed active.
- [ ] Console shows no geographic restrictions on outbound SMS for Australia.

**Postmark**

- [ ] Sender domain `mysitehq.com.au` verified (green tick on DKIM and SPF).
- [ ] All 10 templates created in the `preview-factory` server under the
  Transactional message stream.
- [ ] `POSTMARK_FROM_EMAIL` matches an address on the verified sender domain.

**Cloudflare**

- [ ] Turnstile widget is active. Site Key is in Vercel. Secret Key is in n8n.
- [ ] DNS: wildcard CNAME `*` → `cname.vercel-dns.com` (DNS only, grey cloud).
- [ ] DNS: A record `n8n` → Hetzner IP (DNS only).
- [ ] DNS: Postmark DKIM TXT record present.
- [ ] DNS: Postmark Return-Path CNAME `pm-bounces` → `pm.mtasv.net` present.

**Meta Ads**

- [ ] Business Manager verified (green "Verified" badge in Business Info settings).
- [ ] Ad account not restricted (no red banner in Ads Manager).
- [ ] Pixel firing correctly for "Lead" events (confirmed via Events Manager →
  Test Events).
- [ ] Campaigns in review or approved (not "Not delivering").

**Compliance and monitoring**

- [ ] Confirm Privacy Policy page exists on `mysitehq.com.au/privacy` covering:
  Australian Privacy Act 1988, Australian Spam Act 2003 (opt-in consent wording),
  how customer data is stored (Supabase, Singapore region), and how to request
  deletion.
- [ ] Confirm Terms of Service page exists on `mysitehq.com.au/terms`.
- [ ] Register for GST if 12-month projected revenue exceeds $75,000 AUD. GST
  registration is free via the ABR portal (abr.business.gov.au). Add GST amounts
  to your Stripe product prices if registered.
- [ ] Bookmark `https://n8n.mysitehq.com.au/executions` and check it daily for the
  first two weeks of live operation. A failed execution is a customer who did not
  get their site — investigate and resolve within the same business day.
- [ ] Set a calendar reminder every 3 months to rotate the Vercel API token, Supabase
  service role key, and Postmark server token.
- [ ] Set a calendar reminder every month to check the Outscraper credit balance and
  top up if below $5 USD.

---

## Appendix A: Estimated recurring costs

All prices are approximate at June 2026 and subject to change.

| Service | Plan | Cost |
|---|---|---|
| Hetzner VPS CX21 | Pay as you go | ~AU$10/mo |
| Vercel Pro | Monthly | ~AU$32/mo |
| Supabase Free | Free | $0 |
| Supabase Pro (if pg_cron needed) | Monthly | ~AU$40/mo |
| Cloudflare | Free | $0 |
| Stripe | Per transaction | 1.7% + $0.30 AUD per charge |
| Twilio AU number | Monthly | ~AU$2.50/mo |
| Twilio SMS | Per SMS | ~AU$0.07/SMS |
| Postmark | 100 emails/mo free, then pay per use | $0 to start |
| Outscraper | Pay as you go | ~AU$0.003/lookup |
| Anthropic Claude | Pay as you go | ~USD$0.003–$0.015/generation |
| mysitehq.com.au domain | Annual | ~AU$20/yr |
| Meta Ads | Daily budget | AU$30+/day when active |

---

## Appendix B: Troubleshooting quick reference

**Workflow 01 fails with "Security check failed"**
Cloudflare Turnstile secret key in n8n Variables is wrong or the site key in
Vercel does not match the Turnstile site. Verify both in the Cloudflare Turnstile
dashboard.

**Workflow 02 fails with "No GBP results"**
Outscraper API key invalid or credit balance is zero. Check
outscraper.com/dashboard. Also possible: business name + suburb combination
returned no Google results — this is expected for some test inputs.

**Workflow 03 fails with "Authentication error" from Anthropic**
The `ANTHROPIC_API_KEY` in n8n Variables is incorrect or the key has been
revoked. Regenerate a new key at console.anthropic.com/api-keys.

**Workflow 04 fails with "Revalidation failed" or 404**
The `/api/revalidate` endpoint does not exist in the Next.js app. See Section 11.
Also check that `NEXT_REVALIDATE_SECRET` matches between Vercel and n8n.

**Workflow 07 fails with "Missing lead_id in metadata"**
The Stripe Checkout session was not created with `metadata.lead_id`. See Section 4d.
This is a code change required in the checkout session creation logic.

**Workflow 07 fails with "Stripe signature verification failed"**
The `STRIPE_WEBHOOK_SECRET` in n8n does not match the signing secret shown in
Stripe Dashboard → Webhooks → your endpoint → Signing Secret. Re-copy and update.

**Supabase Realtime not updating the /building page**
Check that both `build_progress` and `sites` are in the `supabase_realtime`
publication (Section 2d). Check that the Supabase anon key in Vercel is correct.

**Site subdomain returns 404 or Vercel error**
The wildcard CNAME `*` in Cloudflare is either missing, has the proxy (orange
cloud) enabled, or the Vercel alias was not created. Check workflow 04 execution
for the "Create Vercel Alias" step. Ensure the alias `slug.mysitehq.com.au` was
created via the Vercel API.

**n8n shows "Execution failed" for scheduled workflow 05**
Check that n8n has an internet connection to Supabase (try a test HTTP request
node to `$vars.SUPABASE_URL`). Also check that workflow 05 is Active (not paused).
