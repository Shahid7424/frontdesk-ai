/** A failure that retrying won't fix (scanned PDF, empty text). Shown to the owner as is. */
export class PermanentIngestError extends Error {
  name = "PermanentIngestError";
}

/** Text of each page of a PDF. Throws PermanentIngestError for files we can't learn from. */
export async function pdfPages(data: Uint8Array): Promise<string[]> {
  // Loaded lazily: pdf.js is large and only this path needs it.
  const { extractText, getDocumentProxy } = await import("unpdf");
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(data);
    pages = (await extractText(pdf, { mergePages: false })).text;
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    if (/password/i.test(msg)) throw new PermanentIngestError("This PDF is password protected. Upload a copy without a password.");
    throw new PermanentIngestError("This file couldn't be read as a PDF. Try exporting it again.");
  }
  const letters = pages.join("").replace(/\s/g, "").length;
  if (letters < 40) {
    throw new PermanentIngestError(
      "This PDF has no selectable text (it looks scanned). Upload a text PDF, or add the key facts as Quick answers.",
    );
  }
  return pages;
}
