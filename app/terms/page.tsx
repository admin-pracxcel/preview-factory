import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Launcharoo",
  description:
    "The terms of your Launcharoo subscription, including cancellation, refunds under Australian Consumer Law, and acceptable use.",
};

/**
 * Terms of Service
 *
 * Placeholder-safe: business name and ABN in [brackets]. Refund policy is
 * statutory-only (Australian Consumer Law); no promise beyond ACL rights.
 * Governing law: Victoria. Aligns with the founder's stated launch stance.
 *
 * This is a solid drafting starting point. A lawyer should review before
 * real customers arrive, especially clauses 6 (Refunds), 12 (Liability),
 * and 14 (Governing law).
 */
export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-white/50">Last updated: 8 July 2026</p>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">1. Agreement</h2>
          <p>
            These Terms of Service are an agreement between Launcharoo (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
            &ldquo;our&rdquo;) and you, the person who signs up for and uses the service (&ldquo;you&rdquo;,
            &ldquo;your&rdquo;). By using Launcharoo you agree to these terms.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">2. The service</h2>
          <p>
            Launcharoo generates and hosts a business website based on the information you provide.
            You can customise the design, request plain-English changes to the content, and connect a
            custom domain you already own.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">3. Your account</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You sign in through a magic-link sent to your email — no password to lose</li>
            <li>Keep your email account secure. Anyone with access to it can sign in to Launcharoo</li>
            <li>You&rsquo;re responsible for activity on your account</li>
            <li>Tell us promptly at <a className="text-blue-400 underline" href="mailto:hello@launcharoo.online">hello@launcharoo.online</a> if you suspect unauthorised access</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">4. Subscription and payment</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Launcharoo is a monthly subscription, charged on the day you sign up and every month after</li>
            <li>Payments are processed by Stripe. Your card details are held by Stripe, not us</li>
            <li>Prices are as shown at checkout. We can change prices with at least 30 days notice by email; changes apply to your next billing cycle</li>
            <li>All amounts are in AUD unless stated otherwise. GST is included where applicable</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">5. Cancellation</h2>
          <p>
            You can cancel your subscription at any time from the billing portal linked in your dashboard.
            Cancellation stops future charges. Your site stays live until the end of the billing period
            you already paid for. After that period, the site is marked expired; content is retained for
            30 days in case you change your mind, then permanently deleted.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">6. Refunds</h2>
          <p>
            Refunds are provided in accordance with your rights under the Australian Consumer Law (ACL).
            Our services come with guarantees under the ACL that cannot be excluded. If we fail to meet a
            consumer guarantee — for example, if the service has a major failure — you are entitled to a
            replacement or refund and, where the failure amounts to a major failure, to compensation for
            reasonably foreseeable loss or damage.
          </p>
          <p>
            Outside those statutory rights, we do not offer general refunds for a change of mind. Cancel
            anytime through your billing portal to avoid the next billing cycle.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">7. Your content</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You own the content you provide — business information, images, logos, edits</li>
            <li>You grant us a non-exclusive licence to host, display, and process that content for the sole purpose of running the service</li>
            <li>You warrant you have the right to use the content you upload, including any images and third-party content</li>
            <li>You&rsquo;re responsible for the accuracy of information shown on your site</li>
            <li>We may remove content that breaches these terms or applicable law</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">8. Our content</h2>
          <p>
            We own the Launcharoo templates, code, design frameworks, and other intellectual property
            behind the service. Your subscription lets you use them to run your website while you&rsquo;re
            an active customer. You don&rsquo;t get a licence to resell, copy, or reuse our templates
            elsewhere.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">9. Acceptable use</h2>
          <p>Don&rsquo;t use Launcharoo for:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Anything illegal under Australian law</li>
            <li>Content that infringes copyright, trade marks, or other intellectual property</li>
            <li>Spam, phishing, or misleading and deceptive conduct</li>
            <li>Content that harasses, defames, or endangers others</li>
            <li>Any activity that harms the service, our infrastructure, or other users</li>
          </ul>
          <p>We can suspend or terminate accounts that breach this clause.</p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">10. Third-party services</h2>
          <p>
            The service relies on sub-processors listed in our{" "}
            <Link href="/privacy" className="text-blue-400 underline">Privacy Policy</Link>. Their own
            terms apply to their part of the service. Interruptions or changes to those services can
            affect Launcharoo; we&rsquo;ll work in good faith to minimise disruption but aren&rsquo;t
            liable for issues caused by upstream providers.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">11. Availability</h2>
          <p>
            We aim for high availability but don&rsquo;t guarantee uninterrupted service. Planned
            maintenance will be announced in advance where practical. Emergency maintenance may be
            performed without notice.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">12. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, we&rsquo;re not liable for indirect, incidental,
            or consequential loss, or for loss of revenue, profits, goodwill, or data. Our total
            aggregate liability to you in any 12-month period is limited to the total fees you paid
            us in that period.
          </p>
          <p>
            Nothing in these terms excludes, restricts, or modifies any right or remedy you have under
            the Australian Consumer Law or any other law that cannot lawfully be excluded, restricted,
            or modified.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">13. Changes to these terms</h2>
          <p>
            We can update these terms. We&rsquo;ll change the &ldquo;Last updated&rdquo; date at the top
            and email active customers at least 30 days before material changes take effect. Continuing
            to use Launcharoo after that period means you accept the updated terms.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">14. Governing law and jurisdiction</h2>
          <p>
            These terms are governed by the laws of Victoria, Australia. You and we submit to the
            exclusive jurisdiction of the courts of Victoria for any dispute arising out of or in
            connection with these terms.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">15. Contact</h2>
          <p>
            Launcharoo<br />
            Email: <a className="text-blue-400 underline" href="mailto:hello@launcharoo.online">hello@launcharoo.online</a>
          </p>
        </section>

        <footer className="mt-16 border-t border-white/10 pt-6 text-sm text-white/40">
          <Link href="/" className="hover:text-white/70">Back to Launcharoo</Link>
          <span className="mx-3">·</span>
          <Link href="/privacy" className="hover:text-white/70">Privacy Policy</Link>
        </footer>
      </main>
    </div>
  );
}
