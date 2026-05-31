"use client";

import { useState, useRef } from "react";
import { useLanguage } from "@/lib/language-provider";
import { Upload, FileText, X, Loader2 } from "lucide-react";

interface DocumentUploaderProps {
  onUpload: (file: File) => Promise<void>;
  disabled: boolean;
  status: "idle" | "processing" | "chunking" | "done" | "error";
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIMES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function DocumentUploader({ onUpload, disabled, status }: DocumentUploaderProps) {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) return t.upload.errorSize || `Max ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    if (!ALLOWED_MIMES.includes(file.type) && !file.name.match(/\.(pdf|txt|docx)$/i)) return t.upload.errorType || "Unsupported format";
    return null;
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file || disabled) return;
    const err = validateFile(file);
    if (err) { setError(err); setTimeout(() => setError(null), 3000); return; }
    setError(null);
    onUpload(file);
  }

  function handleFileSelect() {
    const file = fileRef.current?.files?.[0];
    if (!file || disabled) return;
    const err = validateFile(file);
    if (err) { setError(err); setTimeout(() => setError(null), 3000); return; }
    setError(null);
    onUpload(file);
  }

  const isProcessing = status === "processing" || status === "chunking";

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`gradient-border rounded-2xl transition-all duration-300 ${
        isDragging ? "border-accent/40 bg-accent/5 scale-[1.02]" : "bg-surface"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <input ref={fileRef} type="file" accept=".pdf,.txt,.docx" onChange={handleFileSelect} className="hidden" />

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-accent p-4 text-xs text-rose-400">
          <X size={12} /> {error}
        </div>
      )}

      {isProcessing ? (
        <div className="flex flex-col items-center gap-2 p-6">
          <Loader2 size={20} className="animate-spin text-accent" />
          <p className="text-xs text-muted">{status === "processing" ? t.upload.processing : t.upload.chunking}</p>
        </div>
      ) : !error && (
        <button
          onClick={() => !disabled && fileRef.current?.click()}
          disabled={disabled}
          className="flex w-full flex-col items-center gap-2 p-6 transition-colors hover:bg-surface-hover disabled:cursor-not-allowed"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            {isDragging ? <X size={18} className="text-accent" /> : <Upload size={18} className="text-accent" />}
          </div>
          <p className="text-xs font-medium text-foreground">
            {isDragging ? t.upload.dropHere : t.chat.emptyHint}
          </p>
          <p className="text-[10px] text-muted">{t.upload.supported}</p>
        </button>
      )}
    </div>
  );
}

interface DocumentCardProps {
  name: string;
  chunkCount: number;
  summary: string;
  keyTerms: string[];
  onDelete: () => void;
}

export function DocumentCard({ name, chunkCount, summary, keyTerms, onDelete }: DocumentCardProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="gradient-border rounded-xl bg-surface p-3 transition-colors hover:bg-surface-hover">
      <div className="flex items-start gap-2">
        <FileText size={14} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{name}</p>
          <p className="text-[10px] text-muted">{chunkCount} {t.upload.chunks}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-md p-1 text-muted transition-colors hover:text-accent"
          >
            <span className="text-[10px]">{expanded ? "−" : "+"}</span>
          </button>
          <button onClick={onDelete} className="rounded-md p-1 text-muted transition-colors hover:text-rose-400">
            <X size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-border pt-2 animate-fade-in-up">
          {summary && (
            <div>
              <p className="mb-1 text-[10px] font-medium text-accent/80">{t.sidebar.summary}</p>
              <p className="text-[11px] leading-relaxed text-muted">{summary}</p>
            </div>
          )}
          {keyTerms.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-medium text-accent/80">{t.sidebar.keyTerms}</p>
              <div className="flex flex-wrap gap-1">
                {keyTerms.map((term) => (
                  <span key={term} className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] text-accent">
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
