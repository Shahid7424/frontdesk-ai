import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @frontdesk/core ships TypeScript source, Next compiles it for us.
  transpilePackages: ["@frontdesk/core"],
  // pdf.js is loaded from node_modules at runtime instead of being bundled.
  serverExternalPackages: ["unpdf"],
  // PDF uploads go through a Server Action; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  async headers() {
    return [
      {
        // Baseline hardening for every response. The dashboard can't be framed
        // (clickjacking); the widget never uses frames, it's a script.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://api.razorpay.com https://rzp.io" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        // The widget script is loaded from customers' websites.
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
