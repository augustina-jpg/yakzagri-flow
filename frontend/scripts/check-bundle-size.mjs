#!/usr/bin/env node
// Enforces a maximum client bundle size budget after `next build`.
// Usage: node scripts/check-bundle-size.mjs [--budget-kb=2048]
// Reads the Next.js build manifest to sum the size of client JS chunks.

import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const nextDir = join(projectRoot, '.next');

const DEFAULT_BUDGET_KB = 2048;

function parseBudget() {
  const arg = process.argv.find((a) => a.startsWith('--budget-kb='));
  if (!arg) return DEFAULT_BUDGET_KB;
  const value = Number(arg.split('=')[1]);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_BUDGET_KB;
}

function collectChunkFiles(manifest) {
  const files = new Set();
  for (const entry of Object.values(manifest)) {
    if (!entry || typeof entry !== 'object') continue;
    for (const key of ['files', 'css', 'staticFiles']) {
      const list = entry[key];
      if (Array.isArray(list)) {
        for (const file of list) files.add(file);
      }
    }
  }
  return files;
}

function main() {
  const budgetKb = parseBudget();
  const manifestPath = join(nextDir, 'build-manifest.json');

  if (!existsSync(manifestPath)) {
    console.error(
      `[bundle-budget] Missing ${manifestPath}. Run \`next build\` before checking the bundle size.`,
    );
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const files = collectChunkFiles(manifest);

  let totalBytes = 0;
  for (const file of files) {
    const fullPath = join(nextDir, file);
    if (!existsSync(fullPath)) continue;
    totalBytes += statSync(fullPath).size;
  }

  const totalKb = totalBytes / 1024;
  const budgetBytes = budgetKb * 1024;
  const formatted = `${totalKb.toFixed(1)} kB`;

  if (totalBytes > budgetBytes) {
    console.error(
      `[bundle-budget] FAIL: client bundle is ${formatted}, exceeding the ${budgetKb} kB budget.`,
    );
    process.exit(1);
  }

  console.log(
    `[bundle-budget] OK: client bundle is ${formatted} (budget ${budgetKb} kB).`,
  );
}

main();
