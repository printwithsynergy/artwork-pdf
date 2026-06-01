// SPDX-License-Identifier: AGPL-3.0-or-later
import { PDFArray, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { scanBarcodes, validateBarcode } from "../barcode-scan";
import type { PreflightIssue, PreflightRule } from "./types";

const KNOWN_SPOT_PREFIXES = ["PANTONE", "HKS ", "TOYO", "DIC ", "Reflex Blue", "Rhodamine"];

type CheckResult = { issues: PreflightIssue[]; skippedChecks: string[] };

export async function runClientChecks(file: File, rules: PreflightRule[]): Promise<CheckResult> {
  const issues: PreflightIssue[] = [];
  const skippedChecks: string[] = [];

  for (const r of rules.filter((r) => r.enabled && !r.clientSide)) {
    skippedChecks.push(r.checkName);
  }

  const clientRules = rules.filter((r) => r.enabled && r.clientSide);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isRaster = /^image\/(png|jpeg|tiff|bmp|webp)/.test(file.type);

  let doc: PDFDocument | null = null;
  if (isPdf) {
    try {
      doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    } catch {
      return {
        issues: [
          {
            checkName: "parse",
            severity: "block",
            message: "Could not parse the PDF — it may be corrupt or password-protected.",
          },
        ],
        skippedChecks,
      };
    }
  }

  for (const rule of clientRules) {
    switch (rule.checkName) {
      case "dpi_min":
        if (isRaster) issues.push(...(await checkRasterDpi(file, rule)));
        else if (doc) issues.push(...checkPdfImageDpi(doc, rule));
        break;
      case "bleed_required":
        if (doc) issues.push(...checkPdfBleed(doc, rule));
        break;
      case "font_embedding":
        if (doc) issues.push(...checkPdfFonts(doc, rule));
        break;
      case "spot_color_validation":
        if (doc) issues.push(...checkPdfSpotColors(doc, rule));
        break;
      case "barcode_validation":
        if (isRaster) issues.push(...(await checkRasterBarcodes(file, rule)));
        // PDF barcode scanning needs the PDF-to-raster pipeline (deferred);
        // for now, raster uploads cover the common artwork-import path.
        break;
    }
  }

  return { issues, skippedChecks };
}

async function checkRasterDpi(file: File, rule: PreflightRule): Promise<PreflightIssue[]> {
  const minDpi = (rule.params.minDpi as number | undefined) ?? 300;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Without pHYs/EXIF metadata, use pixel count as proxy:
      // flag images that are too small for 300 DPI on a 100 mm wide label.
      const minPxFor100mm = Math.round((100 / 25.4) * minDpi);
      if (img.naturalWidth < minPxFor100mm && img.naturalHeight < minPxFor100mm) {
        resolve([
          {
            checkName: rule.checkName,
            severity: rule.severity,
            message: `Image (${img.naturalWidth}×${img.naturalHeight} px) may be below ${minDpi} DPI for a standard label size.`,
            detail: { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, minDpi },
          },
        ]);
      } else {
        resolve([]);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve([]);
    };
    img.src = url;
  });
}

function checkPdfImageDpi(doc: PDFDocument, rule: PreflightRule): PreflightIssue[] {
  const minDpi = (rule.params.minDpi as number | undefined) ?? 300;
  const pages = doc.getPages();
  if (pages.length === 0) return [];

  // pdf-lib doesn't expose image physical dimensions directly;
  // detect embedded XObjects so the user knows DPI will be verified by the lint node.
  for (const page of pages) {
    const resources = page.node.Resources();
    if (!resources) continue;
    const xoRef = resources.get(PDFName.of("XObject"));
    if (xoRef) {
      return [
        {
          checkName: rule.checkName,
          severity: "warn",
          message: `Embedded image(s) found — DPI (target: ${minDpi}) will be confirmed by the lint node.`,
          detail: { delegated: true },
        },
      ];
    }
  }
  return [];
}

function checkPdfBleed(doc: PDFDocument, rule: PreflightRule): PreflightIssue[] {
  const bleedMm = (rule.params.bleedMm as number | undefined) ?? 3;
  const bleedPt = bleedMm * (72 / 25.4);
  const issues: PreflightIssue[] = [];

  doc.getPages().forEach((page, i) => {
    const mediaBox = page.getMediaBox();
    const bleedBox = page.getBleedBox();
    const trimBox = page.getTrimBox();
    const artBox = page.getArtBox();
    const ref = trimBox ?? artBox ?? mediaBox;

    const left = ref.x - bleedBox.x;
    const bottom = ref.y - bleedBox.y;
    const right = bleedBox.x + bleedBox.width - (ref.x + ref.width);
    const top = bleedBox.y + bleedBox.height - (ref.y + ref.height);
    const minBleedPt = Math.min(left, bottom, right, top);

    if (minBleedPt < bleedPt - 0.5) {
      const actualMm = +((minBleedPt * 25.4) / 72).toFixed(1);
      issues.push({
        checkName: rule.checkName,
        severity: rule.severity,
        message: `Page ${i + 1}: bleed is ${actualMm} mm — minimum ${bleedMm} mm required.`,
        page: i + 1,
        detail: { actualMm, requiredMm: bleedMm },
      });
    }
  });

  return issues;
}

function checkPdfFonts(doc: PDFDocument, rule: PreflightRule): PreflightIssue[] {
  const unembedded: string[] = [];

  for (const page of doc.getPages()) {
    const resources = page.node.Resources();
    if (!resources) continue;

    const fontDictRef = resources.get(PDFName.of("Font"));
    if (!fontDictRef) continue;

    let fontDict: PDFDict | undefined;
    try {
      fontDict = doc.context.lookup(
        fontDictRef as Parameters<typeof doc.context.lookup>[0],
        PDFDict,
      );
    } catch {
      continue;
    }
    if (!fontDict) continue;

    for (const key of fontDict.keys()) {
      const fontRef = fontDict.get(key);
      if (!fontRef) continue;

      let font: PDFDict | undefined;
      try {
        font = doc.context.lookup(fontRef as Parameters<typeof doc.context.lookup>[0], PDFDict);
      } catch {
        continue;
      }
      if (!font) continue;

      const baseFont = font.get(PDFName.of("BaseFont"));
      const fontName = (baseFont ? String(baseFont) : String(key)).replace(/^\//, "");

      const descRef = font.get(PDFName.of("FontDescriptor"));
      if (!descRef) {
        if (!unembedded.includes(fontName)) unembedded.push(fontName);
        continue;
      }

      let desc: PDFDict | undefined;
      try {
        desc = doc.context.lookup(descRef as Parameters<typeof doc.context.lookup>[0], PDFDict);
      } catch {
        continue;
      }
      if (!desc) continue;

      const embedded =
        desc.get(PDFName.of("FontFile")) ??
        desc.get(PDFName.of("FontFile2")) ??
        desc.get(PDFName.of("FontFile3"));

      if (!embedded && !unembedded.includes(fontName)) {
        unembedded.push(fontName);
      }
    }
  }

  const unique = [...new Set(unembedded)];
  if (unique.length === 0) return [];
  return [
    {
      checkName: rule.checkName,
      severity: rule.severity,
      message: `Unembedded font(s): ${unique.slice(0, 5).join(", ")}${unique.length > 5 ? ` +${unique.length - 5} more` : ""}.`,
      detail: { fonts: unique },
    },
  ];
}

async function checkRasterBarcodes(file: File, rule: PreflightRule): Promise<PreflightIssue[]> {
  // Load the file into an ImageBitmap → 2d-canvas → ImageData so the
  // barcode scanner can read raw pixels. Wrapped in a try so an
  // unsupported image format fails open (no false negatives —
  // server-side preflight catches what the editor can't).
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return [];
  }

  // OffscreenCanvas was Safari-only as of 16.4 and is still missing
  // from some embedded webviews; feature-detect and fall back to a
  // regular HTMLCanvasElement so this never throws ReferenceError.
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    ctx = canvas.getContext("2d");
  } else if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx = canvas.getContext("2d");
  }
  if (!ctx) {
    bitmap.close();
    return [];
  }
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();

  const detections = await scanBarcodes(imageData);
  const issues: PreflightIssue[] = [];
  for (const d of detections) {
    const v = validateBarcode(d);
    if (!v.valid) {
      issues.push({
        checkName: rule.checkName,
        severity: rule.severity,
        message: `${d.format} barcode ${d.code} is invalid: ${v.reason ?? "unknown"}`,
        detail: { code: d.code, format: d.format, bounds: d.bounds },
      });
    }
  }
  return issues;
}

function checkPdfSpotColors(doc: PDFDocument, rule: PreflightRule): PreflightIssue[] {
  const unknown: string[] = [];

  for (const page of doc.getPages()) {
    const resources = page.node.Resources();
    if (!resources) continue;

    const csDictRef = resources.get(PDFName.of("ColorSpace"));
    if (!csDictRef) continue;

    let csDict: PDFDict | undefined;
    try {
      csDict = doc.context.lookup(csDictRef as Parameters<typeof doc.context.lookup>[0], PDFDict);
    } catch {
      continue;
    }
    if (!csDict) continue;

    for (const key of csDict.keys()) {
      const csRef = csDict.get(key);
      if (!csRef) continue;

      let csArr: PDFArray | undefined;
      try {
        const resolved = doc.context.lookup(csRef as Parameters<typeof doc.context.lookup>[0]);
        if (resolved instanceof PDFArray) csArr = resolved;
      } catch {
        continue;
      }
      if (!csArr || csArr.size() < 2) continue;

      const type = String(csArr.get(0)).replace(/^\//, "");
      if (type !== "Separation" && type !== "DeviceN") continue;

      const colorantEntry = csArr.get(1);
      if (!colorantEntry) continue;

      const names: string[] = [];
      if (type === "Separation") {
        names.push(String(colorantEntry).replace(/^\//, ""));
      } else if (colorantEntry instanceof PDFArray) {
        for (let i = 0; i < colorantEntry.size(); i++) {
          const n = colorantEntry.get(i);
          if (n) names.push(String(n).replace(/^\//, ""));
        }
      }

      for (const name of names) {
        if (name === "All" || name === "None") continue;
        const known = KNOWN_SPOT_PREFIXES.some((p) =>
          name.toUpperCase().startsWith(p.toUpperCase()),
        );
        if (!known && !unknown.includes(name)) unknown.push(name);
      }
    }
  }

  if (unknown.length === 0) return [];
  return [
    {
      checkName: rule.checkName,
      severity: rule.severity,
      message: `Unknown spot color(s): ${unknown.join(", ")} — verify against your press specification.`,
      detail: { colors: unknown },
    },
  ];
}
