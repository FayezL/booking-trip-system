"use client";

import { useI18n } from "@/lib/i18n/context";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className="gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold min-h-0 h-auto bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-300"
    >
      <Languages className="w-3.5 h-3.5" />
      {lang === "ar" ? "EN" : "عربي"}
    </Button>
  );
}
