import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    // Templates pull hero / gallery / about imagery from remote URLs in props.
    // Allow common image CDNs used by example data and generated configs.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.unsplash.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      // Pexels — used by the CustomisePanel stock-image search and the
      // image-assembler's Pexels fallback.
      { protocol: "https", hostname: "images.pexels.com" },
      // Google Places photo CDN — used by image-assembler when a business
      // has GBP photos. URLs come back as places.googleapis.com redirects
      // resolved to lh3.googleusercontent.com (covered above) but the
      // pre-resolved photoUri may also use this host.
      { protocol: "https", hostname: "places.googleapis.com" },
      // Supabase Storage — user-uploaded logos / hero images / gallery slots
      // (Phase 6). Wildcard covers both dev and prod projects without
      // per-env config edits.
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  // Security headers applied to every response.
  //
  // CSP (Phase 11e-follow-up) is in enforce mode. Directives were chosen
  // by walking each real dependency the app has (Next.js runtime, next/font
  // self-hosting, Stripe redirect, Sentry tunnel, image hosts from the
  // remotePatterns block above). Violations POST to /api/csp-report which
  // forwards to Sentry — filter by `source:csp` to see them.
  //
  // Note on 'unsafe-inline' + 'unsafe-eval' in script-src: Next 16's
  // runtime injects inline hydration scripts + uses eval in the client
  // bundle. Removing either would require a nonce-per-request middleware
  // refactor. Practical trade-off: CSP still buys us frame-ancestors,
  // form-action, base-uri, object-src, and connect-src lockdown.
  async headers() {
    const csp = [
      "default-src 'self'",
      // static.cloudflareinsights.com serves the Web Analytics beacon.
      // Cloudflare auto-injects the script tag when a site is proxied
      // through their edge (launcharoo.online + BYO customer domains).
      // Can't remove it from the response HTML from our side.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      // Fonts are self-hosted via next/font — no external font CDN needed.
      "font-src 'self' data:",
      // Match the image hosts from the images.remotePatterns block above.
      // data: covers Tailwind inline SVGs; blob: covers browser upload previews.
      "img-src 'self' data: blob: https://*.unsplash.com https://*.cloudinary.com https://*.amazonaws.com https://*.googleusercontent.com https://images.pexels.com https://places.googleapis.com https://*.supabase.co",
      // Same-origin covers Sentry via /monitoring tunnel. Direct-ingest hosts
      // are the fallback if the tunnel ever fails. Supabase for client-side
      // storage reads (Phase 6 upload flow uses signed URLs — same-origin —
      // but leave the allowlist in case). cloudflareinsights.com is where the
      // Web Analytics beacon POSTs page-view events back.
      "connect-src 'self' https://*.supabase.co https://*.ingest.us.sentry.io https://*.ingest.sentry.io https://cloudflareinsights.com",
      // 'self' is required for the /preview/[id] page which embeds
      // /preview/site/[id] in an iframe for the customise pane. Stripe
      // hosts are here for hosted Checkout (redirect today; embed later).
      "frame-src 'self' https://checkout.stripe.com https://js.stripe.com",
      // Checkout form submits redirect to Stripe.
      "form-action 'self' https://checkout.stripe.com",
      // Nothing legitimate embeds objects.
      "object-src 'none'",
      // Prevent <base href="..."> injection changing all relative URLs.
      "base-uri 'self'",
      // Reinforces X-Frame-Options DENY.
      "frame-ancestors 'none'",
      // Auto-upgrade any accidental http:// asset link.
      "upgrade-insecure-requests",
      // Violations POST here — see app/api/csp-report/route.ts.
      "report-uri /api/csp-report",
    ].join("; ");

    const securityHeaders = [
      // Force HTTPS for 2 years, cover all subdomains. `preload` lets us
      // ship the domain to hstspreload.org so browsers refuse HTTP even on
      // first visit. Do NOT add to preload list until we're confident the
      // whole *.launcharoo.online tree is HTTPS-only forever.
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      // Block MIME sniffing — the browser trusts the Content-Type header
      // and won't try to guess based on file contents. Cheap XSS defence.
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Nobody legitimate frames Preview Factory. DENY closes clickjacking.
      { key: "X-Frame-Options", value: "DENY" },
      // Send referrer to same-origin, only origin (no path) cross-origin.
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Deny browser features we don't use. `payment=(self)` keeps Stripe
      // Checkout redirects working on same-origin.
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(self)",
      },
      { key: "Content-Security-Policy", value: csp },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "pracxcel",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
