// frontend/src/lib/exportTrades.ts

/**
 * Shared client-side export utility for trade history.
 *
 * Serializes an array of trade objects to RFC-4180 CSV (with formula-injection
 * sanitization) or JSON, and triggers a browser file download with a
 * timestamped filename.
 */

export type TradeExportFormat = "csv" | "json";

/**
 * A trade record. Kept intentionally loose so both /trades and /assets can
 * reuse this utility with their own (possibly extended) trade shapes.
 */
export interface ExportableTrade {
  [key: string]: unknown;
}

/** Characters that can trigger formula injection in spreadsheet software. */
const FORMULA_INJECTION_PREFIXES = ["=", "+", "-", "@"];

/**
 * Sanitize a text value against CSV/formula injection by prefixing a single
 * quote when the value starts with `=`, `+`, `-`, or `@`.
 */
export function sanitizeCsvValue(value: string): string {
  if (value.length === 0) {
    return value;
  }
  const firstChar = value.charAt(0);
  if (FORMULA_INJECTION_PREFIXES.includes(firstChar)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Convert a single value to its string representation for CSV output.
 * Handles null/undefined, numbers, booleans, dates, and objects.
 */
function stringifyCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Escape a single CSV field per RFC-4180:
 * - Sanitize against formula injection.
 * - Quote fields containing commas, quotes, or newlines.
 * - Escape embedded quotes by doubling them.
 */
export function escapeCsvField(value: unknown): string {
  const raw = stringifyCsvValue(value);
  const sanitized = sanitizeCsvValue(raw);

  const needsQuoting =
    sanitized.includes(",") ||
    sanitized.includes('"') ||
    sanitized.includes("\n") ||
    sanitized.includes("\r");

  if (needsQuoting) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/**
 * Serialize an array of trade objects to an RFC-4180 CSV string.
 *
 * @param trades  The trades to serialize.
 * @param columns Optional explicit column order. When omitted, the union of
 *                keys across all trades is used (in first-seen order).
 */
export function tradesToCsv(
  trades: ExportableTrade[],
  columns?: string[]
): string {
  const cols = columns && columns.length > 0 ? columns : collectColumns(trades);

  const header = cols.map((col) => escapeCsvField(col)).join(",");
  const rows = trades.map((trade) =>
    cols.map((col) => escapeCsvField(trade[col])).join(",")
  );

  return [header, ...rows].join("\r\n");
}

/**
 * Serialize an array of trade objects to a pretty-printed JSON string.
 */
export function tradesToJson(trades: ExportableTrade[]): string {
  return JSON.stringify(trades, null, 2);
}

/**
 * Collect the union of keys across all trades, preserving first-seen order.
 */
function collectColumns(trades: ExportableTrade[]): string[] {
  const seen = new Set<string>();
  const cols: string[] = [];
  for (const trade of trades) {
    if (trade && typeof trade === "object") {
      for (const key of Object.keys(trade)) {
        if (!seen.has(key)) {
          seen.add(key);
          cols.push(key);
        }
      }
    }
  }
  return cols;
}

/**
 * Build a timestamped filename, e.g. `trades-2024-01-15T10-30-00-000Z.csv`.
 */
export function buildExportFilename(
  format: TradeExportFormat,
  baseName = "trades",
  date: Date = new Date()
): string {
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  return `${baseName}-${timestamp}.${format}`;
}

/**
 * Trigger a browser download of the given content.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Release the object URL on the next tick so the download can start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Serialize trades to the requested format and trigger a browser download.
 *
 * @returns The filename that was used for the download.
 */
export function exportTrades(
  trades: ExportableTrade[],
  format: TradeExportFormat = "csv",
  options: { columns?: string[]; baseName?: string; date?: Date } = {}
): string {
  const { columns, baseName = "trades", date = new Date() } = options;

  const content =
    format === "csv" ? tradesToCsv(trades, columns) : tradesToJson(trades);
  const mimeType =
    format === "csv" ? "text/csv" : "application/json";
  const filename = buildExportFilename(format, baseName, date);

  downloadFile(content, filename, mimeType);

  return filename;
}