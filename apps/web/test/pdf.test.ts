import { chunkPages } from "@frontdesk/core/knowledge";
import { describe, expect, it } from "vitest";
import { PermanentIngestError, pdfPages } from "@/lib/knowledge/pdf";
import { makePdf } from "./make-pdf";

describe("pdfPages", () => {
  it("reads each page's text, ready for chunking with page numbers", async () => {
    const pdf = makePdf([
      ["Green Leaf Clinic - Rate card", "General consultation Rs 500.", "Follow-up within 7 days is free."],
      ["Physiotherapy Rs 700 per session.", "Home visits are not available."],
    ]);
    const pages = await pdfPages(pdf);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toContain("General consultation Rs 500.");
    const chunks = chunkPages(pages, { paged: true, maxChars: 80 });
    expect(chunks.find((c) => c.content.includes("Physiotherapy"))?.page).toBe(2);
  });

  it("explains scanned PDFs instead of storing nothing", async () => {
    await expect(pdfPages(makePdf([[""], [""]]))).rejects.toThrow(/no selectable text/);
  });

  it("rejects files that aren't PDFs", async () => {
    await expect(pdfPages(new TextEncoder().encode("%PDF-1.4 garbage"))).rejects.toBeInstanceOf(PermanentIngestError);
  });
});
