"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useState } from "react";
import { CreditCard } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoCard";
import { formatNumber } from "@/lib/i18n/format";
import { getNgnExchangeRate } from "@/lib/exchangeRate";

export interface VaultAllocationSlice {
  label: string;
  percent: number;
  colorClass: string;
}

interface PaymentOverviewCardProps {
  totalCngn: number;
  ngnRate?: number;
  allocations?: VaultAllocationSlice[];
}

const DEFAULT_ALLOCATIONS: VaultAllocationSlice[] = [
  { label: "Seller Settlement Pool", percent: 99, colorClass: "bg-emerald" },
  { label: "Platform Escrow Reserve", percent: 1, colorClass: "bg-gold" },
];

interface CostLineItem {
  label: string;
  getValue: (total: number, currency: "cNGN" | "NGN", rate: number) => string;
  dimmed?: boolean;
}

const LINE_ITEMS: CostLineItem[] = [
  {
    label: "Total Trade Value",
    getValue: (total, currency, rate) =>
      currency === "NGN"
        ? `₦${formatNumber(total * rate, { maximumFractionDigits: 2 })}`
        : `${formatNumber(total)} cNGN`,
  },
  {
    label: "EziAgric Platform Fee (1%)",
    getValue: (total, currency, rate) => {
      const fee = parseFloat((total * 0.01).toFixed(2));
      return currency === "NGN"
        ? `₦${formatNumber(fee * rate, { maximumFractionDigits: 2 })}`
        : `${formatNumber(fee)} cNGN`;
    },
  },
  {
    label: "Net Payout",
    getValue: (total, currency, rate) => {
      const net = parseFloat((total - total * 0.01).toFixed(2));
      return currency === "NGN"
        ? `₦${formatNumber(net * rate, { maximumFractionDigits: 2 })}`
        : `${formatNumber(net)} cNGN`;
    },
    dimmed: true,
  },
];

export function PaymentOverviewCard({
  totalCngn,
  ngnRate,
  allocations = DEFAULT_ALLOCATIONS,
}: PaymentOverviewCardProps) {
  // Use passed ngnRate or fall back to config
  const rate = ngnRate ?? getNgnExchangeRate();
  const [currency, setCurrency] = useState<"cNGN" | "NGN">("cNGN");

  const lockedDisplay =
    currency === "NGN"
      ? `₦${formatNumber(totalCngn * rate, { maximumFractionDigits: 2 })}`
      : `${formatNumber(totalCngn)} cNGN`;

  return (
    <BentoCard
      title={translateCopy("ui.vault_escrow_summary_e56b620")}
      icon={<CreditCard className="w-5 h-5" />}
      glowVariant="gold"
      className="h-full"
    >
      <div className="flex items-center justify-end -mt-8 mb-5">
        <div className="flex items-center gap-1 bg-bg-elevated rounded-full p-1">
          {(["cNGN", "NGN"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                currency === c
                  ? "bg-gold text-text-inverse"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-0 divide-y divide-border-default">
        {LINE_ITEMS.map(({ label, getValue, dimmed }) => (
          <div key={label} className="flex items-center justify-between py-3">
            <span
              className={`text-sm ${dimmed ? "text-text-muted" : "text-text-secondary"}`}
            >
              {label}
            </span>
            <span className="text-sm font-semibold text-text-primary">
              {getValue(totalCngn, currency, rate)}
            </span>
          </div>
        ))}
      </div>

      {/* Asset allocation breakdown */}
      <div className="mt-4 pt-3 border-t border-border-default" data-testid="vault-allocation-breakdown">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          Asset Allocation Breakdown
        </p>
        <div
          className="flex h-2 w-full rounded-full overflow-hidden gap-0.5 mb-2"
          role="img"
          aria-label="Vault asset allocation breakdown"
        >
          {allocations.map((slice) => (
            <div
              key={slice.label}
              className={slice.colorClass}
              style={{ width: `${Math.max(0, Math.min(100, slice.percent))}%` }}
              title={`${slice.label}: ${slice.percent}%`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
          {allocations.map((slice) => (
            <div key={slice.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${slice.colorClass}`} />
              <span>{slice.label}</span>
              <span className="font-semibold text-text-primary">{slice.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gold-muted/20 border-l-[3px] border-gold text-gold font-bold px-4 py-2 mt-4 rounded-r-md flex items-center justify-between">
        <span className="text-sm">{translateCopy("ui.locked_in_cngn_b80ba31")}</span>
        <span className="text-sm">{lockedDisplay}</span>
      </div>
    </BentoCard>
  );
}
