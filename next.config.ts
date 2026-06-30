import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    USE_ELEVENLABS: process.env.USE_ELEVENLABS,
  },
};

export default nextConfig;