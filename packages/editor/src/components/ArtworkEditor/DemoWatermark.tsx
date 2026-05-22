// Demo Watermark - Demo mode restrictions overlay
// SPDX-License-Identifier: AGPL-3.0-or-later

interface DemoWatermarkProps {
  isDemo?: boolean;
}

export function DemoWatermark({ isDemo = true }: DemoWatermarkProps) {
  if (!isDemo) return null;

  return (
    <>
      {/* Watermark overlay on canvas */}
      <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden opacity-[0.08]">
        <div className="rotate-[-15deg] select-none whitespace-nowrap text-6xl font-black text-slate-900">
          DEMO • NOT FOR PRODUCTION • DEMO • NOT FOR PRODUCTION • DEMO • NOT FOR PRODUCTION •
        </div>
      </div>

      {/* Demo badge */}
      <div className="pointer-events-none absolute left-4 bottom-4 z-50 rounded bg-yellow-500/90 px-3 py-1.5 shadow-lg">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-yellow-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs font-bold text-yellow-900">DEMO MODE</span>
        </div>
      </div>

      {/* Download disabled indicator */}
      <div className="pointer-events-none absolute right-4 bottom-4 z-50 rounded bg-slate-800/90 px-3 py-1.5 shadow-lg">
        <div className="flex items-center gap-2 text-slate-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-xs">Download disabled in demo</span>
        </div>
      </div>
    </>
  );
}
