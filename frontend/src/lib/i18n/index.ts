/**
 * i18n entry point. Import formatters and `t()` from here.
 *
 *   import { t, formatNaira, formatDate } from "@/lib/i18n";
 *   t("wallet.wrongNetworkBody", { expected: "Testnet" }); // → "Switch Freighter to Testnet…"
 */
import en from "./messages/en";
import ha from "./messages/ha";
import yo from "./messages/yo";
import ig from "./messages/ig";
import { pseudoLocalize } from "./pseudo";
import { resolveLocale, type Locale } from "./config";

export * from "./config";
export * from "./format";
export { pseudoLocalize } from "./pseudo";

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
type Messages = Widen<typeof en>;
type PartialMessages<T> = T extends string
  ? string
  : { [K in keyof T]?: PartialMessages<T[K]> };
type Catalog = PartialMessages<Messages>;

// Recursively derive dot-path keys ("wallet.connect", "common.retry", …).
type Join<K, P> = K extends string
  ? P extends string
    ? `${K}${"" extends P ? "" : "."}${P}`
    : never
  : never;

type Paths<T> = {
  [K in keyof T]-?: T[K] extends object ? Join<K, Paths<T[K]>> : K & string;
}[keyof T];

export type MessageKey = Paths<Messages>;

const CATALOGS: Record<Locale, Catalog> = {
  "en-NG": en,
  "en-US": en,
  "ha-NG": ha,
  "yo-NG": yo,
  "ig-NG": ig,
  pseudo: en,
};

function lookup(catalog: Catalog, key: string): string | undefined {
  return key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], catalog) as
    | string
    | undefined;
}

/**
 * Redacts raw user prompts, Stellar secret keys, JWT tokens, and long free-form
 * inputs so diagnostic logs never leak sensitive prompt material.
 */
export function sanitizeDiagnosticMeta(input: string): string {
  if (!input) return "";
  const redactedSecrets = input
    .replace(/\bS[A-Z2-7]{55}\b/g, "[REDACTED_STELLAR_SECRET]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_TOKEN]");
  if (redactedSecrets.length > 64 || /\s/.test(redactedSecrets)) {
    return "[REDACTED_PROMPT]";
  }
  return redactedSecrets;
}

function resolveIcuPlurals(template: string, params?: Record<string, string | number>): string {
  if (!params || !template.includes("plural")) return template;
  return template.replace(
    /\{(\w+),\s*plural,\s*((?:(?:zero|one|two|few|many|other|=\d+)\s*\{[^{}]*\}\s*)+)\}/g,
    (match, varName: string, body: string) => {
      const rawVal = params[varName];
      const count = typeof rawVal === "number" ? rawVal : Number(rawVal);
      if (!Number.isFinite(count)) return match;

      const branches: Record<string, string> = {};
      const branchRegex = /(zero|one|two|few|many|other|=\d+)\s*\{([^{}]*)\}/g;
      let branchMatch: RegExpExecArray | null;
      while ((branchMatch = branchRegex.exec(body)) !== null) {
        branches[branchMatch[1]] = branchMatch[2];
      }

      const exactKey = `=${count}`;
      let chosen = branches[exactKey];
      if (chosen === undefined && count === 0 && "zero" in branches) {
        chosen = branches.zero;
      }
      if (chosen === undefined) {
        const category = count === 1 ? "one" : "other";
        chosen = branches[category] ?? branches.other ?? "";
      }

      return chosen.replace(/#/g, String(count));
    },
  );
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  const withPlurals = resolveIcuPlurals(template, params);
  return withPlurals.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

export interface TranslateOptions {
  locale?: Locale;
  params?: Record<string, string | number>;
}

/** Resolve a catalog key to a localized string. Falls back to the key itself. */
export function t(key: MessageKey, params?: Record<string, string | number>): string;
export function t(key: MessageKey, options: TranslateOptions): string;
export function t(
  key: MessageKey,
  paramsOrOptions?: Record<string, string | number> | TranslateOptions,
): string {
  const isOptions =
    paramsOrOptions !== undefined &&
    ("locale" in paramsOrOptions || "params" in paramsOrOptions);
  const options = (isOptions ? paramsOrOptions : { params: paramsOrOptions }) as TranslateOptions;
  const locale = options.locale ?? resolveLocale();

  const catalog = CATALOGS[locale] ?? en;
  const raw = lookup(catalog, key) ?? lookup(en, key);
  if (raw === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] missing message key: ${sanitizeDiagnosticMeta(String(key))}`);
    }
    return key;
  }

  const resolved = interpolate(raw, options.params);
  return locale === "pseudo" ? pseudoLocalize(resolved) : resolved;
}
