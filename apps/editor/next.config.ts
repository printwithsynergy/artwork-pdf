// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_SERVICE_URL: process.env.NEXT_PUBLIC_SERVICE_URL ?? "http://localhost:3001",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  },
  webpack(cfg, { isServer }) {
    cfg.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    if (isServer) {
      cfg.externals = [...(cfg.externals ?? []), "canvas"];
    }
    return cfg;
  },
};

export default config;
