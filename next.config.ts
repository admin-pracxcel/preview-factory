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
