#!/usr/bin/env node
/**
 * Fail when a source file uses a *semantic* Tailwind colour utility that has no
 * token definition. This is the class of bug that made the `*State` components
 * render unstyled (`bg-danger`, `text-warning`, `bg-surface-variant`,
 * `text-content`, ...).
 *
 * It only inspects the project's own colour namespaces (surface / bg / text /
 * status / danger / warning / success / info / content / gold / emerald /
 * accent / skeleton / border / teal) so it never second-guesses the stock
 * Tailwind palette, arbitrary values (`bg-[#101E18F2]`) or non-colour utilities
 * (`text-sm`, `border-2`, `ring-offset-2`, ...).
 *
 * The check also enforces the single naming convention for the elevated/surface
 * tokens: the canonical names are `surface`, `surface-elevated` and `surface-card`.
 * The legacy aliases `bg-elevated`, `bg-bg-elevated`, `bg-card` and `bg-bg-card`
 * are reported as violations so the codebase can't drift back into mixed names.
 *
 * Usage: node scripts/check-tailwind-colors.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(FRONTEND_DIR, "src");
const CONFIG = join(FRONTEND_DIR, "tailwind.config.ts");
const CSS = join(FRONTEND_DIR, "src", "app", "globals.css");

/** Tailwind utility prefixes that can carry a colour. */
const UTILITY_PREFIXES = [
  "ring-offset",
  "placeholder",
  "decoration",
  "divide",
  "outline",
  "accent",
  "border",
  "caret",
  "shadow",
  "stroke",
  "fill",
  "ring",
  "text",
  "from",
  "via",
  "to",
  "bg",
];

/** Project-specific colour namespaces that this guard validates. */
const SEMANTIC_NAMESPACES = [
  "surface",
  "bg",
  "text",
  "status",
  "danger",
  "warning",
  "success",
  "info",
  "content",
  "gold",
  "emerald",
  "accent",
  "skeleton",
  "border",
  "teal",
];

/**
 * Legacy / inconsistent token names that must not appear in source. The
 * canonical names are `surface`, `surface-elevated` and `surface-card`.
 */
const FORBIDDEN_TOKENS = new Set([
  "elevated",
  "bg-elevated",
  "card",
  "bg-card",
]);

const STOCK_PALETTES = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];
const SHADES = new Set([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);

// `bg-surface-2`, `hover:text-text-muted`, `focus:ring-offset-2`, `bg-bg-elevated/80`, ...
const UTILITY_RE = new RegExp(
  String.raw`(?<![\w-])(?:(?:[a-z][a-z0-9-]*:)*)((?:${UTILITY_PREFIXES.join("|")})-[a-z0-9][a-z0-9-]*)`,
  "g",
);

/** Every colour token the project defines. */
function readDefinedTokens() {
  const defined = new Set();
  const raw = readFileSync(CONFIG, "utf8");

  // `"token": "var(--...)"` / `token: "var(--...)"` covers colors,
  // backgroundColor, textColor and borderColor.
  for (const match of raw.matchAll(/"?([A-Za-z0-9-]+)"?\s*:\s*"var\(--/g)) {
    defined.add(match[1]);
  }
  // Literal (non-var) colour tokens, e.g. `teal: "#14B8A6"`.
  for (const match of raw.matchAll(/"?([A-Za-z0-9-]+)"?\s*:\s*"#[0-9A-Fa-f]{3,8}"/g)) {
    defined.add(match[1]);
  }

  // `@theme inline { --color-<token>: ... }` is the v4-side token set.
  let css = "";
  try {
    css = readFileSync(CSS, "utf8");
  } catch {
    /* globals.css is optional for this check */
  }
  for (const match of css.matchAll(/--color-([A-Za-z0-9-]+)\s*:/g)) {
    defined.add(match[1]);
  }
  return defined;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
  }
  return out;
}

function isBuiltIn(token) {
  const shade = /^([a-z-]+)-(\d{2,3})$/.exec(token);
  if (shade && STOCK_PALETTES.includes(shade[1]) && SHADES.has(Number(shade[2]))) {
    return true;
  }
  return ["transparent", "current", "inherit", "auto", "none"].includes(token);
}

/** Reduce a single class utility to its colour token, or null if not a semantic colour. */
function colourToken(utility) {
  for (const prefix of UTILITY_PREFIXES) {
    if (!utility.startsWith(prefix + "-")) continue;
    const rest = utility.slice(prefix.length + 1);
    const namespace = rest.split("-")[0];
    return SEMANTIC_NAMESPACES.includes(namespace) ? rest : null;
  }
  return null;
}

function main() {
  const defined = readDefinedTokens();
  const problems = [
    // The legacy aliases are defined in the config so the defined-token check
    // would otherwise pass; forbid them explicitly instead.
  ];
  let files = [];
  try {
    files = walk(SRC_DIR);
  } catch {
    console.error(`check-tailwind-colors: cannot read ${SRC_DIR}`);
    process.exit(1);
  }

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(UTILITY_RE)) {
      const utility = match[1];
      const token = colourToken(utility);
      if (!token) continue;
      const relative = file.slice(FRONTEND_DIR.length + 1);
      if (FORBIDDEN_TOKENS.has(token)) {
        problems.push(
          `${relative}: "${utility}" uses legacy colour token "${token}" (use "surface", "surface-elevated" or "surface-card")`,
        );
        continue;
      }
      if (isBuiltIn(token) || defined.has(token)) continue;
      problems.push(
        `${relative}: "${utility}" uses undefined colour token "${token}"`,
      );
    }
  }

  if (problems.length > 0) {
    console.error("Undefined or inconsistent semantic Tailwind colour utilities found:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      "\nDefine the token in tailwind.config.ts and the matching --color-* variable in src/app/globals.css.",
    );
    process.exit(1);
  }

  console.log(
    `check-tailwind-colors: OK (${defined.size} colour tokens, ${files.length} files scanned)`,
  );
}

main();