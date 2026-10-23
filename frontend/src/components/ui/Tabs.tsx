"use client";

import React from "react";

export interface TabItem<T extends React.Key = string> {
  value: T;
  label: string;
}

export interface TabsProps<T extends React.Key = string> {
  items: TabItem<T>[];
  activeValue: T;
  onChange: (value: T) => void;
  variant?: "underline" | "bordered";
  className?: string;
}

export function Tabs<T extends React.Key = string>({
  items,
  activeValue,
  onChange,
  variant = "underline",
  className = "",
}: TabsProps<T>) {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  function focusAndSelect(index: number) {
    if (items.length === 0) return;
    const bounded = ((index % items.length) + items.length) % items.length;
    const nextItem = items[bounded];
    if (!nextItem) return;
    onChange(nextItem.value);
    tabRefs.current[bounded]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusAndSelect(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusAndSelect(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAndSelect(0);
        break;
      case "End":
        event.preventDefault();
        focusAndSelect(items.length - 1);
        break;
    }
  }

  return (
    <div role="tablist" className={`flex gap-2 ${variant === "underline" ? "border-b border-border-default pb-px" : ""} ${className}`}>
      {items.map((item, index) => {
        const isActive = activeValue === item.value;

        if (variant === "underline") {
          return (
            <button
              key={item.value}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              onClick={() => onChange(item.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              role="tab"
              className={`pb-3 px-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 ${
                isActive
                  ? "text-gold underline underline-offset-8 decoration-gold decoration-2"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {item.label}
            </button>
          );
        }

        // Bordered variant (for assets page style)
        return (
          <button
            key={item.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            role="tab"
            className={`text-xs font-semibold uppercase tracking-widest pb-px transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 ${
              isActive
                ? "text-gold border-b-2 border-gold"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
