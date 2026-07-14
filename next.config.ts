import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Clean URL for the Inner Circle onboarding landing page.
      // Serves /public/onboarding.html while keeping the URL as /welcome.
      { source: '/welcome', destination: '/onboarding.html' },
    ]
  },
};

export default nextConfig;
