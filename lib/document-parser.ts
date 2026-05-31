export interface ParsedDocument {
  text: string;
  pages: string[];
  name: string;
  type: string;
  size: number;
}

function chunkText(text: string, maxTokens = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + maxTokens, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end >= words.length) break;
    start = end - overlap;
  }

  return chunks.filter((c) => c.trim().length > 10);
}

export { chunkText };

export async function parseFile(file: File): Promise<ParsedDocument> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  let text = "";
  const pages: string[] = [];

  if (ext === "txt") {
    text = await file.text();
    const lines = text.split("\n");
    const pageSize = 50;
    for (let i = 0; i < lines.length; i += pageSize) {
      pages.push(lines.slice(i, i + pageSize).join("\n"));
    }
  } else if (ext === "pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
    const result = await parser.getText();
    text = result.text as string;
    pages.push(text);
  } else if (ext === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer });
    text = result.value;
    pages.push(text);
  } else {
    throw new Error(`Unsupported file type: .${ext}`);
  }

  return {
    text: text.trim(),
    pages,
    name: file.name,
    type: ext,
    size: file.size,
  };
}
