// SPDX-License-Identifier: AGPL-3.0-or-later
import { PDFDocument, PDFName, PDFArray } from "pdf-lib";
import type { DocumentModel } from "@artworkpdf/document-model";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export async function renderDocument(data: Record<string, unknown>): Promise<Buffer> {
  const doc = data as unknown as { document: DocumentModel };
  return composeToPdfX4(doc.document);
}

export async function composeToPdfX4(model: DocumentModel): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([model.width, model.height]);

  for (const sep of model.separations) {
    if (sep.colorSpace === "Spot" || sep.colorSpace === "DeviceN") {
      const cs = PDFArray.withContext(pdfDoc.context);
      cs.push(PDFName.of("Separation"));
      cs.push(PDFName.of(sep.name.replace(/\s/g, "_")));
      cs.push(PDFName.of("DeviceCMYK"));
      cs.push(PDFName.of("Identity"));
      page.node.set(PDFName.of(`CS_${sep.name}`), cs);
    }
  }

  page.node.set(PDFName.of("Group"), pdfDoc.context.obj({
    Type: "Group",
    S: "Transparency",
    CS: "DeviceCMYK",
  }));

  const pdfBytes = await pdfDoc.save();

  return ghostscriptPdfX4(Buffer.from(pdfBytes));
}

export async function ghostscriptPdfX4(inputPdf: Buffer): Promise<Buffer> {
  const gsBin = process.env.GHOSTSCRIPT_BIN ?? "gs";
  const inPath = join(tmpdir(), `artworkpdf-in-${Date.now()}.pdf`);
  const outPath = join(tmpdir(), `artworkpdf-out-${Date.now()}.pdf`);

  try {
    await writeFile(inPath, inputPdf);
    await execFileAsync(gsBin, [
      "-dBATCH", "-dNOPAUSE", "-dQUIET",
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.6",
      "-dPDFSETTINGS=/prepress",
      "-dColorConversionStrategy=/LeaveColorUnchanged",
      "-dDoThumbnails=false",
      `-sOutputFile=${outPath}`,
      inPath,
    ]);
    return await readFile(outPath);
  } finally {
    await unlink(inPath).catch(() => undefined);
    await unlink(outPath).catch(() => undefined);
  }
}
