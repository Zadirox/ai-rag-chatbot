"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/lib/language-provider";
import { getOpenAIClient, queryRAG, processDocument, generateSummary, extractKeyTerms } from "@/lib/rag-engine";
import { parseFile } from "@/lib/document-parser";
import { loadDocuments, saveDocuments, clearDocuments, type DocumentRecord } from "@/lib/vector-store";
import { createDemoDocument, getDemoStreamResponse } from "@/lib/demo-mode";
import { ApiGate } from "@/components/api-gate";
import { ChatMessage, TypingIndicator, type ChatMessageData } from "@/components/chat-message";
import { DocumentUploader, DocumentCard } from "@/components/document-uploader";
import {
  Bot,
  Send,
  Trash2,
  Download,
  Key,
  Languages,
  MessageSquare,
  FileText,
  Sparkles,
  Menu,
  X,
} from "lucide-react";

const STORAGE_KEY_CHAT = "smartbot-chat";
const STORAGE_KEY_API = "smartbot-api-key";

function loadChat(): ChatMessageData[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CHAT);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((m: ChatMessageData) => ({ ...m, sources: m.sources?.map((s) => ({ ...s, embedding: [] })) }));
    }
  } catch {}
  return [];
}

function saveChat(messages: ChatMessageData[]) {
  if (typeof window === "undefined") return;
  try {
    const slim = messages.map((m) => ({
      ...m,
      sources: m.sources?.map((s) => ({ ...s, embedding: [] })),
    }));
    localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(slim));
  } catch {}
}

export default function ChatPage() {
  const { t, toggleLang } = useLanguage();
  const [apiKey, setApiKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(STORAGE_KEY_API);
    return saved?.startsWith("sk-") ? saved : null;
  });
  const [isDemo, setIsDemo] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>(() => loadChat());
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => loadDocuments());
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "processing" | "chunking" | "done" | "error">("idle");
  const [showSidebar, setShowSidebar] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (documents.length > 0) saveDocuments(documents);
  }, [documents]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleApiKeySubmit = useCallback((key: string) => {
    setApiKey(key);
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      if (isDemo) return;
      if (!apiKey) return;
      const client = getOpenAIClient(apiKey);
      setUploadStatus("processing");

      try {
        const parsed = await parseFile(file);
        setUploadStatus("chunking");

        const docId = `doc-${Date.now()}`;
        const chunks = await processDocument(client, docId, parsed.name, parsed.text, parsed.pages);

        setUploadStatus("done");

        const [summary, keyTerms] = await Promise.all([
          generateSummary(client, parsed.text),
          extractKeyTerms(client, parsed.text),
        ]);

        const doc: DocumentRecord = {
          id: docId,
          name: parsed.name,
          type: parsed.type,
          size: parsed.size,
          chunkCount: chunks.length,
          uploadedAt: new Date().toISOString(),
          summary,
          keyTerms,
          chunks,
        };

        setDocuments((prev) => {
          const updated = [...prev, doc];
          return updated;
        });

        setTimeout(() => setUploadStatus("idle"), 2000);
      } catch {
        setUploadStatus("error");
        setTimeout(() => setUploadStatus("idle"), 3000);
      }
    },
    [apiKey, isDemo]
  );

  const handleDeleteDoc = useCallback(
    (docId: string) => {
      setDocuments((prev) => {
        const updated = prev.filter((d) => d.id !== docId);
        if (updated.length === 0) clearDocuments();
        return updated;
      });
    },
    []
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    if (!apiKey && !isDemo) return;
    const question = input.trim();
    setInput("");

    const userMsg: ChatMessageData = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: question,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsStreaming(true);

    try {
      let stream: ReadableStream<Uint8Array>;

      if (isDemo) {
        stream = getDemoStreamResponse(question);
      } else {
        const client = getOpenAIClient(apiKey!);
        const history = updatedMessages.map((m) => ({ role: m.role, content: m.content }));
        stream = await queryRAG(client, question, documents, history);
      }

      const reader = stream.getReader();
      let fullText = "";
      let sourcesData: Array<{ docName: string; pageIndex?: number; chunkIndex: number; text: string }> = [];

      const assistantMsg: ChatMessageData = {
        id: `msg-${Date.now()}-resp`,
        role: "assistant",
        content: "",
        sources: [],
      };

      setMessages((prev) => [...prev, assistantMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const sourcesIdx = chunk.indexOf("__SOURCES__");
        if (sourcesIdx !== -1) {
          fullText += chunk.slice(0, sourcesIdx);
          try {
            const parsed = JSON.parse(chunk.slice(sourcesIdx + "__SOURCES__".length));
            sourcesData = parsed.sources || [];
          } catch {}
        } else {
          fullText += chunk;
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantMsg, content: fullText };
          return updated;
        });
      }

      const sourceChunks = sourcesData.map((s) => ({
        id: `src-${s.docName}-${s.chunkIndex}`,
        docId: "",
        docName: s.docName,
        text: s.text,
        embedding: [],
        pageIndex: s.pageIndex,
        chunkIndex: s.chunkIndex,
      }));

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText, sources: sourceChunks };
        saveChat(updated);
        return updated;
      });
    } catch {
      const errorMsg: ChatMessageData = {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        content: t.chat.errorApi,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, apiKey, isDemo, isStreaming, messages, documents, t]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY_CHAT);
  }, []);

  const handleExportChat = useCallback(() => {
    const lines = messages.map((m) => `${m.role === "user" ? t.chat.you || "You" : "SmartBot"}: ${m.content}`);
    const header = `# SmartBot Chat Export\n${t.export.date}: ${new Date().toLocaleDateString()}\n\n---\n\n`;
    const blob = new Blob([header + lines.join("\n\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartbot-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, t]);

  const handleNewApiKey = useCallback((newKey: string) => {
    localStorage.setItem(STORAGE_KEY_API, newKey);
    setApiKey(newKey);
    setIsDemo(false);
    setShowApiModal(false);
  }, []);

  const handleDemo = useCallback(() => {
    setIsDemo(true);
    const demoDoc = createDemoDocument();
    setDocuments([demoDoc]);
  }, []);

  if (!apiKey && !isDemo) return <ApiGate onSubmit={handleApiKeySubmit} onDemo={handleDemo} />;

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-accent" />
          <span className="font-mono text-sm font-semibold text-accent">
              Smart<span className="text-muted">Bot</span>
          </span>
        </div>
        <button onClick={() => { setShowSidebar(false); setMobileSidebar(false); }} className="text-muted transition-colors hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <DocumentUploader onUpload={handleUpload} disabled={isStreaming} status={uploadStatus} />

        <div className="space-y-2">
          {documents.length === 0 ? (
            <p className="py-4 text-center text-[10px] text-muted">{t.sidebar.noDocs}</p>
          ) : (
            documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                name={doc.name}
                chunkCount={doc.chunkCount}
                summary={doc.summary}
                keyTerms={doc.keyTerms}
                onDelete={() => handleDeleteDoc(doc.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="border-t border-border p-3 space-y-1.5">
        <button
          onClick={handleExportChat}
          disabled={messages.length === 0}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
        >
          <Download size={12} /> {t.sidebar.exportChat}
        </button>
        <button
          onClick={handleClearChat}
          disabled={messages.length === 0}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-rose-400 disabled:opacity-30"
        >
          <Trash2 size={12} /> {t.sidebar.clearChat}
        </button>
        <button
          onClick={() => setShowApiModal(true)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-accent"
        >
          <Key size={12} /> {t.sidebar.settings}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen">
      {mobileSidebar && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileSidebar(false)}>
          <aside className="glass-strong flex w-72 flex-col h-full" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {showSidebar && (
        <aside className="glass-strong hidden w-72 flex-col border-r border-border transition-all duration-300 lg:flex">
          {sidebarContent}
        </aside>
      )}

      <main className="flex flex-1 flex-col">
        <header className="glass-strong flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => { if (window.innerWidth < 1024) { setMobileSidebar(true); } else { setShowSidebar(!showSidebar); } }} className="text-muted transition-colors hover:text-accent">
              <Menu size={16} />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              <span className="text-sm font-semibold text-foreground">{t.header.title}</span>
              <span className="hidden text-xs text-muted sm:inline">{t.header.subtitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/30 hover:text-accent"
            >
              <Languages size={12} />
              {t.sidebar.lang}
            </button>
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-muted">
              <FileText size={12} />
              {documents.length}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                <MessageSquare size={28} className="text-accent" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{t.chat.emptyTitle}</h2>
              <p className="text-sm text-muted">{t.chat.emptyDesc}</p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isStreaming && <TypingIndicator />}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-3xl gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={documents.length === 0 ? t.chat.emptyHint : t.chat.placeholder}
              disabled={isStreaming || documents.length === 0}
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder-muted/50 outline-none transition-colors focus:border-accent/40 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim() || documents.length === 0}
              className="flex items-center justify-center rounded-xl bg-accent/10 px-4 text-accent transition-all hover:bg-accent/20 disabled:opacity-30"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </main>

      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowApiModal(false)}>
          <div className="gradient-border glass-strong mx-4 w-full max-w-sm rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-semibold text-foreground">{t.sidebar.settings}</h3>
            <input
              type="password"
              defaultValue={apiKey || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val.startsWith("sk-")) handleNewApiKey(val);
                }
              }}
              placeholder={t.apiGate.keyPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder-muted/50 outline-none transition-colors focus:border-accent/40 font-mono"
            />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setShowApiModal(false)} className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted transition-colors hover:text-foreground">
                {t.apiGate.cancel}
              </button>
              <button
                onClick={() => {
                  const inputEl = document.querySelector<HTMLInputElement>(".fixed input[type=password]");
                  if (inputEl?.value.trim().startsWith("sk-")) handleNewApiKey(inputEl.value.trim());
                }}
                className="flex-1 rounded-lg bg-accent/10 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
              >
                {t.apiGate.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
