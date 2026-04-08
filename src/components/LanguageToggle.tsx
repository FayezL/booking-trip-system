"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      aria-label={lang === "ar" ? "Switch to English" : "التبديل للعربية"}
    >
      <Languages className="size-4" />
      <span className="text-xs font-semibold">
        {lang === "ar" ? "EN" : "عربي"}
      </span>
    </Button>
  );
}
