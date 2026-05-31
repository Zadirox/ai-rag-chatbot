"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/lib/language-provider";
import { Bot, User, ChevronDown, ChevronUp, FileText } from "lucide-react";
import type { Chunk } from "@/lib/vector-store";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Chunk[];
}

interface ChatMessageProps {
  message: ChatMessageData;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useLanguage();
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} animate-fade-in-up`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser ? "bg-accent/20 text-accent" : "bg-lavender text-purple-400"
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      <div className={`max-w-[80%] ${isUser ? "text-right" : "text-left"}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-accent/10 text-foreground rounded-tr-md"
              : "bg-surface border border-border text-foreground rounded-tl-md"
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown disallowedElements={["script", "iframe", "object", "embed", "form", "input", "button", "style"]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {message.sources && message.sources.length > 0 && !isUser && (
          <div className="mt-2">
            <button
              onClick={() => setShowSources(!showSources)}
              className="inline-flex items-center gap-1 rounded-md bg-surface px-2.5 py-1 text-[10px] text-muted transition-colors hover:text-accent"
            >
              <FileText size={10} />
              {t.citation.source} ({message.sources.length})
              {showSources ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>

            {showSources && (
              <div className="mt-2 space-y-2 animate-fade-in-up">
                {message.sources.map((source, i) => (
                  <div key={source.id} className="gradient-border rounded-xl bg-surface p-3">
                    <div className="mb-1.5 flex items-center gap-2 text-[10px] text-muted">
                      <span className="font-mono text-accent">[{i + 1}]</span>
                      <span>{source.docName}</span>
                      {source.pageIndex !== undefined && (
                        <span>
                          {t.citation.page} {source.pageIndex + 1}
                        </span>
                      )}
                      <span>
                        {t.citation.chunk} {source.chunkIndex}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted line-clamp-4">
                      {source.text.slice(0, 300)}
                      {source.text.length > 300 ? "..." : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in-up">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lavender text-purple-400">
        <Bot size={14} />
      </div>
      <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-surface border border-border px-4 py-3">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
      </div>
    </div>
  );
}
