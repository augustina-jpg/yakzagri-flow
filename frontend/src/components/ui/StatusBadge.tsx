"use client";

import React from "react";

// ─── Shared status → style mapping ────────────────────────────────────────────
// Single source of truth for status badge styling across /assets, /trades and
// /dashboard. Uses existing design tokens only (no ad-hoc colors).

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export interface StatusStyle {
  tone: StatusTone;
  label: string;
  className: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "text-status-success bg-status-success/10 border-status-success/20",
  warning: "text-status-warning bg-status-warning/10 border-status-warning/20",
  danger: "text-status-danger bg-status-danger/10 border-status-danger/20",
  info: "text-gold bg-gold-muted border-gold/20",
  neutral: "text-text-secondary bg-surface-2 border-border-default",
};

const STATUS_MAP: Record<string, { tone: StatusTone; label: string }> = {
  // active-ish
  active: { tone: "success", label: "Active" },
  funded: { tone: "success", label: "Funded" },
  delivered: { tone: "success", label: "Delivered" },
  // pending-ish
  created: { tone: "warning", label: "Pending" },
  pending: { tone: "warning", label: "Pending" },
  // completed-ish
  completed: { tone: "info", label: "Completed" },
  settled: { tone: "info", label: "Settled" },
  // disputed
  disputed: { tone: "danger", label: "Disputed" },
};

const FALLBACK: { tone: StatusTone; label: string } = {
  tone: "neutral",
  label: "Unknown",
};

/**
 * Resolve a status string to its shared style descriptor.
 * Unknown statuses fall back to a neutral tone with a title-cased label.
 */
export function getStatusStyle(status: string | null | undefined): StatusStyle {
  const key = (status ?? "").toLowerCase().trim();
  const entry = STATUS_MAP[key] ?? {
    tone: FALLBACK.tone,
    label: key ? key.charAt(0).toUpperCase() + key.slice(1) : FALLBACK.label,
  };
  return {
    tone: entry.tone,
    label: entry.label,
    className: TONE_CLASSES[entry.tone],
  };
}

/** Convenience helper returning just the Tailwind class string. */
export function getStatusBadgeClasses(status: string | null | undefined): string {
  return getStatusStyle(status).className;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const { label, className: toneClass } = getStatusStyle(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneClass} ${className}`.trim()}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
