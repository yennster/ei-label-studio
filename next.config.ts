import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The vendored Label Studio bundle is immutable — cache it for a year so
        // it isn't re-downloaded (or even revalidated) on every workspace open.
        // The `?v=` token in src/lib/ls-vendor.ts busts this on re-vendor.
        source: "/vendor/label-studio/:file*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
