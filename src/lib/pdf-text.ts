// Extracts the embedded text layer from a PDF so we can send Claude cheap plain
// text instead of the whole PDF (a PDF document block is tokenized as page images
// + text, which is far more expensive). Returns "" for scanned/image-only PDFs
// (no text layer) - the caller then falls back to sending the PDF for vision.

export async function extractPdfText(base64: string): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = Array.isArray(text) ? text.join("\n") : text;
    // Collapse long runs of whitespace / blank lines to keep the token count down.
    return (merged ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return "";
  }
}

// Enough real text to trust it over vision. Scanned PDFs typically yield a few
// stray characters or nothing, so we require a modest minimum.
export function hasUsableText(text: string): boolean {
  return text.replace(/\s+/g, "").length >= 40;
}
