/**
 * Writes a minimal text PDF (Helvetica, one line per entry) without a PDF
 * library, so tests can exercise real PDF parsing. ASCII text only.
 */
export function makePdf(pages: string[][]): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) - 1 + 1; // 1-based object numbers

  const catalog = add("");
  const pagesObj = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  for (const lines of pages) {
    const ops = lines
      .map((l, i) => `BT /F1 12 Tf 56 ${780 - i * 18} Td (${l.replace(/[\\()]/g, (c) => `\\${c}`)}) Tj ET`)
      .join("\n");
    const content = add(`<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`);
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
