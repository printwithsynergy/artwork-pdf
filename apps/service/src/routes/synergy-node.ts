// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

export const synergyNodeRouter = new Hono();

const DESCRIPTOR = {
  type: "artwork",
  version: "0.1.0",
  displayName: "artworkPDF",
  license: "AGPL-3.0-or-later",
  source: "https://github.com/printwithsynergy/artwork-pdf",
  capabilities: [
    { type: "artwork.render", description: "Compose artwork layers → PDF/X-4", tier: "CPU" },
    { type: "artwork.thumbnail", description: "Rasterize for preview", tier: "CPU" },
    {
      type: "artwork.preview-separations",
      description: "Emit per-separation PNGs",
      tier: "CPU",
    },
  ],
  http: { jobs: "/jobs", healthz: "/healthz", source: "/source" },
};

synergyNodeRouter.get("/synergy-node.json", (c) => c.json(DESCRIPTOR));
