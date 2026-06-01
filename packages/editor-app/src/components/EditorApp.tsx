// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useEffect, useState } from "react";
import { type EditorMode, useEditorMode } from "../hooks/useEditorMode";
import { useIsMobile } from "../hooks/useIsMobile";
import { usePreflight } from "../hooks/usePreflight";
import { DEFAULT_BLEED_MM } from "../lib/bleed";
import type { Page } from "../lib/dieline-template";
import {
  type EditorConfig,
  type PaletteId,
  isPanelVisible,
  resolveConfig,
} from "../lib/editor-config";
import type { PreflightReport } from "../lib/preflight/types";
import { type CanvasObj, EditorCanvas } from "./EditorCanvas";
import { FileDropZone } from "./FileDropZone";
import { PageNavigator } from "./PageNavigator";
import { PreflightPanel } from "./PreflightPanel";
import { TopBar, type TopBarProps } from "./TopBar";

type Phase = "upload" | "checking" | "preflight" | "editor";

/**
 * Props accepted by the top-level editor component. Hosts pass these
 * to mount the editor in their page (Next.js route, Astro
 * `client:only`, plain React app, etc.).
 *
 * @public
 */
export type EditorAppProps = {
  /** Strips destructive actions and routes export through the
   *  client-only path. The `/demo` route flips this on. */
  demo?: boolean;
  /** Starting phase. Set `"editor"` to skip the upload step. */
  initialPhase?: Phase;
  /** Seed objects for the canvas — typically from `templateToInitialState`.
   *  Single-page convenience; for multi-page documents pass `initialPages`. */
  initialObjects?: CanvasObj[];
  /** Seed page size for the canvas — typically from `templateToInitialState`.
   *  Single-page convenience; for multi-page documents pass `initialPages`. */
  initialPageSize?: { width: number; height: number };
  /**
   * Multi-page seed. Each entry is a {@link Page} with its own
   * `objects`, `pageSize`, and `bleedMm`. Takes precedence over the
   * single-page `initialObjects` / `initialPageSize` props when supplied.
   *
   * A `PageNavigator` strip renders above the canvas on desktop and a
   * "Pages" section appears in the mobile drawer; users can switch
   * between pages, add (duplicate) pages, and delete pages. Per-page
   * state (objects, pageSize, bleedMm) is preserved across switches.
   * Each page has its own undo history.
   *
   * Pair with `templatesToPages` / `templateSetToPages` helpers to seed
   * known multi-page documents (e.g. carton front + back).
   */
  initialPages?: Page[];
  /** Initial mode preference. `"auto"` resolves by viewport. */
  preferMode?: EditorMode | "auto";
  /** Per-instance flag overrides. Merged into mode + global defaults. */
  config?: Partial<EditorConfig>;
  /** Bleed margin in millimetres. Defaults to {@link DEFAULT_BLEED_MM} (0.125 in).
   *  Ignored when `initialPages` is supplied (each page carries its own bleed). */
  bleedMm?: number;
  /** Host-supplied top bar configuration (logo, extra CTAs, etc.). */
  topBar?: Partial<TopBarProps>;
  /**
   * Initial palette-visibility map. Each {@link PaletteId} entry is
   * `true` (visible) or `false` (hidden); absent ids default to
   * visible. Merged into `config.panelVisibility` once at mount; the
   * host's `onPanelVisibilityChange` callback receives the merged
   * next-state on every toggle.
   */
  initialPanelVisibility?: Partial<Record<PaletteId, boolean>>;
  /**
   * Fires whenever the user toggles a palette via `PaletteManager`
   * (desktop) or the mobile drawer's "Panels" section. The host is
   * responsible for persisting (e.g. localStorage keyed by user +
   * document) — the editor doesn't own this state.
   */
  onPanelVisibilityChange?: (next: Partial<Record<PaletteId, boolean>>) => void;
};

export function EditorApp({
  demo = false,
  initialPhase = "upload",
  initialObjects,
  initialPageSize,
  initialPages,
  preferMode = "auto",
  config: configOverrides,
  bleedMm = DEFAULT_BLEED_MM,
  topBar,
  initialPanelVisibility,
  onPanelVisibilityChange,
}: EditorAppProps) {
  // Multi-page seed wins over the single-page convenience props. We
  // wrap legacy `initialObjects` / `initialPageSize` into a single-page
  // array so the rest of EditorApp can treat everything as multi-page.
  const seededPages = ((): Page[] => {
    if (initialPages && initialPages.length > 0) return initialPages;
    return [
      {
        id: "page-1",
        objects: initialObjects ?? [],
        pageSize: initialPageSize ?? { width: 595, height: 842 },
        bleedMm,
      },
    ];
  })();

  const [pages, setPages] = useState<Page[]>(seededPages);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const clampedPageIndex = Math.min(Math.max(currentPageIndex, 0), pages.length - 1);
  // `pages` is seeded with at least one entry and `handleDeletePage`
  // refuses to drop the last one, so `pages[clampedPageIndex]` is always
  // defined. The non-null assertion makes the invariant explicit; a
  // misuse would crash here instead of silently swapping back to the
  // seeded default.
  // biome-ignore lint/style/noNonNullAssertion: pages is non-empty by construction
  const activePage = pages[clampedPageIndex]!;

  function updateActivePage(patch: Partial<Page>) {
    setPages((prev) => prev.map((p, i) => (i === clampedPageIndex ? { ...p, ...patch } : p)));
  }

  function handleAddPage() {
    // Duplicate the active page; user can edit / pick a new dieline from there.
    setPages((prev) => {
      const src = prev[clampedPageIndex];
      if (!src) return prev;
      const dup: Page = {
        ...src,
        id: `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        objects: src.objects.map((o) => ({ ...o })),
      };
      const next = [...prev];
      next.splice(clampedPageIndex + 1, 0, dup);
      return next;
    });
    setCurrentPageIndex((i) => i + 1);
  }

  function handleDeletePage() {
    // Deleting the current page should keep the user on the *next* page
    // (now at the same index in the shorter array). Only fall back to the
    // previous page when the deleted one was the last in the list.
    if (pages.length <= 1) return;
    const deletedIdx = clampedPageIndex;
    const nextPages = pages.filter((_, i) => i !== deletedIdx);
    setPages(nextPages);
    setCurrentPageIndex(Math.min(deletedIdx, nextPages.length - 1));
  }

  const { mode, setMode } = useEditorMode(preferMode);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<PreflightReport | null>(null);
  const { state: preflightState, run: runPreflight } = usePreflight();
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelVisibility, setPanelVisibility] = useState<Partial<Record<PaletteId, boolean>>>(
    initialPanelVisibility ?? {},
  );

  const isMobile = useIsMobile();
  // Per-instance overrides merge config.panelVisibility (if set) on
  // top of the editor's mutable panelVisibility state. The mutable
  // state wins so user toggles outlive a config-override prop change.
  const baseConfig = resolveConfig(mode, configOverrides);
  const config: EditorConfig = {
    ...baseConfig,
    panelVisibility: { ...baseConfig.panelVisibility, ...panelVisibility },
  };

  function updatePanelVisibility(next: Partial<Record<PaletteId, boolean>>) {
    setPanelVisibility(next);
    onPanelVisibilityChange?.(next);
  }
  // Silence "unused" — kept for the upcoming PaletteManager + mobile
  // "Panels" section wire-up; safe to expose now so hosts can preload
  // visibility from a callback round-trip without later refactors.
  void updatePanelVisibility;

  async function handleFile(f: File) {
    setFile(f);
    setPhase("checking");
    const r = await runPreflight(f, { demoMode: demo });
    if (r) {
      setReport(r);
      setPhase("preflight");
    } else {
      setPhase("upload");
    }
  }

  function handleSendToLint() {
    alert("Job queued for lint node analysis.");
  }

  return (
    <main
      style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#ffffff" }}
    >
      <TopBar
        {...topBar}
        showDemoBadge={(topBar?.showDemoBadge ?? (demo && config.enable_demo_badge)) || false}
        onMenuToggle={() => setMenuOpen((v) => !v)}
        showMenuButton={isMobile && phase === "editor"}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        {phase === "upload" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.25rem",
            }}
          >
            <FileDropZone onFile={handleFile} />
            {!demo && (
              <a
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.85rem",
                  color: "#fc5102",
                  fontWeight: 600,
                  textDecoration: "none",
                  opacity: 0.85,
                }}
              >
                Try the demo editor (no file needed) →
              </a>
            )}
          </div>
        )}

        {phase === "checking" && (
          <p style={{ color: "#995b30" }}>Running preflight checks&hellip;</p>
        )}

        {phase === "preflight" &&
          report &&
          config.enable_preflight_banner &&
          isPanelVisible(config, "preflight") && (
            <PreflightPanel
              report={report}
              onProceed={() => setPhase("editor")}
              onSendToLint={handleSendToLint}
            />
          )}
        {phase === "preflight" &&
          report &&
          (!config.enable_preflight_banner || !isPanelVisible(config, "preflight")) && (
            <AutoAdvance onContinue={() => setPhase("editor")} />
          )}

        {phase === "editor" && activePage && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              height: "100%",
            }}
          >
            {/* Multi-page strip — desktop only; the mobile drawer hosts the
                stacked variant via MobileToolDrawer's extraSections. */}
            {pages.length > 1 && !isMobile && (
              <PageNavigator
                pages={pages}
                currentPageIndex={currentPageIndex}
                onSelect={setCurrentPageIndex}
                onAddPage={handleAddPage}
                {...(pages.length > 1 ? { onDeletePage: handleDeletePage } : {})}
                variant="strip"
              />
            )}
            <EditorCanvas
              key={activePage.id}
              file={file}
              report={report}
              demo={demo}
              mode={mode}
              onModeChange={setMode}
              config={config}
              bleedMm={activePage.bleedMm}
              isMobile={isMobile}
              menuOpen={menuOpen}
              onMenuOpenChange={setMenuOpen}
              initialObjects={activePage.objects}
              initialPageSize={activePage.pageSize}
              onObjectsChange={(objects) => updateActivePage({ objects })}
              onPageSizeChange={(pageSize) => updateActivePage({ pageSize })}
              onBleedMmChange={(bleedMmValue) => updateActivePage({ bleedMm: bleedMmValue })}
              prependDrawerSections={
                pages.length > 1 || isMobile
                  ? [
                      {
                        title: "Pages",
                        defaultOpen: true,
                        content: (
                          <PageNavigator
                            pages={pages}
                            currentPageIndex={currentPageIndex}
                            onSelect={setCurrentPageIndex}
                            onAddPage={handleAddPage}
                            {...(pages.length > 1 ? { onDeletePage: handleDeletePage } : {})}
                            variant="stack"
                          />
                        ),
                      },
                    ]
                  : []
              }
            />
          </div>
        )}
      </div>

      {demo && phase !== "editor" && (
        <footer
          style={{
            background: "#1a0f08",
            borderTop: "1px solid #3d1a00",
            padding: "0.5rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.78rem", color: "#666" }}>
            Demo — client-side checks &amp; export only. Self-host for full PDF/X-4 + lint.
          </span>
        </footer>
      )}

      {preflightState.phase === "error" && (
        <div
          style={{
            position: "fixed",
            bottom: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#f44336",
            color: "#fff",
            padding: "0.5rem 1rem",
            borderRadius: 4,
            fontSize: "0.82rem",
          }}
        >
          {preflightState.message}
        </div>
      )}
    </main>
  );
}

function AutoAdvance({ onContinue }: { onContinue: () => void }) {
  // Host disabled the preflight banner; skip straight into the editor.
  // Runs once via effect so React's render cycle stays clean.
  useAutoAdvance(onContinue);
  return null;
}

function useAutoAdvance(fn: () => void) {
  // Inline single-use helper — avoids polluting hooks/ for one effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire-once
  useEffect(() => {
    fn();
  }, []);
}
