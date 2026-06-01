// SPDX-License-Identifier: AGPL-3.0-or-later
//
// `@printwithsynergy/artwork-pdf` — typed HTTP client for the synergy
// engine's workflow API, scoped to artworkPDF's node usage.
//
// The synergy engine orchestrates multi-stage pipelines across
// disparate node types (`artwork.render`, `artwork.thumbnail`,
// `artwork.preview-separations` plus equivalents from sibling
// nodes). artwork-pdf hosts that want to submit synergy workflows
// (e.g. the marketing site's "submit-for-print" flow) use this
// client; it is *not* the in-process pg-boss boundary inside
// `apps/service` — that boundary lives in `apps/service/src/db/boss.ts`
// and consumes jobs that synergy enqueued.
//
// Public surface:
// - {@link WorkflowStage} / {@link WorkflowSubmitRequest} /
//   {@link WorkflowRun} — wire shapes for `/api/v1/workflows`.
// - {@link SynergyClient} — minimal POST/GET client.

/**
 * One stage in a synergy workflow.
 *
 * `nodeType` is the dotted node identifier the synergy engine routes
 * on (e.g. `"artwork.render"`). `config` is node-specific — for
 * artwork.* nodes it's the {@link JobSubmitRequest} shape from
 * `@artworkpdf/document-model`; for other node types it follows that
 * node's own schema. Synergy validates per-node-type at submit time.
 */
export type WorkflowStage = {
  nodeType: string;
  config?: Record<string, unknown>;
};

/**
 * Body shape for `POST /api/v1/workflows`.
 *
 * `stages` are executed in declaration order; each stage's output
 * becomes the next stage's input (synergy handles the threading).
 * `input` seeds the first stage — typically the source document or
 * asset reference that flows through the pipeline.
 */
export type WorkflowSubmitRequest = {
  stages: WorkflowStage[];
  input: Record<string, unknown>;
};

/**
 * Workflow run state, returned by both submit and poll endpoints.
 *
 * `status` is the run-level state machine:
 * `queued → running → done | failed`. Per-stage progress lives in
 * `stages[]` — each entry's `status` is opaquely-typed since each
 * node type defines its own stage state vocabulary; consumers
 * generally only display it or filter on terminal values.
 */
export type WorkflowRun = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  stages: Array<{ nodeType: string; status: string }>;
};

/**
 * Minimal HTTP client for the synergy engine's workflow API.
 *
 * Two methods cover the artwork-pdf use case: submit a workflow,
 * poll a workflow run. Both authenticate via the `x-api-key`
 * header; both throw on non-2xx responses with the HTTP status in
 * the message (the synergy API returns a JSON error body, but this
 * skeleton client surfaces only the status code — richer error
 * shapes can land later without breaking the constructor signature).
 *
 * The client is stateless apart from `baseUrl` + `apiKey` and is
 * safe to reuse across requests; instantiate once per process.
 */
export class SynergyClient {
  readonly #baseUrl: string;
  readonly #apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.#baseUrl = baseUrl;
    this.#apiKey = apiKey;
  }

  /**
   * `POST /api/v1/workflows` — submit a new workflow run.
   * Resolves with the initial {@link WorkflowRun} (typically in
   * `"queued"` state). Throws `Error("synergy error: <status>")` on
   * non-2xx.
   */
  async submitWorkflow(req: WorkflowSubmitRequest): Promise<WorkflowRun> {
    const res = await fetch(`${this.#baseUrl}/api/v1/workflows`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.#apiKey,
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`synergy error: ${res.status}`);
    return res.json() as Promise<WorkflowRun>;
  }

  /**
   * `GET /api/v1/workflows/:id` — poll the current state of a
   * previously-submitted workflow run.
   *
   * No long-polling or SSE in this client; callers poll on their
   * own cadence. Throws `Error("synergy error: <status>")` on
   * non-2xx (including 404 for unknown ids).
   */
  async getWorkflow(id: string): Promise<WorkflowRun> {
    const res = await fetch(`${this.#baseUrl}/api/v1/workflows/${id}`, {
      headers: { "x-api-key": this.#apiKey },
    });
    if (!res.ok) throw new Error(`synergy error: ${res.status}`);
    return res.json() as Promise<WorkflowRun>;
  }
}
