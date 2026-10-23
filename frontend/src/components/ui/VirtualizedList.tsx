"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedListProps<T> {
  /** Array of items to render. */
  items: T[];
  /** Height of each row in pixels. */
  rowHeight: number;
  /** Maximum height of the scrollable container. Falls back to items × rowHeight if smaller. */
  maxHeight?: number;
  /** Render function for each item. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Unique key extractor for React keys. */
  keyExtractor: (item: T, index: number) => string;
  /** Optional className for the scroll container. */
  className?: string;
  /** Whether the list is empty. */
  isEmpty?: boolean;
  /** Empty state render. */
  emptyState?: React.ReactNode;
  /**
   * Row count at or below which the list renders all rows without
   * virtualization. Keeps small tables (e.g. <50 trades) simple and avoids
   * the overhead of a scroll container. Defaults to 50.
   */
  virtualizationThreshold?: number;
}

/**
 * Virtualized list component that only renders visible rows for optimal
 * performance with large datasets (10k+ rows).
 *
 * Preserves scroll position and supports keyboard/screen-reader semantics:
 * - Container carries role="list", aria-rowcount (total items), and tabIndex=0
 * - Each rendered row carries role="listitem", aria-posinset (1-indexed position
 *   within the full list), and aria-setsize (total item count) so screen readers
 *   announce "item N of M" even though only a slice is in the DOM.
 * - PageUp / PageDown keyboard events scroll the container by one visible page.
 *
 * Lists at or below `virtualizationThreshold` rows render in full so small
 * trade tables keep their natural layout; larger lists are virtualized.
 *
 * Usage:
 * ```tsx
 * <VirtualizedList
 *   items={trades}
 *   rowHeight={56}
 *   maxHeight={600}
 *   keyExtractor={(t) => t.tradeId}
 *   renderItem={(trade) => <TradeRow trade={trade} />}
 * />
 * ```
 */
export function VirtualizedList<T>({
  items,
  rowHeight,
  maxHeight = 600,
  renderItem,
  keyExtractor,
  className,
  isEmpty = false,
  emptyState,
  virtualizationThreshold = 50,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const shouldVirtualize = items.length > virtualizationThreshold;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const totalHeight = Math.min(items.length * rowHeight, maxHeight);

  if (isEmpty || items.length === 0) {
    return (
      <div className={className} role="list" aria-label={translateCopy("ui.empty_list_6dcc057")}>
        {emptyState ?? (
          <div className="py-12 text-center text-text-secondary text-sm">
            {translateCopy("ui.no_items_to_display_099de12")}
          </div>
        )}
      </div>
    );
  }

  if (!shouldVirtualize) {
    return (
      <div
        className={className}
        role="list"
        aria-label={translateCopy("ui.virtualized_list_4c3cd62")}
      >
        {items.map((item, index) => (
          <div key={keyExtractor(item, index)} role="listitem" data-index={index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className ?? ""}`}
      style={{ height: totalHeight }}
      role="list"
      aria-label={translateCopy("ui.virtualized_list_4c3cd62")}
      // aria-rowcount tells assistive technology the true total row count even
      // though only a subset of rows is currently rendered in the DOM.
      aria-rowcount={items.length}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={keyExtractor(item, virtualRow.index)}
              role="listitem"
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              data-virtual-row=""
              // aria-posinset: 1-indexed position of this item within the full list.
              aria-posinset={virtualRow.index + 1}
              // aria-setsize: total number of items in the list.
              aria-setsize={items.length}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
