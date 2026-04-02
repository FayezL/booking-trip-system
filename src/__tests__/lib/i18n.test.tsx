import { renderHook, act } from "@testing-library/react";
import React from "react";
import ar from "@/lib/i18n/dictionaries/ar.json";
import en from "@/lib/i18n/dictionaries/en.json";
import { I18nProvider, useI18n } from "@/lib/i18n/context";

function resolveKey(dict: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = dict;
  for (const key of keys) {
    if (
      current &&
      typeof current === "object" &&
      key in (current as Record<string, unknown>)
    ) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...collectKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe("resolveKey (t() logic)", () => {
  describe("Arabic dictionary", () => {
    it("resolves top-level section keys as the path (non-string value)", () => {
      expect(resolveKey(ar as unknown as Record<string, unknown>, "auth")).toBe(
        "auth"
      );
    });

    it("resolves auth.login", () => {
      expect(
        resolveKey(ar as unknown as Record<string, unknown>, "auth.login")
      ).toBe("تسجيل الدخول");
    });

    it("resolves auth.signup", () => {
      expect(
        resolveKey(ar as unknown as Record<string, unknown>, "auth.signup")
      ).toBe("إنشاء حساب");
    });

    it("resolves common.loading", () => {
      expect(
        resolveKey(ar as unknown as Record<string, unknown>, "common.loading")
      ).toBe("تحميل...");
    });

    it("resolves admin.createTrip", () => {
      expect(
        resolveKey(
          ar as unknown as Record<string, unknown>,
          "admin.createTrip"
        )
      ).toBe("رحلة جديدة");
    });

    it("resolves confirm.backToTrips", () => {
      expect(
        resolveKey(
          ar as unknown as Record<string, unknown>,
          "confirm.backToTrips"
        )
      ).toBe("ارجع للرحلات");
    });
  });

  describe("English dictionary", () => {
    it("resolves auth.login", () => {
      expect(
        resolveKey(en as unknown as Record<string, unknown>, "auth.login")
      ).toBe("Login");
    });

    it("resolves auth.signup", () => {
      expect(
        resolveKey(en as unknown as Record<string, unknown>, "auth.signup")
      ).toBe("Sign Up");
    });

    it("resolves common.loading", () => {
      expect(
        resolveKey(en as unknown as Record<string, unknown>, "common.loading")
      ).toBe("Loading...");
    });

    it("resolves admin.createTrip", () => {
      expect(
        resolveKey(
          en as unknown as Record<string, unknown>,
          "admin.createTrip"
        )
      ).toBe("New Trip");
    });

    it("resolves buses.chooseBus", () => {
      expect(
        resolveKey(
          en as unknown as Record<string, unknown>,
          "buses.chooseBus"
        )
      ).toBe("Choose a Bus");
    });
  });

  describe("missing keys", () => {
    it("returns the path for a non-existent top-level key", () => {
      expect(
        resolveKey(
          ar as unknown as Record<string, unknown>,
          "nonexistent.key"
        )
      ).toBe("nonexistent.key");
    });

    it("returns the path for a non-existent nested key", () => {
      expect(
        resolveKey(
          en as unknown as Record<string, unknown>,
          "auth.nonexistent"
        )
      ).toBe("auth.nonexistent");
    });

    it("returns the path for a deeply non-existent path", () => {
      expect(
        resolveKey(
          ar as unknown as Record<string, unknown>,
          "a.b.c.d.e"
        )
      ).toBe("a.b.c.d.e");
    });

    it("returns the path for empty string", () => {
      expect(
        resolveKey(ar as unknown as Record<string, unknown>, "")
      ).toBe("");
    });

    it("returns the path when resolving a non-leaf node as string", () => {
      expect(
        resolveKey(
          en as unknown as Record<string, unknown>,
          "auth"
        )
      ).toBe("auth");
    });
  });
});

describe("dictionary symmetry", () => {
  it("ar.json and en.json have the same keys", () => {
    const arKeys = collectKeys(ar as unknown as Record<string, unknown>).sort();
    const enKeys = collectKeys(en as unknown as Record<string, unknown>).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it("both dictionaries have the same top-level sections", () => {
    const arSections = Object.keys(ar).sort();
    const enSections = Object.keys(en).sort();
    expect(arSections).toEqual(enSections);
  });

  it("every key in ar.json resolves to a non-empty string in en.json", () => {
    const arKeys = collectKeys(ar as unknown as Record<string, unknown>);
    for (const key of arKeys) {
      const value = resolveKey(en as unknown as Record<string, unknown>, key);
      expect(value).not.toBe(key);
    }
  });

  it("every key in en.json resolves to a non-empty string in ar.json", () => {
    const enKeys = collectKeys(en as unknown as Record<string, unknown>);
    for (const key of enKeys) {
      const value = resolveKey(ar as unknown as Record<string, unknown>, key);
      expect(value).not.toBe(key);
    }
  });
});

describe("I18nProvider", () => {
  beforeEach(() => {
    document.cookie = "";
    Object.defineProperty(document, "documentElement", {
      value: {
        dir: "ltr",
        lang: "en",
        setAttribute: jest.fn(),
        removeAttribute: jest.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  it("defaults to Arabic (ar) language", () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });
    expect(result.current.lang).toBe("ar");
    expect(result.current.dir).toBe("rtl");
  });

  it("switches to English and updates dir to ltr", () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });

    act(() => {
      result.current.setLang("en");
    });

    expect(result.current.lang).toBe("en");
    expect(result.current.dir).toBe("ltr");
  });

  it("sets document cookie when language changes", () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });

    act(() => {
      result.current.setLang("en");
    });

    expect(document.cookie).toContain("lang=en");
  });

  it("sets documentElement dir and lang when language changes", () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });

    act(() => {
      result.current.setLang("en");
    });

    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");
  });

  it("sets dir to rtl when switching to Arabic", () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });

    act(() => {
      result.current.setLang("en");
    });

    act(() => {
      result.current.setLang("ar");
    });

    expect(result.current.lang).toBe("ar");
    expect(result.current.dir).toBe("rtl");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });

  it("reads language from cookie on mount", () => {
    document.cookie = "lang=en; path=/";

    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });

    expect(result.current.lang).toBe("en");
    expect(result.current.dir).toBe("ltr");
  });

  it("ignores invalid cookie values and defaults to ar", () => {
    document.cookie = "lang=fr; path=/";

    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });

    expect(result.current.lang).toBe("ar");
    expect(result.current.dir).toBe("rtl");
  });

  it("provides setLang function that can be called multiple times", () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });

    act(() => {
      result.current.setLang("en");
    });
    expect(result.current.lang).toBe("en");

    act(() => {
      result.current.setLang("ar");
    });
    expect(result.current.lang).toBe("ar");

    act(() => {
      result.current.setLang("en");
    });
    expect(result.current.lang).toBe("en");
  });
});

describe("deeply nested path resolution", () => {
  const deepDict = {
    level1: {
      level2: {
        level3: {
          level4: "deep value",
        },
      },
    },
  };

  it("resolves a 4-level deep path", () => {
    expect(
      resolveKey(deepDict as unknown as Record<string, unknown>, "level1.level2.level3.level4")
    ).toBe("deep value");
  });

  it("returns path for partially correct deep path", () => {
    expect(
      resolveKey(deepDict as unknown as Record<string, unknown>, "level1.level2.level3.missing")
    ).toBe("level1.level2.level3.missing");
  });

  it("returns path for path that exceeds depth", () => {
    expect(
      resolveKey(deepDict as unknown as Record<string, unknown>, "level1.level2.level3.level4.extra")
    ).toBe("level1.level2.level3.level4.extra");
  });

  it("handles single key path", () => {
    expect(
      resolveKey(deepDict as unknown as Record<string, unknown>, "level1")
    ).toBe("level1");
  });
});
