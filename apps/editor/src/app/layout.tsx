// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Next.js root layout for `apps/editor` (`@artworkpdf/editor-host`).
//
// Wraps every route under `apps/editor/src/app/` in the document
// shell. Intentionally minimal: a single `<body>` with no provider
// stack — the editor and marketing components own their own theming
// and state. Global CSS is imported once here so it's not duplicated
// per-route.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

/** Default `<head>` metadata; per-route exports override per-page. */
export const metadata: Metadata = {
  title: "artworkPDF",
  description: "WYSIWYG label & packaging artwork editor",
};

/** Root layout — required by Next.js App Router; consumed by Next. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
