import OpenAI from "openai";
import { chunkText } from "./document-parser";
import { searchChunks, type DocumentRecord, type Chunk } from "./vector-store";

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o-mini";

export function getOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

export async function embedText(client: OpenAI, text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

export async function embedChunks(client: OpenAI, texts: string[]): Promise<number[][]> {
  const batchSize = 20;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map((t) => t.slice(0, 8000)),
    });
    allEmbeddings.push(...response.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}

export async function processDocument(
  client: OpenAI,
  docId: string,
  docName: string,
  text: string,
  pages: string[]
): Promise<Chunk[]> {
  const chunks = chunkText(text);
  const embeddings = await embedChunks(client, chunks);

  return chunks.map((chunkText_, i) => ({
    id: `${docId}-chunk-${i}`,
    docId,
    docName,
    text: chunkText_,
    embedding: embeddings[i],
    pageIndex: pages.length > 1 ? Math.floor((i / chunks.length) * pages.length) : undefined,
    chunkIndex: i,
  }));
}

export interface RAGResponse {
  answer: string;
  sources: Chunk[];
}

export async function generateSummary(client: OpenAI, text: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: "Summarize the following document in 3-5 concise sentences. Focus on the main topic, key findings, and conclusions.",
      },
      { role: "user", content: text.slice(0, 12000) },
    ],
    temperature: 0.3,
  });
  return response.choices[0]?.message?.content || "";
}

export async function extractKeyTerms(client: OpenAI, text: string): Promise<string[]> {
  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: "Extract 5-8 key terms or concepts from this document. Return ONLY a JSON array of strings, nothing else. Example: [\"term1\", \"term2\"]",
      },
      { role: "user", content: text.slice(0, 12000) },
    ],
    temperature: 0.2,
  });
  const raw = response.choices[0]?.message?.content || "[]";
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

export async function queryRAG(
  client: OpenAI,
  question: string,
  documents: DocumentRecord[],
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<ReadableStream<Uint8Array>> {
  const questionEmbedding = await embedText(client, question);
  const sources = searchChunks(questionEmbedding, documents, 4);

  const contextBlock = sources
    .map((s, i) => `[Source ${i + 1} — ${s.docName}${s.pageIndex ? `, page ${s.pageIndex + 1}` : ""}, chunk ${s.chunkIndex}]:\n${s.text}`)
    .join("\n\n");

  const systemPrompt = `You are SmartBot, an AI assistant that answers questions based on the provided document context. 

Rules:
- Answer ONLY based on the provided sources. If the sources don't contain enough information, say so.
- Always cite your sources using [Source N] format at the end of relevant sentences.
- Be concise but thorough.
- If the question is in Russian, answer in Russian. If in English, answer in English.
- Use markdown formatting when helpful (lists, bold, code blocks).

Context:
${contextBlock}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: question },
  ];

  const stream = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.4,
    stream: true,
  });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        const sourcesData = JSON.stringify({ sources: sources.map((s) => ({ docName: s.docName, pageIndex: s.pageIndex, chunkIndex: s.chunkIndex, text: s.text })) });
        controller.enqueue(encoder.encode(`\n__SOURCES__${sourcesData}`));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
