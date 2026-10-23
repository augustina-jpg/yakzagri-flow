"use client";
import { t as translateCopy } from "@/lib/i18n";


import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { clsx } from "clsx";

type OverlayOpacity = "light" | "medium" | "heavy";

export interface ModalProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export interface ModalContentProps extends React.ComponentPropsWithoutRef<
  typeof Dialog.Content
> {
  overlayOpacity?: OverlayOpacity;
  mobileFullScreen?: boolean;
  showCloseButton?: boolean;
  /**
   * Element that should receive focus when the dialog opens.
   *
   * Radix Dialog owns the focus trap and restores focus to the trigger on
   * close, so callers must not run their own focus effects. Use this prop only
   * to steer the *initial* target (for example a "Cancel" button in a
   * destructive confirmation). When omitted, Radix focuses the first focusable
   * element inside the dialog.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

const overlayByOpacity: Record<OverlayOpacity, string> = {
  light: "bg-black/35",
  medium: "bg-black/55",
  heavy: "bg-black/75",
};

export function Modal({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </Dialog.Root>
  );
}

export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

export function ModalPortal({ children }: { children: React.ReactNode }) {
  return <Dialog.Portal>{children}</Dialog.Portal>;
}

export function ModalContent({
  children,
  className,
  overlayOpacity = "medium",
  mobileFullScreen = true,
  showCloseButton = true,
  initialFocusRef,
  onOpenAutoFocus,
  ...props
}: ModalContentProps) {
  return (
    <ModalPortal>
      <Dialog.Overlay
        className={clsx(
          "fixed inset-0 z-50 backdrop-blur-sm transition-opacity duration-200",
          "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
          overlayByOpacity[overlayOpacity],
        )}
      />
      <Dialog.Content
        className={clsx(
          "fixed z-50 bg-card dark:bg-surface-1 border border-border-default dark:border-border-default shadow-modal",
          "transition-all duration-200 ease-out",
          "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
          "data-[state=open]:scale-100 data-[state=closed]:scale-95",
          mobileFullScreen
            ? "inset-0 rounded-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,640px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
            : "left-1/2 top-1/2 w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl",
          className,
        )}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;

          const target = initialFocusRef?.current;
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
        {...props}
      >
        {showCloseButton ? (
          <Dialog.Close
            aria-label={translateCopy("ui.close_dialog_7b29020")}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary dark:text-text-secondary transition-colors hover:bg-elevated dark:hover:bg-surface-2 hover:text-text-primary dark:hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <X size={18} />
          </Dialog.Close>
        ) : null}
        {children}
      </Dialog.Content>
    </ModalPortal>
  );
}

export const MODAL_SPACING = {
  header: "border-b border-border-default px-6 py-5 pr-14",
  body: "max-h-[70vh] overflow-y-auto px-6 py-5",
  footer:
    "flex flex-col-reverse gap-3 border-t border-border-default dark:border-border-default px-6 py-4 sm:flex-row sm:justify-end",
} as const;

export function ModalHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(MODAL_SPACING.header, className)}
      {...props}
    />
  );
}

export function ModalTitle(props: React.ComponentPropsWithoutRef<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      className={clsx("text-xl font-semibold text-primary", props.className)}
      {...props}
    />
  );
}

export function ModalDescription(
  props: React.ComponentPropsWithoutRef<typeof Dialog.Description>,
) {
  return (
    <Dialog.Description
      className={clsx("mt-1.5 text-sm text-secondary", props.className)}
      {...props}
    />
  );
}

export function ModalBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(MODAL_SPACING.body, className)}
      {...props}
    />
  );
}

export function ModalFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(MODAL_SPACING.footer, className)}
      {...props}
    />
  );
}
