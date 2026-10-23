"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clipboard, ExternalLink } from "lucide-react";
import { getStellarExpertAccountUrl } from "@/lib/links";

export interface WalletAddressBadgeProps {
  address: string;
  truncate?: "start" | "middle" | "end";
  showCopy?: boolean;
  showExplorer?: boolean;
  explorerNetwork?: "public" | "testnet";
  className?: string;
}

function truncateAddress(
  address: string,
  mode: WalletAddressBadgeProps["truncate"],
): string {
  if (address.length <= 14) {
    return address;
  }

  if (mode === "start") {
    return `...${address.slice(-10)}`;
  }

  if (mode === "end") {
    return `${address.slice(0, 10)}...`;
  }

  // Figma requirement: first 6 + ... + last 4
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletAddressBadge({
  address,
  truncate = "middle",
  showCopy = true,
  showExplorer = false,
  explorerNetwork = "testnet",
  className,
}: WalletAddressBadgeProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayAddress = useMemo(
    () => truncateAddress(address, truncate),
    [address, truncate],
  );

  const explorerUrl = useMemo(
    () => getStellarExpertAccountUrl(address, explorerNetwork),
    [address, explorerNetwork],
  );

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={`group bg-surface-elevated border border-border-default rounded-md px-2 py-1 font-mono text-sm inline-flex items-center gap-1.5 ${className ?? ""}`}
    >
      <span className="text-text-secondary">{displayAddress}</span>

      <span aria-live="polite" className="sr-only">
        {copied ? "Address copied to clipboard" : ""}
      </span>

      {showCopy && (
        <button
          type="button"
          onClick={() => void onCopy()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary"
          aria-label={translateCopy("ui.copy_wallet_address_43b3785")}
          title={translateCopy("ui.copy_wallet_address_43b3785")}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald" />
          ) : (
            <Clipboard className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      {showExplorer && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-gold"
          aria-label={translateCopy("ui.open_wallet_in_stellar_expert_77617d7")}
          title={translateCopy("ui.open_wallet_in_stellar_expert_77617d7")}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}