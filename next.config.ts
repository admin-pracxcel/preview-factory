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
    ],
  },
};

export default nextConfig;
