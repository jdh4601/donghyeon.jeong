import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  outputFileTracingIncludes: { "/media/*": ["./src/content/media/*"] },
  outputFileTracingExcludes: {
    "*": [
      "./.data/**",
      "./artifacts/**",
      "./.content-source.json",
      "./.env*",
      "./tests/**",
    ],
  },
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
