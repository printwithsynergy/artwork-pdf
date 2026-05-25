// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NextConfig } from "next";

const config: NextConfig = {
  env: {
    NEXT_PUBLIC_SERVICE_URL: process.env.NEXT_PUBLIC_SERVICE_URL ?? "http://localhost:3001",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  },
  // The editor lives in @artworkpdf/editor-app. Workspace link points
  // at TypeScript source in dev; Next transpiles it for us.
  transpilePackages: ["@artworkpdf/editor-app"],
  // Turbopack handles react-konva + canvas without a custom alias —
  // the "use client" boundary keeps canvas out of the server bundle.
  turbopack: {},
};

export default config;
