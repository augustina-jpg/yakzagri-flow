"use client";
import { t as translateCopy } from "@/lib/i18n";


import React from "react";
import type { TransactionEvent, TransactionEventStatus } from "@/types/trade";
import { TimelineEventItem } from "./TimelineEventItem";

interface TransactionTimelineProps {
  events: TransactionEvent[];
  currentEventIndex: number;
}

/**
 * On-chain event types emitted by the amana_escrow contract
 * (see schemas/events/amana_escrow.events.json).
 */
const ON_CHAIN_EVENT_TYPES = new Set<string>([
  "escrow_created",
  "escrow_funded",
  "escrow_released",
  "escrow_refunded",
  "escrow_disputed",
  "escrow_resolved",
  "escrow_cancelled",
  "escrow_completed",
]);

/**
 * Human-readable descriptions for on-chain escrow events so the timeline
 * reflects trade progress instead of raw event payloads.
 */
const ON_CHAIN_EVENT_DESCRIPTIONS: Record<string, string> = {
  escrow_created: "Escrow created on-chain",
  escrow_funded: "Escrow funded on-chain",
  escrow_released: "Funds released from escrow",
  escrow_refunded: "Funds refunded from escrow",
  escrow_disputed: "Dispute opened on-chain",
  escrow_resolved: "Dispute resolved on-chain",
  escrow_cancelled: "Escrow cancelled on-chain",
  escrow_completed: "Escrow completed on-chain",
};

function isOnChainEvent(event: TransactionEvent): boolean {
  return ON_CHAIN_EVENT_TYPES.has(event.type ?? "");
}

function describeEvent(event: TransactionEvent): string {
  const eventType = event.type ?? "";
  const onChainDescription = ON_CHAIN_EVENT_DESCRIPTIONS[eventType];
  if (onChainDescription) return onChainDescription;
  return event.description ?? event.title ?? eventType;
}

function resolveStatus(
  index: number,
  currentEventIndex: number,
): TransactionEventStatus {
  if (index < currentEventIndex) return "completed";
  if (index === currentEventIndex) return "active";
  return "pending";
}

/**
 * Merges on-chain events and off-chain actions into a single ordered
 * timeline so trade progress is reflected accurately in one place.
 */
function mergeEvents(events: TransactionEvent[]): TransactionEvent[] {
  return [...events].sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTime - bTime;
  });
}

export function TransactionTimeline({
  events,
  currentEventIndex,
}: TransactionTimelineProps) {
  const mergedEvents = mergeEvents(events);

  return (
    <div className="bg-card rounded-xl border border-border-default p-6 shadow-elev-1 flex flex-col flex-1">
      <div className="flex items-center gap-2 mb-5">
        <svg
          className="w-4 h-4 text-gold"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="text-sm font-semibold text-text-secondary tracking-wide uppercase">
          {translateCopy("ui.transaction_timeline_da01b35")}
        </h2>
      </div>

      <div className="flex flex-col flex-1 relative">
        {mergedEvents.map((event, index) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            status={event.status ?? resolveStatus(index, currentEventIndex)}
            isLast={index === events.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
