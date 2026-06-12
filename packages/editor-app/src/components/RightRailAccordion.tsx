// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { type CSSProperties, type ReactElement, type ReactNode, useEffect, useState } from "react";
import { type EditorConfig, isPanelVisible } from "../lib/editor-config";
import { type DielineParameters, DielineParametersPanel } from "./DielineParametersPanel";
import type { CanvasObj } from "./EditorCanvas";
import { FoldEditorPanel, type FoldEditorPanelValue } from "./FoldEditorPanel";
import { Gs1DigitalLinkPanel, type Gs1DigitalLinkResult } from "./Gs1DigitalLinkPanel";
import { ImposePanel, type ImposePanelValue } from "./ImposePanel";
import { JobSetupPanel, type JobSetupValue } from "./JobSetupPanel";
import { StreamingRenderProgress } from "./StreamingRenderProgress";
import { TrapEditorPanel, type TrapEditorValue } from "./TrapEditorPanel";
import { VariantMatrixPanel, type VariantMatrixPanelValue } from "./VariantMatrixPanel";
import { WhiteUnderbasePanel } from "./WhiteUnderbasePanel";
import { type PropertiesSectionHooks, resolvePropertiesSection } from "./properties-sections";
import { LocalizationPanel, type LocalizationVariant } from "./wave4-extras";

const BORDER = "#3d1a00";
const PANEL_BG = "#1a0f08";
const TEXT = "#f4ece6";
const MUTED = "#888";
const BRAND = "#fc5102";

const PANEL_WIDTH = 320;

/**
 * Props for {@link RightRailAccordion}.
 *
 * @public
 */
export type RightRailAccordionProps = {
  config: EditorConfig;
  /**
   * The currently selected canvas object, if any. When supplied, the
   * accordion mounts the matching per-type Properties panel at the
   * top of the stack (rect, ellipse, text, image, path, nutrition,
   * braille). Existing always-visible sections (Job setup, Trap
   * editor, etc.) still render normally.
   */
  selectedObj?: CanvasObj | null;
  /**
   * Patches the currently selected object. The accordion calls this
   * from a properties section to update the selection in place
   * (e.g. when a fill colour changes, the host writes the new
   * value back into the canvas state).
   */
  onUpdateSelected?: (patch: Partial<CanvasObj>) => void;
  /**
   * Optional hooks the dispatcher threads into per-type panels when
   * supplied. The text panel surfaces an "Edit text…" button when
   * `propertiesHooks.onEditText` is wired; the image panel surfaces
   * "Replace image…" when `propertiesHooks.onReplaceImage` is wired.
   */
  propertiesHooks?: PropertiesSectionHooks;
};

/**
 * Stacked accordion of in-browser editor panels — one section per
 * Wave 1–4 panel that operates entirely client-side (no host
 * adapter required). Each section is collapsible; the editor's
 * `enable_<feature>` flag controls visibility per section, and
 * {@link isPanelVisible} respects the host's `panelVisibility` map
 * for per-instance toggles.
 *
 * Backend-dependent panels (SwatchesPicker, InksPanel, DAM, AI
 * generators, lint findings, etc.) are deliberately excluded — they
 * require host adapters and are surfaced via their freestanding
 * exports + the `panelVisibility` map. Hosts that don't have a
 * backend merge {@link NO_BACKEND_DEFAULTS} into their config to
 * turn those flags off entirely.
 *
 * @public
 */
export function RightRailAccordion({
  config,
  selectedObj,
  onUpdateSelected,
  propertiesHooks,
}: RightRailAccordionProps): ReactElement | null {
  const [openId, setOpenId] = useState<string | null>(null);

  const propertiesSection = resolvePropertiesSection(
    selectedObj,
    onUpdateSelected,
    config,
    propertiesHooks,
  );

  // Auto-open the resolved properties section whenever the selection
  // type changes. Keeps the rail in sync with the canvas without
  // stealing focus from a section the user manually opened mid-edit
  // (only fires on type changes, not every field tweak).
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the section id on purpose — re-opening on every object identity change would steal focus mid-edit
  useEffect(() => {
    if (propertiesSection) setOpenId(propertiesSection.id);
  }, [propertiesSection?.id]);

  const sections: AccordionSection[] = [
    ...(propertiesSection
      ? [
          {
            id: propertiesSection.id,
            label: `${propertiesSection.label} properties`,
            visible: true,
            render: () => propertiesSection.element,
          },
        ]
      : []),
    {
      id: "job-setup",
      label: "Job setup",
      visible: config.enable_print_context && isPanelVisible(config, "dieline-library"),
      render: () => <JobSetupSection />,
    },
    {
      id: "dieline-parameters",
      label: "Dieline parameters",
      visible: config.enable_dieline_parameters && isPanelVisible(config, "dieline-parameters"),
      render: () => <DielineParametersSection />,
    },
    {
      id: "trap-editor",
      label: "Trap editor",
      visible: config.enable_trap_editor,
      render: () => <TrapEditorSection />,
    },
    {
      id: "impose",
      label: "Impose builder",
      visible: config.enable_impose,
      render: () => <ImposeSection />,
    },
    {
      id: "fold-editor",
      label: "Fold editor",
      visible: config.enable_fold_editor,
      render: () => <FoldEditorSection />,
    },
    {
      id: "variant-matrix",
      label: "Variant matrix",
      visible: config.enable_variant_matrix && isPanelVisible(config, "variant-matrix"),
      render: () => <VariantMatrixSection />,
    },
    {
      id: "localization",
      label: "Localization",
      visible: config.enable_localization && isPanelVisible(config, "localization"),
      render: () => <LocalizationSection />,
    },
    {
      id: "barcode-gs1",
      label: "GS1 Digital Link",
      visible: config.enable_gs1_digital_link,
      render: () => <Gs1Section />,
    },
    {
      id: "white-underbase",
      label: "White underbase",
      visible: config.enable_white_underbase && isPanelVisible(config, "white-underbase"),
      render: () => <WhiteUnderbaseSection />,
    },
    {
      id: "streaming-render",
      label: "Streaming render",
      visible: config.enable_streaming_render && isPanelVisible(config, "streaming-render"),
      render: () => <StreamingRenderSection />,
    },
  ];

  const visible = sections.filter((s) => s.visible);
  if (visible.length === 0) return null;

  return (
    <aside
      style={{
        width: PANEL_WIDTH,
        flex: `0 0 ${PANEL_WIDTH}px`,
        height: "100%",
        overflowY: "auto",
        background: PANEL_BG,
        color: TEXT,
        borderLeft: `1px solid ${BORDER}`,
        fontFamily: "inherit",
        fontSize: 12,
      }}
      aria-label="Editor panels"
      data-testid="right-rail-accordion"
    >
      {visible.map((section) => (
        <Section
          key={section.id}
          id={section.id}
          open={openId === section.id}
          onToggle={() => setOpenId((cur) => (cur === section.id ? null : section.id))}
          label={section.label}
        >
          {openId === section.id ? section.render() : null}
        </Section>
      ))}
    </aside>
  );
}

type AccordionSection = {
  id: string;
  label: string;
  visible: boolean;
  render: () => ReactNode;
};

function Section({
  id,
  open,
  onToggle,
  label,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  label: string;
  children: ReactNode;
}): ReactElement {
  const buttonId = `rra-${id}-header`;
  const panelId = `rra-${id}-panel`;
  return (
    <section style={{ borderBottom: `1px solid ${BORDER}` }}>
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        style={{
          width: "100%",
          padding: "0.55rem 0.85rem",
          background: open ? "rgba(252,81,2,0.08)" : "transparent",
          border: 0,
          color: open ? BRAND : TEXT,
          textAlign: "left",
          cursor: "pointer",
          fontWeight: 500,
          fontSize: "0.8rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "inherit",
        }}
      >
        <span>{label}</span>
        <span style={{ opacity: 0.6, fontSize: "0.9rem" }}>{open ? "−" : "+"}</span>
      </button>
      {/* biome-ignore lint/a11y/useSemanticElements: accordion panel keeps div+role="region" — switching to a semantic section element would change the styling contract */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        style={
          open
            ? {
                maxHeight: 480,
                overflowY: "auto",
                borderTop: `1px solid ${BORDER}`,
                background: "#120a05",
              }
            : undefined
        }
      >
        {children}
      </div>
    </section>
  );
}

function JobSetupSection(): ReactElement {
  const [value, setValue] = useState<JobSetupValue>({
    process: "flexo",
    substrate: {
      id: "kraft-uncoated",
      color: "#d2b48c",
      opacity: 0.85,
      finish: "uncoated",
      class: "uncoated",
    },
    targetMarkets: ["US", "CA"],
    colorProfile: "ISOcoated_v2_eci",
    tacLimit: 280,
  });
  const [hidden, setHidden] = useState(false);
  if (hidden) {
    return (
      <button type="button" onClick={() => setHidden(false)} style={ghostButtonStyle()}>
        Reopen Job setup
      </button>
    );
  }
  return <JobSetupPanel value={value} onChange={setValue} onClose={() => setHidden(true)} />;
}

function DielineParametersSection(): ReactElement {
  const [value, setValue] = useState<DielineParameters>({
    widthMm: 100,
    heightMm: 150,
    depthMm: 30,
    bleedMm: 3,
  });
  return <DielineParametersPanel value={value} onChange={setValue} />;
}

function TrapEditorSection(): ReactElement {
  const [value, setValue] = useState<TrapEditorValue>({ widthMm: 0.1, mode: "auto" });
  return <TrapEditorPanel value={value} onChange={setValue} />;
}

function ImposeSection(): ReactElement {
  const [value, setValue] = useState<ImposePanelValue>({
    sheetWidthPt: 1684,
    sheetHeightPt: 2384,
    rows: 3,
    cols: 3,
    pageMapping: "sequential",
    gutterMm: 5,
    marginMm: 10,
    registrationMarks: true,
    cropMarks: true,
  });
  return <ImposePanel value={value} onChange={setValue} />;
}

function FoldEditorSection(): ReactElement {
  const [value, setValue] = useState<FoldEditorPanelValue | undefined>({
    edges: [],
    defaultAngleDeg: 90,
  });
  return <FoldEditorPanel value={value} onChange={setValue} />;
}

function VariantMatrixSection(): ReactElement {
  const [value, setValue] = useState<VariantMatrixPanelValue>({
    tokenKeys: ["locale", "size"],
    variants: [
      { id: "v-en-12", name: "EN / 12 oz", overrides: { locale: "en-US", size: "12 oz" } },
      { id: "v-en-16", name: "EN / 16 oz", overrides: { locale: "en-US", size: "16 oz" } },
      { id: "v-es-12", name: "ES / 12 oz", overrides: { locale: "es-MX", size: "12 oz" } },
    ],
  });
  return <VariantMatrixPanel value={value} onChange={setValue} />;
}

function LocalizationSection(): ReactElement {
  const variants: LocalizationVariant[] = [
    { language: "en-US", texts: { headline: "Cold Brew", tagline: "Smooth, never bitter" } },
    { language: "es-MX", texts: { headline: "Café Frío", tagline: "Suave, nunca amargo" } },
    { language: "de-DE", texts: { headline: "Cold Brew", tagline: "Sanft, nie bitter" } },
  ];
  return <LocalizationPanel variants={variants} />;
}

function Gs1Section(): ReactElement {
  const [link, setLink] = useState<Gs1DigitalLinkResult | null>(null);
  return (
    <>
      <Gs1DigitalLinkPanel onLink={setLink} />
      {link && (
        <ResultChip>
          <div style={{ marginBottom: "0.25rem", color: MUTED }}>GS1 Digital Link URL</div>
          <code
            style={{
              display: "block",
              wordBreak: "break-all",
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.7rem",
              color: TEXT,
            }}
          >
            {link.url}
          </code>
        </ResultChip>
      )}
    </>
  );
}

function ResultChip({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        margin: "0.5rem",
        padding: "0.5rem 0.65rem",
        background: "rgba(252,81,2,0.08)",
        border: `1px solid ${BORDER}`,
        borderRadius: 4,
        color: TEXT,
        fontSize: "0.75rem",
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

function WhiteUnderbaseSection(): ReactElement {
  // Without a `generator` adapter the panel renders read-only — its
  // inputs surface but the "Generate" button is disabled. That's the
  // expected demo state.
  return <WhiteUnderbasePanel />;
}

function StreamingRenderSection(): ReactElement {
  // Without a `connect` adapter the panel renders the "Ready" state
  // showing how the streaming surface looks when no render is in
  // flight. Hosts wire `connect` to a real EventSource.
  return <StreamingRenderProgress />;
}

function ghostButtonStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "0.5rem 0.85rem",
    background: "transparent",
    border: `1px dashed ${BORDER}`,
    borderRadius: 4,
    color: MUTED,
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.75rem",
  };
}
