"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useEffect, useState } from "react";
import { useOffline } from "@/hooks/useOffline";
import { useOfflineQueueStore } from "@/stores/offlineQueueStore";
import { useToast } from "@/hooks/useToast";
import { request } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";
import { submitTradeCreation } from "@/lib/trades/submitTradeCreation";
import type { CreateTradeRequest } from "@/lib/api";

export function ConnectivityBanner() {
  const { isOffline, wasOffline, retryOnline } = useOffline();
  const queue = useOfflineQueueStore((s) => s.queue);
  const dequeue = useOfflineQueueStore((s) => s.dequeue);
  const replay = useOfflineQueueStore((s) => s.replay);
  const setOnline = useOfflineQueueStore((s) => s.setOnline);
  const { token } = useAuth();
  const { addToast, addToastWithCorrelation } = useToast();
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Sync online state to queue store
  useEffect(() => {
    setOnline(!isOffline);
  }, [isOffline, setOnline]);

  // Replay on reconnect with conflict handling via idempotency keys
  useEffect(() => {
    if (!isOffline && wasOffline && queue.length > 0) {
      const correlationId = `replay-${Date.now()}`;
      addToastWithCorrelation({
        type: "info",
        title: "Reconnected",
        message: `Replay ${queue.length} queued action(s)…`,
        correlationId,
        duration: 0,
      });

      void replay(async (action) => {
        if (action.type === "create-trade") {
          if (!token) {
            throw new Error("Authenticate your wallet before syncing this trade.");
          }
          await submitTradeCreation(token, action.body as CreateTradeRequest, {
            idempotencyKey: action.idempotencyKey,
            correlationId: action.correlationId,
          });
          return;
        }

        // Reuse same idempotency key — backend #3 honors key reuse → duplicate-send prevented
        await request(action.endpoint, {
          method: action.method,
          body: action.body ? JSON.stringify(action.body) : undefined,
          headers: {
            "Idempotency-Key": action.idempotencyKey,
            "X-Correlation-Id": action.correlationId,
          },
        });
      }).then(({ succeeded, failed }) => {
        if (failed.length === 0) {
          addToast({ type: "success", title: "Synced", message: `${succeeded.length} queued action(s) completed.` });
        } else {
          addToast({ type: "warning", title: "Partial sync", message: `${succeeded.length} sent, ${failed.length} failed — will retry.` });
        }
        void retryOnline();
      });
    }
  }, [isOffline, wasOffline, queue.length, replay, retryOnline, addToast, addToastWithCorrelation, token]);

  // Accurate banner states during transition windows
  if (isOffline) {
    return (
      <>
        <div role="status" aria-live="polite" className="fixed top-0 left-0 right-0 z-[100] bg-status-warning text-text-inverse px-4 py-2 text-sm text-center flex items-center justify-center gap-3">
          <span aria-hidden>●</span>
          <span>{translateCopy("ui.you_re_offline_actions_will_be_q_7c3cdb0")}</span>
          {queue.length > 0 && (
            <button
              type="button"
              onClick={() => setInspectorOpen((prev) => !prev)}
              aria-expanded={inspectorOpen}
              className="bg-white/20 hover:bg-white/30 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors"
            >
              {queue.length} {translateCopy("ui.pending_e225869")}
            </button>
          )}
          <button
            onClick={() => void retryOnline()}
            className="ml-2 underline hover:no-underline focus-visible:outline-2 focus-visible:outline-white rounded px-1"
            aria-label={translateCopy("ui.retry_connection_a351235")}
          >
            {translateCopy("common.retry")}
          </button>
        </div>

        {inspectorOpen && queue.length > 0 && (
          <div
            role="dialog"
            aria-label="Offline Queue Inspector"
            className="fixed top-10 right-4 z-[101] w-full max-w-md rounded-lg border border-border-default bg-bg-elevated p-4 shadow-xl text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary">
                Queued Offline Actions ({queue.length})
              </h2>
              <button
                type="button"
                onClick={() => setInspectorOpen(false)}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                Close
              </button>
            </div>
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {queue.map((action) => (
                <li
                  key={action.id}
                  className="flex items-center justify-between gap-2 rounded border border-border-default bg-bg-secondary px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary truncate">{action.label || action.type}</p>
                    <p className="text-text-muted truncate">
                      {action.method} {action.endpoint} · Retries: {action.retries}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dequeue(action.id)}
                    className="shrink-0 rounded border border-status-danger/30 px-2 py-1 text-status-danger hover:bg-status-danger/10"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }

  if (wasOffline && queue.length > 0) {
    return (
      <div role="status" aria-live="polite" className="fixed top-0 left-0 right-0 z-[100] bg-status-info text-white px-4 py-2 text-sm text-center">
        {translateCopy("ui.reconnecting_replaying_50095e3")}{" "}{queue.length} {translateCopy("ui.queued_action_s_b2787c6")}
      </div>
    );
  }

  return null;
}

export function PendingBadge() {
  const queue = useOfflineQueueStore((s) => s.queue);
  if (queue.length === 0) return null;
  return (
    <span
      aria-label={`${queue.length} actions pending sync`}
      className="inline-flex items-center gap-1 rounded-full bg-status-warning/20 text-status-warning border border-status-warning/30 px-2 py-1 text-xs font-semibold"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse" aria-hidden />
      {queue.length} {translateCopy("ui.pending_e225869")}
    </span>
  );
}
