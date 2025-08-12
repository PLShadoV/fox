/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do NOT use `output: "export"` with App Router dynamic pages.
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
