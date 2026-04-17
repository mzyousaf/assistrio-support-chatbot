import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@assistrio/chat-widget"],
  experimental: {
    externalDir: true,
  },
  /**
   * Internal ops UI is `/admin/*` only (no parallel route tree for `/user` or `/super-admin`).
   * These redirects preserve bookmarks and in-app history that still reference legacy prefixes.
   */
  async redirects() {
    return [
      { source: "/super-admin", destination: "/admin/dashboard", permanent: false },
      { source: "/super-admin/:path*", destination: "/admin/:path*", permanent: false },
      { source: "/user/login", destination: "/admin/login", permanent: false },
      { source: "/user", destination: "/admin/dashboard", permanent: false },
      { source: "/user/dashboard", destination: "/admin/dashboard", permanent: false },
      { source: "/user/bots", destination: "/admin/bots", permanent: false },
      { source: "/user/bots/:path*", destination: "/admin/bots/:path*", permanent: false },
      { source: "/user/analytics", destination: "/admin/analytics", permanent: false },
      { source: "/user/analytics/:path*", destination: "/admin/analytics/:path*", permanent: false },
      { source: "/user/visitors", destination: "/admin/visitors", permanent: false },
      { source: "/user/visitors/:path*", destination: "/admin/visitors/:path*", permanent: false },
      { source: "/user/settings", destination: "/admin/settings/general", permanent: false },
      { source: "/user/settings/:path*", destination: "/admin/settings/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
