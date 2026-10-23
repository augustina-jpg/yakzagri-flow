#!/usr/bin/env node
// Verifies that every NEXT_PUBLIC_* variable referenced via process.env in
// frontend/src/ is documented in frontend/.env.example. Fails CI (exit 1) when
// a referenced key is missing from the example file.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, "..");
const srcDir = join(frontendRoot, "src");
const envExamplePath = join(frontendRoot, ".env.example");

const ENV_REF = /process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g;
const ENV_BRACKET_REF = /process\.env\[\s*["'](NEXT_PUBLIC_[A-Z0-9_]+)["']\s*\]/g;
const SOURCE_EXT = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (SOURCE_EXT.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function collectReferencedKeys() {
  const keys = new Map();
  for (const file of walk(srcDir)) {
    const content = readFileSync(file, "utf8");
    for (const re of [ENV_REF, ENV_BRACKET_REF]) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(content)) !== null) {
        const key = match[1];
        if (!keys.has(key)) keys.set(key, new Set());
        keys.get(key).add(file.slice(frontendRoot.length + 1));
      }
    }
  }
  return keys;
}

function collectDeclaredKeys() {
  const declared = new Set();
  const content = readFileSync(envExamplePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key) declared.add(key);
  }
  return declared;
}

function main() {
  const referenced = collectReferencedKeys();
  const declared = collectDeclaredKeys();

  const missing = [...referenced.keys()].filter((key) => !declared.has(key)).sort();

  if (missing.length > 0) {
    console.error(
      "[check-env-example] The following NEXT_PUBLIC_* variables are referenced in src/ but missing from .env.example:",
    );
    for (const key of missing) {
      const files = [...referenced.get(key)].sort().join(", ");
      console.error(`  - ${key} (referenced in ${files})`);
    }
    console.error("\nAdd them to frontend/.env.example to keep docs in sync.");
    process.exit(1);
  }

  console.log(
    `[check-env-example] OK — all ${referenced.size} NEXT_PUBLIC_* variable(s) referenced in src/ are documented in .env.example.`,
  );
}

main();
