// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { PanelPlugin, ViewerContext } from "@printwithsynergy/lens-pdf";
import type { PreflightReport } from "../lib/preflight/types";

const PANEL_BG = "#1a0f08";
const BORDER = "#3d1a00";
const BRAND = "#fc5102";
const MUTED = "#888";

/**
 * Build a lens-pdf panel plugin that surfaces an artwork-pdf
 * `PreflightReport` in the right-hand panel. Reuses the same preflight
 * types the editor's pre-render PreflightPanel consumed.
 *
 * Pass the latest report when registering (or via a closure that re-reads
 * a host store). Each issue renders as a clickable row; in this first
 * pass we just list them — wiring to canvas-highlight (an OverlayItem
 * round-trip) comes in a follow-up.
 *
 * @public
 */
export function preflightFindingsPlugin(opts: {
  /** The artwork-pdf preflight report to display. */
  report: PreflightReport | null;
  /** Optional click handler. Receives the issue + 1-indexed page. */
  onIssueClick?: (issue: PreflightReport["issues"][number]) => void;
}): PanelPlugin {
  return {
    id: "artworkpdf.panel.preflight",
    version: "1.0.0",
    slot: "panel.right",
    title: "Preflight",
    order: 10,
    mount(_ctx: ViewerContext) {
      const report = opts.report;
      if (!report) {
        return (
          <div
            style={{
              padding: "0.75rem",
              fontSize: "0.78rem",
              color: MUTED,
              background: PANEL_BG,
              height: "100%",
            }}
          >
            No preflight report attached to this document.
          </div>
        );
      }

      return (
        <div
          style={{
            background: PANEL_BG,
            color: "#ddd",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            fontSize: "0.8rem",
          }}
        >
          <header
            style={{
              padding: "0.5rem 0.75rem",
              borderBottom: `1px solid ${BORDER}`,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: report.passed ? "#2e7d32" : "#b71c1c",
              }}
              aria-hidden
            />
            <span style={{ fontWeight: 600 }}>
              {report.passed ? "Passed" : "Issues found"}
            </span>
            <span style={{ marginLeft: "auto", color: MUTED, fontSize: "0.7rem" }}>
              {report.issues.length} issue{report.issues.length === 1 ? "" : "s"}
            </span>
          </header>

          <ul
            style={{
              flex: 1,
              overflowY: "auto",
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {report.issues.length === 0 && (
              <li style={{ padding: "0.75rem", color: MUTED }}>No issues.</li>
            )}
            {report.issues.map((issue, i) => (
              <li
                key={`${issue.checkName}-${i}`}
                style={{ borderBottom: `1px solid ${BORDER}` }}
              >
                <button
                  type="button"
                  onClick={() => opts.onIssueClick?.(issue)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: "0.55rem 0.75rem",
                    textAlign: "left",
                    color: "#ddd",
                    cursor: opts.onIssueClick ? "pointer" : "default",
                    fontFamily: "inherit",
                    fontSize: "0.78rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        fontSize: "0.6rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: issue.severity === "block" ? "#ef5350" : "#ffb74d",
                        fontWeight: 600,
                      }}
                    >
                      {issue.severity}
                    </span>
                    <span style={{ color: BRAND, fontSize: "0.7rem", fontFamily: "monospace" }}>
                      {issue.checkName}
                    </span>
                    {issue.page !== undefined && (
                      <span style={{ marginLeft: "auto", color: MUTED, fontSize: "0.7rem" }}>
                        p.{issue.page}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: "0.2rem", lineHeight: 1.4 }}>
                    {issue.message}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    },
  };
}
