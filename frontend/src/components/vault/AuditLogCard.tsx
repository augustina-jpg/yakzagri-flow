
"use client";

import { t as translateCopy } from "@/lib/i18n";
import { BentoCard } from "@/components/ui/BentoCard";
import {
  Shield,
  Fingerprint,
  Database,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import RequestIcon from "@/app/assets/RequestIcon.png";

type LogType = "biometric" | "multi-sig" | "ledger";

type EventCategory = "deposit" | "release" | "dispute" | "rebalance";

interface AuditLogEntry {
  type: LogType;
  title: string;
  metadata: string;
  eventType?: EventCategory;
  txHash?: string;
}

interface AuditLogCardProps {
  entries: AuditLogEntry[];
  isLiveSync?: boolean;
}

const EVENT_FILTERS: { value: EventCategory; label: string }[] = [
  { value: "deposit", label: "Deposit" },
  { value: "release", label: "Release" },
  { value: "dispute", label: "Dispute" },
  { value: "rebalance", label: "Rebalance" },
];

const STELLAR_EXPERT_TX_URL = "https://stellar.expert/explorer/public/tx/";
=======

const logIcons: Record<LogType, ReactNode> = {
  biometric: <Fingerprint className="w-4 h-4 text-emerald" />,
  "multi-sig": <Image src={RequestIcon} alt={translateCopy("ui.multisig_icon_c59f159")} />,
  ledger: <Database className="w-4 h-4 text-text-secondary" />,
};

const logBgColors: Record<LogType, string> = {
  biometric: "bg-emerald-muted",
  "multi-sig": "bg-gold-muted",
  ledger: "bg-bg-elevated",
};

export function AuditLogCard({ entries, isLiveSync = true }: AuditLogCardProps) {
  const [activeFilter, setActiveFilter] = useState<EventCategory | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const filteredEntries = useMemo(
    () =>
      activeFilter
        ? entries.filter((entry) => entry.eventType === activeFilter)
        : entries,
    [entries, activeFilter],
  );

  const handleFilterToggle = useCallback((value: EventCategory) => {
    setActiveFilter((current) => (current === value ? null : value));
  }, []);

  const handleCopy = useCallback(async (txHash: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(txHash);
      }
      setCopiedHash(txHash);
      window.setTimeout(() => {
        setCopiedHash((current) => (current === txHash ? null : current));
      }, 2000);
    } catch {
      setCopiedHash(null);
    }
  }, []);

  return (
    <BentoCard
      title={translateCopy("ui.audit_log_28dd753")}
      icon={<Shield className="w-5 h-5" />}
      glowVariant="emerald"
      className="h-full"
    >
      <div className="flex items-center justify-end -mt-8 mb-6">
        {isLiveSync && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald bg-emerald-muted px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            {translateCopy("ui.live_sync_5f44c91")}
          </span>
        )}
      </div>

      <div
        role="group"
        aria-label="Filter audit log by event type"
        className="flex flex-wrap gap-2 mb-4"
      >
        {EVENT_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleFilterToggle(filter.value)}
              className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                isActive
                  ? "bg-emerald text-[#03110B]"
                  : "bg-bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <p className="text-xs text-text-secondary">
            No audit entries for this event type.
          </p>
        ) : (
          filteredEntries.map((entry, index) => {
            const isCopied = entry.txHash != null && copiedHash === entry.txHash;
            return (
              <div
                key={entry.txHash ?? index}
                className="flex items-start gap-3 bg-[#03110B4D] p-4 rounded-lg h-20"
              >
                <div
                  className={`w-10 h-10 rounded-full ${logBgColors[entry.type]} flex items-center justify-center shrink-0 mb-12`}
                >
                  {logIcons[entry.type]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    {entry.title}
                  </p>
                  <p className="text-xs text-text-secondary">{entry.metadata}</p>
                  {entry.txHash && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-text-secondary truncate">
                        {entry.txHash}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(entry.txHash as string)}
                        aria-label={`Copy transaction hash ${entry.txHash}`}
                        className="text-text-secondary hover:text-emerald shrink-0"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <a
                        href={`${STELLAR_EXPERT_TX_URL}${entry.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View transaction ${entry.txHash} on Stellar Expert`}
                        className="text-text-secondary hover:text-emerald shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <span role="status" aria-live="polite" className="sr-only">
                        {isCopied ? "Transaction hash copied" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </BentoCard>
  );
}
