import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Launcharoo",
  description:
    "How Launcharoo collects, uses, stores, and protects your personal information. Compliant with the Australian Privacy Principles.",
};

/**
 * Privacy Policy
 *
 * Placeholder-safe: business name and ABN are marked [in brackets] so the
 * founder can fill them in before public launch without editing the shape
 * of the document.
 *
 * Aligns with the Australian Privacy Principles (APPs) under the Privacy
 * Act 1988. Retention windows match the actual housekeeping cron. This is
 * a solid starting draft — it should still be reviewed by a lawyer before
 * real customers arrive.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white/85">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="font-[family-name:var(--font-sora)] text-lg font-extrabold text-white"
          >
            Launcharoo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed">
        <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-white/50">Last updated: 8 July 2026</p>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">1. About this policy</h2>
          <p>
            This policy explains how [Business Name] (ABN [ABN]) (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
            handles your personal information when you use Launcharoo (this website and the site-building
            service). We comply with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).
          </p>
          <p>
            If anything below is unclear, email <a className="text-blue-400 underline" href="mailto:admin@pracxcel.com.au">admin@pracxcel.com.au</a>{" "}
            and we&rsquo;ll explain in plain language.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">2. What we collect</h2>
          <p>Only what we need to run the service.</p>
          <p className="font-semibold text-white">Information you give us directly</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Business name, niche, suburb, and category when you fill in the intake form</li>
            <li>Your email address at checkout, and any owner-supplied phone number</li>
            <li>Payment details entered at checkout — processed by Stripe. We never see or store your full card number</li>
            <li>Content you add or change: logo, hero image, plain-English edit requests</li>
            <li>Custom domain names you connect and DNS records we scan to preserve email</li>
          </ul>
          <p className="font-semibold text-white">Information collected automatically</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your IP address and browser/device information</li>
            <li>An anonymous session cookie (<code className="rounded bg-white/10 px-1 py-0.5 text-sm">pf_session</code>) that links your browser to sites you create before you claim them</li>
            <li>Aggregate page-view statistics via Cloudflare Web Analytics. No cross-site tracking or third-party marketing cookies</li>
          </ul>
          <p className="font-semibold text-white">Information from third parties</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Public information about your business from Google Business Profile at intake, used to generate the first draft of your site</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">3. How we use your information</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Generate, host, and maintain your website</li>
            <li>Send transactional emails (magic-link sign-in, billing receipts, service notifications)</li>
            <li>Support you when you contact us</li>
            <li>Detect and prevent fraud, spam, and abuse (rate limiting, error monitoring)</li>
            <li>Improve the product using aggregate, non-identifying usage patterns</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>
            We do not sell your information. We do not use it for third-party advertising. We do not train
            machine-learning models on your content without your explicit consent.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">4. Who we share it with</h2>
          <p>
            We use trusted sub-processors to run parts of the service. Each is bound by their own privacy
            obligations and only receives the minimum data needed for their function.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><span className="font-semibold text-white">Supabase</span> — database and file storage (United States)</li>
            <li><span className="font-semibold text-white">Vercel</span> — application hosting (United States)</li>
            <li><span className="font-semibold text-white">Stripe</span> — payment processing (Australia and United States)</li>
            <li><span className="font-semibold text-white">Resend</span> — transactional email delivery (United States)</li>
            <li><span className="font-semibold text-white">Sentry</span> — error monitoring (United States)</li>
            <li><span className="font-semibold text-white">Cloudflare</span> — content delivery, DNS, and aggregate analytics (global)</li>
            <li><span className="font-semibold text-white">n8n</span> — workflow automation (self-hosted infrastructure)</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">5. International data transfers</h2>
          <p>
            Some sub-processors above are outside Australia. When we transfer your personal information
            overseas we take reasonable steps to ensure it is handled in a way consistent with the APPs.
            These steps include contractual obligations on the sub-processor and, where available,
            encryption in transit and at rest.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">6. Cookies</h2>
          <p>We use only cookies that are necessary for the service:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><code className="rounded bg-white/10 px-1 py-0.5 text-sm">pf_session</code> — first-party session identifier, valid for 30 days</li>
            <li>Cloudflare security and aggregate analytics cookies</li>
          </ul>
          <p>No third-party marketing or tracking cookies. No cross-site profiling.</p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">7. How long we keep it</h2>
          <p>Retention matches how long the data is useful for running the service.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Session cookies: 30 days from last use</li>
            <li>Magic-link tokens: 7 days</li>
            <li>Orphaned browser sessions with no linked site: 90 days</li>
            <li>Expired sites: content blanked 30 days after expiry, minimal metadata retained</li>
            <li>Captured enquiries on your site: kept while your subscription is active, deleted with your site on request</li>
            <li>Billing records: kept as required by law (typically 7 years)</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">8. Your rights</h2>
          <p>Under the Privacy Act and APPs you can:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-semibold text-white">Access your data</span> — the &ldquo;Your data&rdquo; card
              on your dashboard lets you download a full JSON copy of your site, leads, and edit-request history,
              plus a CSV of leads. Anytime, no questions asked.
            </li>
            <li>
              <span className="font-semibold text-white">Correct inaccurate information</span> — edit directly
              from the dashboard, or email us
            </li>
            <li>
              <span className="font-semibold text-white">Request deletion</span> — email us and we&rsquo;ll
              action within a reasonable timeframe unless a legal obligation requires us to retain the data
            </li>
            <li>
              <span className="font-semibold text-white">Complain</span> — contact us first at{" "}
              <a className="text-blue-400 underline" href="mailto:admin@pracxcel.com.au">admin@pracxcel.com.au</a>.
              If unresolved, you can complain to the Office of the Australian Information Commissioner (OAIC)
              at <a className="text-blue-400 underline" href="https://www.oaic.gov.au" target="_blank" rel="noreferrer">www.oaic.gov.au</a> or 1300 363 992
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">9. Security</h2>
          <p>
            We protect your information with practical safeguards: TLS encryption in transit, encrypted
            storage at rest through our providers, session cookies with HttpOnly and SameSite flags,
            rate limiting on sensitive endpoints, Content-Security-Policy on every response, and
            server-side error monitoring so we notice problems quickly.
          </p>
          <p>
            No system is completely secure. If we ever have a data breach that&rsquo;s likely to cause you
            serious harm, we&rsquo;ll notify you and the OAIC as required by the Notifiable Data Breaches scheme.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">10. Children</h2>
          <p>
            Launcharoo is not directed at people under 18. We do not knowingly collect personal information
            from children. If you believe we have, please contact us and we&rsquo;ll delete it.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">11. Changes to this policy</h2>
          <p>
            If we update this policy, we&rsquo;ll change the &ldquo;Last updated&rdquo; date at the top and,
            for material changes, email active customers at least 30 days before the change takes effect.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">12. Contact</h2>
          <p>
            [Business Name]<br />
            Email: <a className="text-blue-400 underline" href="mailto:admin@pracxcel.com.au">admin@pracxcel.com.au</a>
          </p>
        </section>

        <footer className="mt-16 border-t border-white/10 pt-6 text-sm text-white/40">
          <Link href="/" className="hover:text-white/70">Back to Launcharoo</Link>
          <span className="mx-3">·</span>
          <Link href="/terms" className="hover:text-white/70">Terms of Service</Link>
        </footer>
      </main>
    </div>
  );
}
