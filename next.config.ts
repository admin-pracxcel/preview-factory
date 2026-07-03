import type { NextConfig } from "next";

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

export default nextConfig;
