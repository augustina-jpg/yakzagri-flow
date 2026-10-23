"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  intlLocale,
  localeDirection,
  resolveLocale,
  setActiveLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from "./config";

const STORAGE_KEY = "amana-locale";

export function syncDocumentLocaleAttributes(locale: Locale): void {
  if (typeof document === "undefined" || !document.documentElement) return;
  document.documentElement.lang = intlLocale(locale);
  document.documentElement.dir = localeDir(locale);
  document.documentElement.setAttribute("data-locale", locale);
}

interface LocaleContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  dir: "ltr",
  setLocale: () => undefined,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(resolveLocale);

  function selectLocale(nextLocale: Locale) {
    setActiveLocale(nextLocale);
    syncDocumentLocaleAttributes(nextLocale);
    setLocaleState(nextLocale);
  }

  useEffect(() => {
    let restoreTimer: number | undefined;
    try {
      const storedLocale = window.localStorage.getItem(STORAGE_KEY);
      if (storedLocale && SUPPORTED_LOCALES.includes(storedLocale as Locale)) {
        restoreTimer = window.setTimeout(() => {
          const next = storedLocale as Locale;
          setActiveLocale(next);
          syncDocumentLocaleAttributes(next);
          setLocaleState(next);
        }, 0);
      }
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }

    return () => {
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
    };
  }, []);

  useEffect(() => {
    setActiveLocale(locale);
    const lang = intlLocale(locale);
    document.documentElement.lang = lang;
    document.documentElement.dir = localeDirection(locale);
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Keep the selection active for this session when storage is unavailable.
    }
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, dir: localeDir(locale), setLocale: selectLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}