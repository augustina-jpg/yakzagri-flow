"use client";
import { t as translateCopy } from "@/lib/i18n";


import React from "react";
import { FileText } from "lucide-react";
import type { TradeDetail } from "@/types/trade";

interface TradeHeaderProps {
  trade: TradeDetail;
  onConfirmDelivery?: () => void;
  confirmingDelivery?: boolean;
}

import { StatusBadge } from "@/components/ui/StatusBadge";

export function TradeHeader({ trade, onConfirmDelivery, confirmingDelivery = false }: TradeHeaderProps) {

  return (
    <div className="bg-card rounded-xl border border-border-default p-6 shadow-elev-1">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-muted mb-4">
        <span className="hover:text-text-secondary cursor-pointer transition-colors">
          {translateCopy("ui.trades_597b109")}
        </span>
        <span>/</span>
        <span
          className="text-text-secondary max-w-[200px] truncate inline-block align-bottom"
          title={trade.id}
        >
          {trade.id}
        </span>
      </div>

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1
            className="text-3xl font-bold text-gold leading-tight truncate"
            title={`${trade.quantity} ${trade.commodity}`}
          >
            {trade.quantity} {trade.commodity}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {/* Status badge */}
            <StatusBadge status={trade.status} size="sm" showIcon />

            {/* Initiated date */}
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="1" y="2" width="14" height="13" rx="2" />
                <path d="M1 6h14M5 1v2M11 1v2" />
              </svg>
              {translateCopy("ui.initiated_87c5ebd")}{" "}{trade.initiatedAt}
            </span>

            {/* Commodity category tag */}
            <span className="px-2.5 py-0.5 rounded-md bg-gold-muted text-gold text-xs font-medium border border-gold/20">
              {trade.category}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-shrink-0">
          <a href="#trade-contract" className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border-default text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all">
            <FileText className="w-4 h-4" />
            {translateCopy("ui.view_contract_809ec07")}
          </a>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-gold-cta text-text-inverse text-sm font-semibold hover:shadow-glow-gold transition-all">
            <svg
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="8" cy="8" r="7" />
              <path d="M5 8l2.5 2.5L11 5.5" />
            </svg>
            {translateCopy("ui.confirm_delivery_e6dee98")}
          </button>
        </div>
      </div>
    </div>
  );
}
