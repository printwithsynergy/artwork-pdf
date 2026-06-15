// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

/**
 * Synergy node-capabilities descriptor —
 * `GET /.well-known/synergy-node.json`.
 *
 * Each artwork.* capability advertises a `tier` ("CPU" | "GPU" |
 * "IO") that the synergy engine uses for scheduling — CPU-bound work
 * goes to general workers, GPU-bound work goes to specialized
 * pools, IO-bound work runs on shared infra. All current capabilities
 * are CPU since they boil down to compile-pdf HTTP calls.
 *
 * Keep the descriptor in sync with `worker.ts`'s registered queues:
 * if you add an `artwork.foo` queue, add a matching entry here so
 * synergy can discover and route to it.
 */
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
  http: {
    jobs: "/jobs",
    healthz: "/healthz",
    readyz: "/readyz",
    contract: "/v1/contract",
    source: "/source",
  },
};

synergyNodeRouter.get("/synergy-node.json", (c) => c.json(DESCRIPTOR));
