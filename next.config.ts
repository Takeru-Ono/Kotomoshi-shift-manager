import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',  // 🔥 これがないと `next export` できない
  reactStrictMode: true,
};

export default nextConfig;
