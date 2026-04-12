import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@assistrio/chat-widget"],
  experimental: {
    externalDir: true,
  },
  async redirects() {
    return [
      { source: "/super-admin", destination: "/user/dashboard", permanent: true },
      { source: "/super-admin/:path*", destination: "/user/:path*", permanent: true },
      { source: "/admin", destination: "/user/dashboard", permanent: true },
      { source: "/admin/:path*", destination: "/user/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
