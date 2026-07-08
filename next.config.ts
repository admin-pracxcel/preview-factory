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
};

export default withSentryConfig(nextConfig, {
  // Source-map upload is skipped locally (no SENTRY_AUTH_TOKEN). On Vercel
  // Prod the token is set, so maps upload as part of the build.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Reduce build noise. Only print warnings/errors, not per-chunk info.
  silent: !process.env.CI,

  // Widen the source-map upload beyond the default so server-side stacks
  // resolve to original TS lines in Sentry. Small build cost.
  widenClientFileUpload: true,

  // Sentry proxies error events through the app's own origin, so ad
  // blockers don't drop them. Requires no extra route — Sentry SDK
  // registers /monitoring automatically.
  tunnelRoute: "/monitoring",

  // Sentry v10 wraps React Server Components to capture errors thrown
  // during render. Small runtime cost, big observability win.
  reactComponentAnnotation: { enabled: true },
});
