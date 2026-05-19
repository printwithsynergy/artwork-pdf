// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { PreflightIssue, PreflightReport } from "@artworkpdf/document-model";

type Props = {
  report: PreflightReport;
  onProceed: () => void;
  onSendToLint: () => void;
};

export function PreflightPanel({ report, onProceed, onSendToLint }: Props) {
  const blocking = report.issues.filter((i) => i.severity === "block");
  const warnings = report.issues.filter((i) => i.severity === "warn");

  return (
    <div style={{
      background: "#1a0f08",
      border: "1px solid #3d1a00",
      borderRadius: 8,
      padding: "1.5rem",
      maxWidth: 600,
      width: "100%",
    }}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "#e8a87c" }}>Preflight Check</h2>

      {blocking.length === 0 && warnings.length === 0 && (
        <StatusRow color="#4caf50" icon="✓" text="No issues found — file is ready." />
      )}

      {blocking.length > 0 && (
        <section style={{ marginBottom: "1rem" }}>
          <SectionHeader color="#f44336" label={`${blocking.length} blocking issue${blocking.length !== 1 ? "s" : ""}`} />
          {blocking.map((i) => <IssueRow key={`${i.checkName}-${i.message}`} issue={i} />)}
        </section>
      )}

      {warnings.length > 0 && (
        <section style={{ marginBottom: "1rem" }}>
          <SectionHeader color="#ff9800" label={`${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`} />
          {warnings.map((i) => <IssueRow key={`${i.checkName}-${i.message}`} issue={i} />)}
        </section>
      )}

      {report.skippedChecks.length > 0 && (
        <p style={{ fontSize: "0.75rem", color: "#666", margin: "0.5rem 0 1rem" }}>
          {report.skippedChecks.length} check{report.skippedChecks.length !== 1 ? "s" : ""} deferred to lint node:{" "}
          {report.skippedChecks.join(", ")}.
        </p>
      )}

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
        <button
          type="button"
          onClick={onProceed}
          disabled={report.hasBlockingIssues}
          style={{
            padding: "0.5rem 1.25rem",
            background: report.hasBlockingIssues ? "#333" : "#fc5102",
            color: report.hasBlockingIssues ? "#666" : "#fff",
            border: "none",
            borderRadius: 4,
            cursor: report.hasBlockingIssues ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          Open in Editor
        </button>
        <button
          type="button"
          onClick={onSendToLint}
          style={{
            padding: "0.5rem 1.25rem",
            background: "transparent",
            color: "#e8a87c",
            border: "1px solid #3d1a00",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Send to Lint Node
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ color, label }: { color: string; label: string }) {
  return (
    <h3 style={{ fontSize: "0.8rem", color, margin: "0 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </h3>
  );
}

function IssueRow({ issue }: { issue: PreflightIssue }) {
  return (
    <div style={{
      padding: "0.5rem 0.75rem",
      background: issue.severity === "block" ? "rgba(244,67,54,0.08)" : "rgba(255,152,0,0.08)",
      borderLeft: `3px solid ${issue.severity === "block" ? "#f44336" : "#ff9800"}`,
      borderRadius: "0 4px 4px 0",
      marginBottom: "0.375rem",
      fontSize: "0.82rem",
      color: "#ccc",
    }}>
      <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#888", marginRight: "0.5rem" }}>
        [{issue.checkName}]
      </span>
      {issue.message}
      {issue.page !== undefined && (
        <span style={{ marginLeft: "0.5rem", color: "#888", fontSize: "0.75rem" }}>p.{issue.page}</span>
      )}
    </div>
  );
}

function StatusRow({ color, icon, text }: { color: string; icon: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color, marginBottom: "1rem" }}>
      <span style={{ fontSize: "1.2rem" }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
