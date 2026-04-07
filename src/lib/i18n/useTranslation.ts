import { useCallback } from "react";
import { useI18n } from "./context";
import ar from "./dictionaries/ar.json";
import en from "./dictionaries/en.json";

const dictionaries = { ar, en } as const;

type Dictionary = typeof ar;

function resolvePath(dict: Dictionary, path: string): string {
  const keys = path.split(".");
  let current: unknown = dict;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

export function useTranslation() {
  const { lang } = useI18n();
  const dict: Dictionary = dictionaries[lang];

  const t = useCallback((path: string): string => {
    return resolvePath(dict, path);
  }, [dict]);

  return { t, lang };
}
