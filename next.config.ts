import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  // Static export doesn't support trailing slash redirects for API — we use Pages Functions for API
  trailingSlash: false,
};

export default nextConfig;
