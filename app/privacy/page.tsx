import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Launcharoo",
  description:
    "How Launcharoo collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-4">
          This policy explains how we handle personal information. It applies
          to the Launcharoo website and service.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">1. What we collect</h2>
          <p>We collect the following kinds of personal information:</p>
          <p>
            <span className="font-semibold text-white">Information you give us.</span>{" "}
            Your name, business name, email address, phone number, business
            address and business details, and information you send us when you
            contact us or request a change to your site.
          </p>
          <p>
            <span className="font-semibold text-white">Payment information.</span>{" "}
            Payments are processed by a third-party payment provider. We receive
            confirmation of payment and limited billing details. We do not
            collect or store full payment card numbers.
          </p>
          <p>
            <span className="font-semibold text-white">
              Information from publicly available sources.
            </span>{" "}
            To generate your site, we collect business information that is
            publicly available, including from business listing services. This
            may include your business name, address, phone number, opening
            hours, categories, services and images.
          </p>
          <p>
            <span className="font-semibold text-white">
              Information collected automatically.
            </span>{" "}
            When you use our website or a site we host, we and our service
            providers may collect technical information such as IP address,
            device and browser type, pages viewed, referring pages, and
            interactions with the site.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">2. How we collect it</h2>
          <p>
            We collect personal information directly from you when you use the
            service or contact us, automatically when you or a visitor uses a
            site, and from publicly available sources and third-party providers.
          </p>
          <p>
            Where we collect personal information about you from someone other
            than you, we take reasonable steps to make sure you are aware of
            this policy.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">3. Why we use it</h2>
          <p>We use personal information to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>provide, operate, maintain and improve the service</li>
            <li>generate, publish, host and update sites</li>
            <li>process payments and manage subscriptions</li>
            <li>communicate with you about your account and the service</li>
            <li>provide support and respond to enquiries</li>
            <li>monitor and protect the security and integrity of the service</li>
            <li>comply with our legal obligations</li>
            <li>
              send you information about the service, where you have not opted
              out
            </li>
          </ul>
          <p>
            We will not use your personal information for a purpose unrelated
            to those above unless you would reasonably expect it, you have
            consented, or we are required or permitted by law.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">4. Automated processing</h2>
          <p>
            Sites are generated using automated processes, including artificial
            intelligence. These processes use business information collected
            from you and from publicly available sources to produce website
            content.
          </p>
          <p>
            We do not use automated processing to make decisions that produce
            legal effects for you or that significantly affect you.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">5. Who we share it with</h2>
          <p>We may disclose personal information to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              service providers who help us operate the service, including
              hosting, data storage, payment processing, communications,
              analytics, error monitoring, telephony and workflow automation
              providers
            </li>
            <li>professional advisers, including lawyers and accountants</li>
            <li>a purchaser or prospective purchaser of our business or assets</li>
            <li>
              anyone else with your consent, or where we are required or
              permitted by law
            </li>
          </ul>
          <p>
            We require our service providers to handle personal information
            only for the purposes of providing services to us.
          </p>
          <p>We do not sell personal information.</p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">6. Overseas disclosure</h2>
          <p>
            Some of our service providers store or process information outside
            Australia. The countries in which they operate include the United
            States and countries in the European Union, and may change from
            time to time as our providers change.
          </p>
          <p>
            By using the service you acknowledge that where personal
            information is disclosed to an overseas recipient, Australian
            Privacy Principle 8.1 will not apply to that disclosure, and that
            we will not be accountable under the Privacy Act 1988 (Cth) for
            that recipient, and you may not be able to seek redress under that
            Act.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">7. How we hold it</h2>
          <p>
            We hold personal information electronically with third-party
            hosting and storage providers.
          </p>
          <p>
            We take reasonable steps to protect personal information from
            misuse, interference, loss, and unauthorised access, modification
            or disclosure. No method of transmission or storage is completely
            secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">8. How long we keep it</h2>
          <p>
            We keep personal information for as long as we need it for the
            purposes set out in this policy, and for as long as required by
            law. When we no longer need it, we take reasonable steps to destroy
            it or de-identify it.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">
            9. Cookies and similar technologies
          </h2>
          <p>
            We and our service providers use cookies and similar technologies
            to operate the website, remember your session, and understand how
            the service is used.
          </p>
          <p>
            You can control cookies through your browser settings. Disabling
            cookies may affect how the service works.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">
            10. Accessing and correcting your information
          </h2>
          <p>
            You can ask us for access to the personal information we hold
            about you, and ask us to correct it if it is inaccurate, out of
            date, incomplete, irrelevant or misleading.
          </p>
          <p>
            Contact us at{" "}
            <a
              className="text-blue-400 underline"
              href="mailto:hello@launcharoo.com.au"
            >
              hello@launcharoo.com.au
            </a>
            . We will respond within a reasonable period. We may need to
            verify your identity first. If we refuse a request, we will tell
            you why in writing where we are required to.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">11. Complaints</h2>
          <p>
            If you think we have breached the Australian Privacy Principles or
            mishandled your personal information, contact us at{" "}
            <a
              className="text-blue-400 underline"
              href="mailto:hello@launcharoo.com.au"
            >
              hello@launcharoo.com.au
            </a>{" "}
            and we will investigate and respond to you.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">
            12. Sites we host for our customers
          </h2>
          <p>
            Where we host a site for a business customer, that customer is
            responsible for their own privacy practices, including any
            information collected through their site. This policy covers our
            own handling of personal information, not theirs.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-bold text-white">13. Changes to this policy</h2>
          <p>
            We may update this policy. The current version will always be
            available at this address.
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
