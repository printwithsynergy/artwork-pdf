// Preflight Panel - Show preflight findings
// SPDX-License-Identifier: AGPL-3.0-or-later

interface PreflightFinding {
  id: string;
  message: string;
  severity: "error" | "warning" | "info";
  details?: string;
}

interface PreflightPanelProps {
  result: {
    findings: PreflightFinding[];
  } | null;
  onClose: () => void;
}

export function PreflightPanel({ result, onClose }: PreflightPanelProps) {
  if (!result) return null;

  const errors = result.findings.filter((f) => f.severity === "error");
  const warnings = result.findings.filter((f) => f.severity === "warning");
  const info = result.findings.filter((f) => f.severity === "info");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-[500px] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Preflight Results</h2>
            <div className="flex gap-2">
              {errors.length > 0 && (
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                  {errors.length} Errors
                </span>
              )}
              {warnings.length > 0 && (
                <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                  {warnings.length} Warnings
                </span>
              )}
              {info.length > 0 && (
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                  {info.length} Info
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Findings list */}
        <div className="flex-1 overflow-y-auto p-6">
          {result.findings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-4 text-lg font-medium text-white">All checks passed!</p>
              <p className="text-sm text-slate-400">Your design is ready for production.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.findings.map((finding) => (
                <div
                  key={finding.id}
                  className={`rounded-lg border p-4 ${
                    finding.severity === "error"
                      ? "border-red-500/50 bg-red-500/10"
                      : finding.severity === "warning"
                      ? "border-yellow-500/50 bg-yellow-500/10"
                      : "border-blue-500/50 bg-blue-500/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 h-2 w-2 rounded-full ${
                        finding.severity === "error"
                          ? "bg-red-500"
                          : finding.severity === "warning"
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{finding.message}</p>
                      {finding.details && (
                        <p className="mt-1 text-xs text-slate-400">{finding.details}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Powered by lintPDF visual preflight checks
            </p>
            <button
              onClick={onClose}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
