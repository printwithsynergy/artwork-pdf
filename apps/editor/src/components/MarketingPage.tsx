// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Marketing landing page for `/`.
//
// Inline-styled for two reasons: (1) the marketing surface ships
// before any CSS framework choice was made, and inlining keeps the
// `/` route's bundle tiny (no Tailwind / no styled-components); (2)
// the marketing copy is brand-controlled and shouldn't be DRYed via
// component abstractions that obscure the per-section content.
//
// Color palette is the artwork-pdf brand (orange `#fc5102` on dark
// brown). `FEATURES` is the per-card content; keep entries short —
// the marketing copy reads as a tight pitch, not a feature checklist.

import type { CSSProperties } from "react";

const BRAND = "#fc5102";
const BG = "#0f0a05";
const PANEL = "#1a0f08";
const BORDER = "#3d1a00";
const TEXT = "#f4ece6";
const MUTED = "#8a7f76";

const FEATURES: { title: string; body: string }[] = [
  {
    title: "PDF/X-4 output",
    body: "ISO-compliant PDF/X-4 with ICC output intent, embedded fonts, and CMYK + spot separations. Composed with pdf-lib, finalized through Ghostscript.",
  },
  {
    title: "Spot & Pantone separations",
    body: "Native overprint, white plate, varnish, dieline and technical inks. Preview separations per-channel before sending to plate.",
  },
  {
    title: "Structural dielines",
    body: "Import CF2, DDES and ARD dielines, or start from the built-in library — pouches, cartons, labels, sachets. Snap artwork to trim and bleed.",
  },
  {
    title: "Flexo distortion compensation",
    body: "Per-substrate, per-cylinder distortion factors applied at render time. Plate stretch is corrected so the printed image lands true to the mock.",
  },
  {
    title: "Preflight before you commit",
    body: "Bleed, trim, resolution, font embedding, image color space and overprint flags are checked client-side before a render job is even queued.",
  },
  {
    title: "Self-hostable, AGPL-3.0",
    body: "Drop-in Hono service + Next.js editor. Runs in Docker, on Railway, or behind your own infra. Source available — no upsell, no telemetry.",
  },
];

const sectionWrap: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "0 1.25rem",
  width: "100%",
};

/**
 * The `/` route component. Static, server-rendered, no client JS.
 * See module header for the styling rationale.
 */
export function MarketingPage() {
  return (
    <main style={{ background: BG, color: TEXT, minHeight: "100vh" }}>
      {/* ── nav ── */}
      <nav
        style={{
          borderBottom: `1px solid ${BORDER}`,
          background: PANEL,
        }}
      >
        <div
          style={{
            ...sectionWrap,
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "0.85rem 1.25rem",
          }}
        >
          <span style={{ fontWeight: 700, color: BRAND, fontSize: "1.05rem" }}>artworkPDF</span>
          <span style={{ flex: 1 }} />
          <a href="/demo" style={navLink}>
            Demo
          </a>
          <a
            href="https://github.com/printwithsynergy/artwork-pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={navLink}
          >
            GitHub
          </a>
          <a
            href="/demo"
            style={{
              background: BRAND,
              color: "#fff",
              padding: "0.45rem 0.9rem",
              borderRadius: 4,
              fontSize: "0.85rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Open editor →
          </a>
        </div>
      </nav>

      {/* ── hero ── */}
      <header
        style={{
          padding: "4rem 0 3rem",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div style={{ ...sectionWrap, textAlign: "center" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: BRAND,
              border: `1px solid ${BRAND}`,
              padding: "0.2rem 0.55rem",
              borderRadius: 3,
              marginBottom: "1.25rem",
            }}
          >
            Open source · AGPL-3.0
          </span>
          <h1
            style={{
              fontSize: "clamp(1.75rem, 5vw, 3.25rem)",
              lineHeight: 1.1,
              margin: "0 0 1rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Production-ready label &amp; packaging artwork,
            <br />
            <span style={{ color: BRAND }}>without the Adobe tax.</span>
          </h1>
          <p
            style={{
              fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
              color: MUTED,
              maxWidth: 680,
              margin: "0 auto 2rem",
              lineHeight: 1.55,
            }}
          >
            artworkPDF is a WYSIWYG editor and render service for the flexo &amp; digital print
            stack — spot colors, dielines, distortion compensation, preflight, and PDF/X-4 output.
            Self-hostable. No sign-up to try.
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              href="/demo"
              style={{
                background: BRAND,
                color: "#fff",
                padding: "0.85rem 1.6rem",
                borderRadius: 6,
                fontSize: "0.95rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Try the demo editor →
            </a>
            <a
              href="https://github.com/printwithsynergy/artwork-pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "transparent",
                color: TEXT,
                padding: "0.85rem 1.6rem",
                borderRadius: 6,
                fontSize: "0.95rem",
                fontWeight: 600,
                textDecoration: "none",
                border: `1px solid ${BORDER}`,
              }}
            >
              Self-host
            </a>
          </div>
          <p style={{ marginTop: "1.25rem", color: MUTED, fontSize: "0.8rem" }}>
            Loads a stand-up pouch dieline. Works on mobile.
          </p>
        </div>
      </header>

      {/* ── features ── */}
      <section style={{ padding: "3.5rem 0", borderBottom: `1px solid ${BORDER}` }}>
        <div style={sectionWrap}>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              margin: "0 0 0.5rem",
              letterSpacing: "-0.01em",
            }}
          >
            Built for the production floor.
          </h2>
          <p style={{ color: MUTED, margin: "0 0 2rem", fontSize: "0.95rem" }}>
            Not another general-purpose design tool wrapped in print-shop branding.
          </p>
          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: "1.25rem",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    margin: "0 0 0.5rem",
                    color: BRAND,
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.85rem",
                    lineHeight: 1.55,
                    color: MUTED,
                    margin: 0,
                  }}
                >
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── workflow ── */}
      <section style={{ padding: "3.5rem 0", borderBottom: `1px solid ${BORDER}` }}>
        <div style={sectionWrap}>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              margin: "0 0 0.5rem",
              letterSpacing: "-0.01em",
            }}
          >
            Workflow: create → lint → trap → step-and-repeat → RIP
          </h2>
          <p style={{ color: MUTED, margin: "0 0 1.5rem", fontSize: "0.95rem" }}>
            artworkPDF is a synergy node: standalone-callable over HTTP, or orchestrated by the
            synergy engine alongside lint, trap and step-and-repeat nodes.
          </p>
          <pre
            style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "1rem",
              fontSize: "0.8rem",
              color: TEXT,
              overflow: "auto",
              margin: 0,
            }}
          >
            <code>{`# Submit a render job
curl -X POST http://localhost:3001/jobs \\
  -H 'Content-Type: application/json' \\
  -d '{"document":{"layers":[]},"output":{"format":"pdf-x4"}}'`}</code>
          </pre>
        </div>
      </section>

      {/* ── cta ── */}
      <section style={{ padding: "3.5rem 0" }}>
        <div style={{ ...sectionWrap, textAlign: "center" }}>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              margin: "0 0 1rem",
              letterSpacing: "-0.01em",
            }}
          >
            Open the editor — no account needed.
          </h2>
          <a
            href="/demo"
            style={{
              display: "inline-block",
              background: BRAND,
              color: "#fff",
              padding: "0.85rem 1.6rem",
              borderRadius: 6,
              fontSize: "0.95rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Launch demo →
          </a>
        </div>
      </section>

      {/* ── footer ── */}
      <footer
        style={{
          borderTop: `1px solid ${BORDER}`,
          background: PANEL,
          padding: "1.5rem 0",
        }}
      >
        <div
          style={{
            ...sectionWrap,
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            fontSize: "0.8rem",
            color: MUTED,
          }}
        >
          <span>© Print with Synergy · AGPL-3.0-or-later</span>
          <div style={{ display: "flex", gap: "1rem" }}>
            <a href="/source" style={navLink}>
              Source
            </a>
            <a
              href="https://github.com/printwithsynergy/artwork-pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={navLink}
            >
              GitHub
            </a>
            <a href="/demo" style={navLink}>
              Demo
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

const navLink: CSSProperties = {
  color: MUTED,
  fontSize: "0.85rem",
  textDecoration: "none",
};
