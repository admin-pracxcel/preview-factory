import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Launcharoo",
  description:
    "The terms that govern your use of Launcharoo.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white/85">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <Link href="/" aria-label="Launcharoo">
            <img
              src="/images/launcharoo-logo-white.webp"
              alt="Launcharoo"
              className="h-6 w-auto"
            />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed">
        <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-4">
          These Terms govern your use of Launcharoo. By creating an account,
          publishing a site or paying a subscription fee, you agree to them.
          If you do not agree, do not use the service.
        </p>
        <p className="mt-4">
          In these Terms, &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo;
          mean that entity, and &ldquo;you&rdquo; means the person or business
          using the service.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">1. What the service is</h2>
          <p>
            Launcharoo generates and hosts a website for your business using
            information from publicly available sources, including your Google
            Business Profile, together with information you provide.
          </p>
          <p>
            We may add, change, or remove features at any time. Nothing in
            these Terms guarantees any particular feature, page count, layout,
            design, hosting arrangement, or level of availability.
          </p>
          <p>
            We do not guarantee that the service will be uninterrupted, error
            free, or available at any particular time.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">2. Eligibility</h2>
          <p>
            You must be at least 18 years old and authorised to act for the
            business you are creating a site for. You must not create a site
            for a business you do not own or are not authorised to represent.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">3. Your account</h2>
          <p>
            You are responsible for your account, for keeping your login
            details secure, and for everything done through your account. Tell
            us promptly at{" "}
            <a
              className="text-blue-400 underline"
              href="mailto:hello@launcharoo.com.au"
            >
              hello@launcharoo.com.au
            </a>{" "}
            if you believe your account has been accessed without your
            authorisation.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">
            4. Your content and your responsibility for it
          </h2>
          <p>
            You are responsible for everything published on your site. This
            includes content generated automatically from your Google Business
            Profile or from information you supply, and any content you or
            anyone acting for you adds, edits or requests.
          </p>
          <p>
            You must review your site before it is published and monitor it
            afterwards. You are responsible for confirming that everything on
            it is accurate, current and lawful.
          </p>
          <p>You must not use the service to publish content that:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>is false, misleading, or deceptive</li>
            <li>infringes anyone&rsquo;s intellectual property or other rights</li>
            <li>
              breaches any law, industry code, professional standard, or
              regulatory requirement that applies to your business or
              profession
            </li>
            <li>is unlawful, defamatory, offensive, or harmful</li>
          </ul>
          <p>
            <span className="font-semibold text-white">Regulated industries.</span>{" "}
            If your business is subject to advertising or professional conduct
            rules, including but not limited to health practitioner
            advertising requirements, financial services rules, or legal
            practice rules, you are solely responsible for ensuring your site
            complies with them. We do not review sites for regulatory
            compliance and nothing about the service should be taken as advice
            that any site complies with any law, code or standard.
          </p>
          <p>
            You grant us a licence to host, display, store, reproduce, and
            modify your content for the purpose of providing the service.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">
            5. Automatically generated content
          </h2>
          <p>
            Sites are generated using automated processes, including
            artificial intelligence, drawing on third-party data sources.
          </p>
          <p>
            Automatically generated content may contain errors, omissions or
            inaccuracies. It may reflect out of date or incorrect information
            held by a third party. It is your responsibility to check it.
          </p>
          <p>
            We do not warrant the accuracy, completeness, or suitability of
            any generated content for any purpose.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">
            6. Fees, billing and cancellation
          </h2>
          <p>
            Subscription fees are shown at checkout in Australian dollars.
            Fees are billed in advance on a recurring basis until cancelled.
          </p>
          <p>
            Payments are processed by a third-party payment provider. We do
            not store your full card details.
          </p>
          <p>
            We may change our fees. If we do, we will give you notice before
            the change applies to your subscription, and the change will take
            effect at your next billing date.
          </p>
          <p>You may cancel at any time through your billing portal. On cancellation:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>your subscription will not renew</li>
            <li>
              your site will remain available until the end of the period you
              have paid for
            </li>
            <li>we may remove your site and associated data after that period ends</li>
          </ul>
          <p>
            We may suspend or terminate your access if you breach these Terms,
            if payment fails, or if we reasonably believe your use of the
            service creates a legal or security risk.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">7. Refunds</h2>
          <p>Fees are not refundable, including for partial billing periods.</p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">8. Domains</h2>
          <p>
            If you connect a domain you own, you remain responsible for
            registering, renewing and controlling it. We are not responsible
            for a domain expiring, being transferred, or being suspended.
          </p>
          <p>
            If your site is published on a domain or subdomain we provide,
            that address remains ours and you have no right to it after your
            subscription ends.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">9. Intellectual property</h2>
          <p>
            We own the service, including its software, systems, templates,
            designs and branding. Nothing in these Terms transfers ownership
            of any of that to you.
          </p>
          <p>
            While your subscription is active, you have a non-exclusive,
            non-transferable right to use the site we host for you, for your
            own business.
          </p>
          <p>
            You retain ownership of content you own and supply. Third-party
            content, including images sourced from external providers, remains
            subject to the licence terms of its provider.
          </p>
          <p>
            You must not copy, resell, sublicense, reverse engineer, or
            attempt to extract the underlying software or systems.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">
            10. Third-party services and data
          </h2>
          <p>
            The service relies on third-party providers and data sources,
            including hosting, payment, communications and business listing
            data.
          </p>
          <p>
            We are not responsible for the acts, omissions, availability,
            accuracy or content of any third party. Where a third-party source
            contains incorrect information about your business, correcting it
            with that provider is your responsibility.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">
            11. Australian Consumer Law
          </h2>
          <p>
            Nothing in these Terms excludes, restricts or modifies any
            consumer guarantee, right or remedy under the Australian Consumer
            Law that cannot lawfully be excluded, restricted or modified.
          </p>
          <p>
            Where we are permitted to limit our liability for a breach of a
            consumer guarantee, our liability is limited, at our option, to
            resupplying the service or paying the cost of having it
            resupplied.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">
            12. Disclaimers and limitation of liability
          </h2>
          <p>Subject to clause 11 and to the extent permitted by law:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              The service is provided on an &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; basis, without warranties of any kind, whether
              express or implied.
            </li>
            <li>
              We make no representation that your site will achieve any
              particular result, including any level of search ranking,
              visibility, traffic, enquiries, calls, leads, conversions or
              revenue.
            </li>
            <li>
              We are not liable for any indirect, incidental, special or
              consequential loss, or for loss of profit, revenue, business,
              goodwill, data, or anticipated savings, however arising.
            </li>
            <li>
              Our total aggregate liability to you arising out of or in
              connection with the service, whether in contract, tort, statute
              or otherwise, is limited to the total fees you paid us in the
              three months immediately before the event giving rise to the
              liability.
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">13. Indemnity</h2>
          <p>
            To the extent permitted by law, you indemnify us against any
            claim, loss, liability, cost or expense arising from:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>content published on your site</li>
            <li>your breach of these Terms</li>
            <li>
              your breach of any law, code, professional standard or
              regulatory requirement
            </li>
            <li>
              any claim by a third party relating to your business or your site
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">14. Changes to these Terms</h2>
          <p>
            We may update these Terms. The current version will always be
            available at this address. Material changes will take effect at
            your next billing date, or 30 days after we post them, whichever
            is later. Continuing to use the service after that means you
            accept the updated Terms.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">15. General</h2>
          <p>
            These Terms are governed by the laws of Victoria, Australia, and
            you submit to the exclusive jurisdiction of the courts of that
            State.
          </p>
          <p>
            If any provision is found to be unenforceable, it is severed and
            the rest continues to apply.
          </p>
          <p>Our failure to enforce any provision is not a waiver of it.</p>
          <p>
            These Terms are the entire agreement between us about the service
            and replace any earlier understanding.
          </p>
          <p>
            You may not transfer your rights under these Terms without our
            written consent. We may transfer ours.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">16. Contact</h2>
          <p>
            <a
              className="text-blue-400 underline"
              href="mailto:hello@launcharoo.com.au"
            >
              hello@launcharoo.com.au
            </a>
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
