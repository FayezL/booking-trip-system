"use client";

import { useI18n } from "@/lib/i18n/context";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();

  return (
    <button
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
    >
      {lang === "ar" ? "EN" : "عربي"}
    </button>
  );
}
