"use client";
import { useEffect, useState } from "react";
import { registerServiceWorker } from "@/lib/register-sw";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function RegisterSW() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    registerServiceWorker();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  if (!deferredPrompt || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Install application"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 rounded-lg border border-gold/40 bg-bg-elevated p-4 shadow-lg flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">Install Amana on your device</p>
        <p className="text-xs text-text-secondary">Access offline trade queues and instant field updates.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="px-2 py-1 text-xs text-text-muted hover:text-text-primary"
        >
          Later
        </button>
        <button
          type="button"
          onClick={async () => {
            await deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            setDeferredPrompt(null);
          }}
          className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-bg-primary hover:opacity-90"
        >
          Install
        </button>
      </div>
    </div>
  );
}
