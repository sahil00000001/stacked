import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // workspace packages ship TypeScript source
  transpilePackages: ["@stacked/claim-engine", "@stacked/seed-data"],
  async headers() {
    return [
      {
        // always check for a new service worker; never let a CDN pin an old one
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  webpack(cfg, { isServer }) {
    // copy Prisma's query engine into the serverless bundle (npm workspaces hoist it to the repo root)
    if (isServer) cfg.plugins = [...(cfg.plugins ?? []), new PrismaPlugin()];
    // the engine uses ESM-style ".js" specifiers for its .ts files
    cfg.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return cfg;
  },
};

export default config;
