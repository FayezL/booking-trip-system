"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

type Language = "ar" | "en";

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  dir: "rtl" | "ltr";
}

const I18nContext = createContext<I18nContextType>({
  lang: "ar",
  setLang: () => {},
  dir: "rtl",
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("ar");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Language | null;
    if (saved === "ar" || saved === "en") {
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("lang", newLang);
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLang;
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, dir: lang === "ar" ? "rtl" : "ltr" }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
