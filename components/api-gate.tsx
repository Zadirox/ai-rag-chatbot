"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import { Key, ArrowRight, Shield, ExternalLink, Sparkles } from "lucide-react";

interface ApiGateProps {
  onSubmit: (key: string) => void;
  onDemo: () => void;
}

export function ApiGate({ onSubmit, onDemo }: ApiGateProps) {
  const { t } = useLanguage();
  const [key, setKey] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (key.trim().startsWith("sk-")) {
      localStorage.setItem("smartbot-api-key", key.trim());
      onSubmit(key.trim());
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <Key size={24} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t.apiGate.title}</h1>
          <p className="mt-2 text-sm text-muted">{t.apiGate.desc}</p>
        </div>

        <form onSubmit={handleSubmit} className="gradient-border rounded-2xl bg-surface p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">{t.apiGate.keyLabel}</label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t.apiGate.keyPlaceholder}
                className="w-full rounded-lg border border-border bg-background py-2.5 px-4 text-sm text-foreground placeholder-muted/50 outline-none transition-colors focus:border-accent/40 font-mono"
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-accent/5 p-3">
              <Shield size={14} className="mt-0.5 shrink-0 text-accent/60" />
              <p className="text-[11px] leading-relaxed text-muted">{t.apiGate.securityNote}</p>
            </div>

            <button
              type="submit"
              disabled={!key.trim().startsWith("sk-")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/10 py-2.5 text-sm font-medium text-accent transition-all hover:bg-accent/20 disabled:opacity-30 disabled:hover:bg-accent/10"
            >
              {t.apiGate.start}
              <ArrowRight size={14} />
            </button>
          </div>
        </form>

        <div className="mt-3">
          <button
            onClick={onDemo}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-lavender bg-lavender/30 py-2.5 text-sm font-medium text-purple-300 transition-all hover:bg-lavender/50"
          >
            <Sparkles size={14} />
            {t.apiGate.tryDemo}
          </button>
        </div>

        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted transition-colors hover:text-accent"
        >
          {t.apiGate.docsHint}
          <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}
