"use client";

import { createContext, useContext, useState, useCallback, useSyncExternalStore, type ReactNode } from "react";
import { t, type Lang } from "./translations";

interface LanguageContextType {
  lang: Lang;
  t: typeof t.en;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const emptySubscribe = () => () => {};

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem("docubot-lang");
    if (saved === "ru" || saved === "en") return saved;
  } catch {}
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "en" ? "ru" : "en";
      localStorage.setItem("docubot-lang", next);
      return next;
    });
  }, []);

  if (!mounted) return null;

  return (
    <LanguageContext.Provider value={{ lang, t: t[lang], toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
