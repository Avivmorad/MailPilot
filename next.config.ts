import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't get confused by unrelated
  // lockfiles that may exist in parent directories.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
