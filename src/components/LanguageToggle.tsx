"use client";

import { useI18n } from "@/lib/i18n/context";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();

  return (
    <button
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-300 active:scale-95 transition-all duration-150"
    >
      {lang === "ar" ? "EN" : "عربي"}
    </button>
  );
}
