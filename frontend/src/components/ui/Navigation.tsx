"use client";

import Link from "next/link";
import { useState, type ReactNode, type ButtonHTMLAttributes } from "react";

export const NAV_ITEM_BASE =
  "inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2";
export const NAV_ITEM_ACTIVE = "bg-surface-2 text-gold shadow-elev-1";
export const NAV_ITEM_INACTIVE =
  "text-text-secondary hover:text-text-primary hover:bg-surface-2/60";

export interface NavLinkProps {
  href: string;
  isActive?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

export function NavLink({
  href,
  isActive = false,
  title,
  className = "",
  children,
}: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`${NAV_ITEM_BASE} ${isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE} ${className}`.trim()}
      title={title}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

export interface NavButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  isActive?: boolean;
  className?: string;
  children: ReactNode;
}

export function NavButton({
  isActive = false,
  className = "",
  children,
  ...props
}: NavButtonProps) {
  return (
    <button
      className={`${NAV_ITEM_BASE} ${isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export interface MobileNavDrawerProps {
  title?: string;
  children: ReactNode;
}

export function MobileNavDrawer({ title = "Navigation", children }: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Toggle navigation menu"
        className={NAV_ITEM_BASE}
      >
        <span aria-hidden="true">☰</span>
      </button>
      {open && (
        <nav
          aria-label={title}
          className="fixed inset-x-0 top-14 z-50 border-b border-border-default bg-bg-elevated p-4 shadow-lg flex flex-col gap-2"
        >
          {children}
        </nav>
      )}
    </div>
  );
}
