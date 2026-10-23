"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { ToastMessage } from "@/types/toast";
import { clsx } from "clsx";
import { t } from "@/lib/i18n";

interface ToastProps extends ToastMessage {
  onClose: (id: string) => void;
}

export function Toast({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose,
}: ToastProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // Milliseconds left before auto-dismiss, preserved across pause/resume.
  const remainingRef = useRef(duration);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    timerStartedAtRef.current = null;
    setIsClosing(true);
    // Wait for the slide-out/fade-out animation to finish before actually removing it
    setTimeout(() => {
      onClose(id);
    }, 300); // 300ms matches our transition duration
  }, [id, onClose]);

  // Reset the countdown whenever the duration prop changes.
  useEffect(() => {
    remainingRef.current = duration;
  }, [duration]);

  // Auto-dismiss countdown. Pauses while the toast is hovered or holds focus
  // (WCAG 2.2.1 Timing Adjustable) and resumes with the remaining time on leave.
  useEffect(() => {
    if (duration <= 0 || isPaused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      remainingRef.current = 0;
      handleClose();
    }, remainingRef.current);
    return () => {
      clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [duration, isPaused, handleClose]);

  const IconMap = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = IconMap[type];

  // Base styling for the toast
  const baseClasses =
    "pointer-events-auto flex w-full max-w-md rounded-lg shadow-elev-1 ring-1 ring-black/5 p-4 transition-all duration-300 transform items-start gap-3 relative overflow-hidden backdrop-blur-md";

  // Animation classes
  const animationClasses = isClosing
    ? "opacity-0 translate-x-full"
    : "opacity-100 translate-x-0";

  // Type-specific colors using our tailwind tokens
  const typeClasses = {
    success: "bg-bg-elevated/95 border border-status-success/30 text-text-primary",
    error: "bg-status-danger/10 border border-status-danger/40 text-text-primary",
    warning: "bg-status-warning/10 border border-status-warning/40 text-text-primary",
    info: "bg-status-info/10 border border-status-info/40 text-text-primary",
  };

  const iconColors = {
    success: "text-status-success",
    error: "text-status-danger",
    warning: "text-status-warning",
    info: "text-status-info",
  };

  // Transient toasts are not part of the document outline, so the title is a
  // plain paragraph that labels the live region instead of a heading element.
  const titleId = `toast-title-${id}`;

  return (
    <div
      onMouseEnter={() => {
        isHoveredRef.current = true;
        pauseTimer();
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        if (!isFocusedRef.current) resumeTimer();
      }}
      onFocusCapture={() => {
        isFocusedRef.current = true;
        pauseTimer();
      }}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        isFocusedRef.current = false;
        if (!isHoveredRef.current) resumeTimer();
      }}
      className={clsx(
        baseClasses,
        animationClasses,
        typeClasses[type]
      )}
      role="group"
      aria-labelledby={title ? titleId : undefined}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <Icon className={clsx("h-6 w-6 shrink-0", iconColors[type])} />
      <div className="flex-1 pt-0.5">
        {title && (
          <p id={titleId} className="text-sm font-semibold mb-1">
            {title}
          </p>
        )}
        <p className="text-sm text-text-secondary">{message}</p>
      </div>
      <button
        onClick={handleClose}
        className="shrink-0 ml-4 rounded-md p-1.5 inline-flex text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
        aria-label={t("common.close")}
      >
        <span className="sr-only">{t("common.close")}</span>
        <X className="h-4 w-4" />
      </button>
      
      {/* Optional: subtle progress bar for auto-dismiss */}
      {duration > 0 && (
        <div 
          className="toast-progress absolute bottom-0 left-0 h-1 w-full bg-current opacity-20"
          style={{
            animationDuration: `${duration}ms`,
            animationPlayState: isPaused ? "paused" : "running",
          }}
        />
      )}
    </div>
  );
}
