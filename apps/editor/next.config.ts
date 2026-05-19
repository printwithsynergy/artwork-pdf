// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_SERVICE_URL: process.env.NEXT_PUBLIC_SERVICE_URL ?? "http://localhost:3001",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  },
};

export default config;
