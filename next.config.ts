import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // better-sqlite3 is a native module — Next must not try to bundle it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
