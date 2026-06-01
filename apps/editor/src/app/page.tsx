// SPDX-License-Identifier: AGPL-3.0-or-later
//
// `/` — the artworkpdf.com marketing landing page.
//
// Server component (default for Next.js App Router); no client-side
// JS shipped. Delegates rendering to {@link MarketingPage}, which is
// styled entirely with inline CSS so the marketing surface doesn't
// pull a CSS framework into the bundle.

import { MarketingPage } from "../components/MarketingPage";

export const metadata = {
  title: "artworkPDF — WYSIWYG label & packaging editor",
  description:
    "Production-ready label and packaging artwork editor. PDF/X-4, spot colors, dielines, flexo distortion. Open source, self-hostable, no sign-up.",
};

export default function HomePage() {
  return <MarketingPage />;
}
