import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@opennextjs/cloudflare"],
};

export default nextConfig;
