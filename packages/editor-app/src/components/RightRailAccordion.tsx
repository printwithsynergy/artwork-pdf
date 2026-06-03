// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { type CSSProperties, type ReactElement, type ReactNode, useState } from "react";
import { type EditorConfig, isPanelVisible } from "../lib/editor-config";
import {
  BraillePanel,
  type BrailleComposeResult,
} from "./BraillePanel";
import {
  DielineParametersPanel,
  type DielineParameters,
} from "./DielineParametersPanel";
import {
  FoldEditorPanel,
  type FoldEditorPanelValue,
} from "./FoldEditorPanel";
import {
  Gs1DigitalLinkPanel,
  type Gs1DigitalLinkResult,
} from "./Gs1DigitalLinkPanel";
import {
  ImposePanel,
  type ImposePanelValue,
} from "./ImposePanel";
import {
  JobSetupPanel,
  type JobSetupValue,
} from "./JobSetupPanel";
import {
  LocalizationPanel,
  type LocalizationVariant,
} from "./wave4-extras";
import {
  NutritionPanel,
  type NutritionPanelSpec,
} from "./NutritionPanel";
import { StreamingRenderProgress } from "./StreamingRenderProgress";
import {
  TrapEditorPanel,
  type TrapEditorValue,
} from "./TrapEditorPanel";
import {
  VariantMatrixPanel,
  type VariantMatrixPanelValue,
} from "./VariantMatrixPanel";
import { WhiteUnderbasePanel } from "./WhiteUnderbasePanel";

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
}: RightRailAccordionProps): ReactElement | null {
  const [openId, setOpenId] = useState<string | null>(null);

  const sections: AccordionSection[] = [
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
      id: "nutrition",
      label: "Nutrition Facts",
      visible: config.enable_nutrition_panel,
      render: () => <NutritionSection />,
    },
    {
      id: "barcode-gs1",
      label: "GS1 Digital Link",
      visible: config.enable_gs1_digital_link,
      render: () => <Gs1Section />,
    },
    {
      id: "braille",
      label: "Braille layout",
      visible: config.enable_braille_panel,
      render: () => <BrailleSection />,
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
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section style={{ borderBottom: `1px solid ${BORDER}` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
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
        <span style={{ opacity: 0.6, fontSize: "0.9rem" }}>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div
          style={{
            maxHeight: 480,
            overflowY: "auto",
            borderTop: `1px solid ${BORDER}`,
            background: "#120a05",
          }}
        >
          {children}
        </div>
      )}
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
      <button
        type="button"
        onClick={() => setHidden(false)}
        style={ghostButtonStyle()}
      >
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

function NutritionSection(): ReactElement {
  return (
    <NutritionPanel
      onCompose={(spec: NutritionPanelSpec) => {
        // The host normally lays the composed spec onto the canvas;
        // in the in-browser sidebar we surface a confirmation only.
        if (typeof window !== "undefined") {
          window.alert(`Composed nutrition panel: ${spec.rows.length} rows`);
        }
      }}
    />
  );
}

function Gs1Section(): ReactElement {
  return (
    <Gs1DigitalLinkPanel
      onLink={(result: Gs1DigitalLinkResult) => {
        if (typeof window !== "undefined") {
          window.prompt("GS1 Digital Link URL", result.url);
        }
      }}
    />
  );
}

function BrailleSection(): ReactElement {
  return (
    <BraillePanel
      onCompose={(result: BrailleComposeResult) => {
        if (typeof window !== "undefined") {
          window.alert(`Composed ${result.cells.length} Braille cells`);
        }
      }}
    />
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
