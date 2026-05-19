// SPDX-License-Identifier: AGPL-3.0-or-later

export type WorkflowStage = {
  nodeType: string;
  config?: Record<string, unknown>;
};

export type WorkflowSubmitRequest = {
  stages: WorkflowStage[];
  input: Record<string, unknown>;
};

export type WorkflowRun = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  stages: Array<{ nodeType: string; status: string }>;
};

export class SynergyClient {
  readonly #baseUrl: string;
  readonly #apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.#baseUrl = baseUrl;
    this.#apiKey = apiKey;
  }

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

  async getWorkflow(id: string): Promise<WorkflowRun> {
    const res = await fetch(`${this.#baseUrl}/api/v1/workflows/${id}`, {
      headers: { "x-api-key": this.#apiKey },
    });
    if (!res.ok) throw new Error(`synergy error: ${res.status}`);
    return res.json() as Promise<WorkflowRun>;
  }
}
