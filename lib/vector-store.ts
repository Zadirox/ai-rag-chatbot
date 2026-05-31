export interface Chunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  embedding: number[];
  pageIndex?: number;
  chunkIndex: number;
}

export interface DocumentRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  chunkCount: number;
  uploadedAt: string;
  summary: string;
  keyTerms: string[];
  chunks: Chunk[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function searchChunks(queryEmbedding: number[], documents: DocumentRecord[], topK = 4): Chunk[] {
  const allChunks = documents.flatMap((d) => d.chunks);
  const scored = allChunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}

const STORAGE_KEY = "smartbot-documents";

export function loadDocuments(): DocumentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export function saveDocuments(docs: DocumentRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch {}
}

export function clearDocuments() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
