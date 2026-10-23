"use client";
import { t as translateCopy } from "@/lib/i18n";


import React from "react";
import { Eye, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { TradeStatus } from "@/types/trade";

export interface TradeListItemProps {
  tradeId: string;
  commodity: string;
  counterparty: { role: string; address: string };
  amountCngn: string;
  status: TradeStatus;
  createdAt: string;
  isOptimisticPending?: boolean;
  pendingMutationLabel?: string;
  onView: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function TradeListItem({
  tradeId,
  commodity,
  counterparty,
  amountCngn,
  status,
  createdAt,
  isOptimisticPending = false,
  pendingMutationLabel = "Syncing…",
  onView,
  onDeposit,
  onWithdraw,
}: TradeListItemProps) {
  return (
    <div
      data-testid={`trade-card-${tradeId}`}
      aria-busy={isOptimisticPending}
      className={`flex items-center justify-between p-4 bg-card border rounded-lg mb-3 hover:border-gold/30 hover:bg-elevated transition-colors group ${
        isOptimisticPending
          ? "border-gold/50 bg-gold/5 animate-pulse"
          : "border-border-default"
      }`}
    >
      {/* Left — commodity + meta */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onView}
            aria-label={`View trade ${tradeId} — ${commodity} ${amountCngn} cNGN, status ${status}`}
            className="text-left text-lg font-medium text-text-primary truncate focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
          >
            {commodity}
          </button>
          {isOptimisticPending && (
            <span
              role="status"
              data-testid={`trade-optimistic-indicator-${tradeId}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-gold animate-ping"
              />
              {pendingMutationLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-white/5 text-teal text-xs px-2 py-1 rounded">
            {counterparty.role}
          </span>
          <span className="font-mono text-text-muted text-sm">
            {truncateAddress(counterparty.address)}
          </span>
        </div>

        <span className="font-mono text-text-muted text-sm">{tradeId}</span>
      </div>

      {/* Right — amount + status + actions */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end gap-1">
          <span className="text-text-primary font-semibold text-sm">
            {amountCngn}{" "}
            <span className="text-text-muted font-normal">cNGN</span>
          </span>
          <span className="text-text-muted text-xs">{createdAt}</span>
        </div>

        <span className="hidden sm:inline-flex">
          <StatusBadge status={status} size="sm" />
        </span>

        <div className="flex items-center gap-3">
          <button
            onClick={onView}
            aria-label={`View trade ${tradeId}`}
            title={translateCopy("ui.view_trade_2c6ad20")}
            className="p-2 rounded-lg border border-border-default text-text-muted hover:border-border-hover hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
          >
            <Eye aria-hidden="true" className="w-4 h-4" />
          </button>

          {onDeposit && (
            <button
              onClick={onDeposit}
              aria-label={`Deposit for trade ${tradeId}`}
              title={translateCopy("ui.deposit_e7b0b31")}
              className="p-2 rounded-lg border border-border-default text-text-muted hover:border-emerald/40 hover:text-emerald transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
            >
              <ArrowDownToLine aria-hidden="true" className="w-4 h-4" />
            </button>
          )}

          {onWithdraw && (
            <button
              onClick={onWithdraw}
              aria-label={`Withdraw for trade ${tradeId}`}
              title={translateCopy("ui.withdraw_47e5641")}
              className="p-2 rounded-lg border border-border-default text-text-muted hover:border-status-danger/40 hover:text-status-danger transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
            >
              <ArrowUpFromLine aria-hidden="true" className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
