/**
 * VirtualizedList – accessibility & keyboard tests
 *
 * Covers:
 * - aria-rowcount on the scroll container equals total item count
 * - Each rendered listitem has correct aria-posinset (1-indexed) and aria-setsize
 * - Container is keyboard reachable (tabIndex=0)
 * - PageDown scrolls the container down by one page
 * - PageUp scrolls the container up by one page
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { VirtualizedList } from "@/components/ui/VirtualizedList";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Item = { id: string; label: string };

function makeItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i + 1}`,
  }));
}

function renderList(items: Item[], maxHeight = 200) {
  return render(
    <VirtualizedList
      items={items}
      rowHeight={40}
      maxHeight={maxHeight}
      keyExtractor={(item) => item.id}
      renderItem={(item) => <span>{item.label}</span>}
    />,
  );
}

// @tanstack/react-virtual uses ResizeObserver internally; provide a stub.
beforeAll(() => {
  if (!global.ResizeObserver) {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("VirtualizedList – ARIA attributes", () => {
  it("renders a container with role=list", () => {
    renderList(makeItems(5));
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("sets aria-rowcount equal to the total item count", () => {
    const items = makeItems(50);
    renderList(items);
    const list = screen.getByRole("list");
    expect(list).toHaveAttribute("aria-rowcount", "50");
  });

  it("sets aria-rowcount to 0 when there are no items", () => {
    renderList([]);
    // Empty list still renders the outer list container (empty-state path) or
    // the virtualized container with 0 items – either way aria-rowcount should
    // reflect the actual count.
    const list = screen.getByRole("list");
    // The empty-state path renders a plain list without aria-rowcount; only the
    // non-empty path sets it.  We pass isEmpty explicitly to test the empty branch.
    // This test exercises the zero-item non-empty path (isEmpty=false default).
    expect(list).toHaveAttribute("aria-rowcount", "0");
  });

  it("renders listitem elements with correct aria-posinset (1-indexed)", () => {
    // Use a small count that fits entirely within the viewport so all items render.
    const items = makeItems(3);
    renderList(items, 400);
    const listItems = screen.getAllByRole("listitem");
    // The virtualizer may render the first N items; verify the ones that appear.
    listItems.forEach((el) => {
      const posinset = Number(el.getAttribute("aria-posinset"));
      expect(posinset).toBeGreaterThanOrEqual(1);
      expect(posinset).toBeLessThanOrEqual(items.length);
    });
  });

  it("renders listitem elements with aria-setsize equal to total item count", () => {
    const items = makeItems(5);
    renderList(items, 600);
    const listItems = screen.getAllByRole("listitem");
    listItems.forEach((el) => {
      expect(el).toHaveAttribute("aria-setsize", "5");
    });
  });

  it("aria-posinset values are unique across rendered items", () => {
    const items = makeItems(5);
    renderList(items, 600);
    const listItems = screen.getAllByRole("listitem");
    const positions = listItems.map((el) =>
      Number(el.getAttribute("aria-posinset")),
    );
    const unique = new Set(positions);
    expect(unique.size).toBe(listItems.length);
  });
});

describe("VirtualizedList – keyboard accessibility", () => {
  it("container has tabIndex=0 so it is reachable via keyboard", () => {
    renderList(makeItems(5));
    const list = screen.getByRole("list");
    expect(list).toHaveAttribute("tabindex", "0");
  });

  it("PageDown scrolls the container down by its client height", () => {
    renderList(makeItems(100), 200);
    const list = screen.getByRole("list");

    // Simulate a scrollable container: jsdom doesn't implement layout so we set
    // the scroll properties manually on the underlying DOM node.
    Object.defineProperty(list, "clientHeight", { value: 200, writable: true });
    Object.defineProperty(list, "scrollHeight", {
      value: 4000,
      writable: true,
    });
    Object.defineProperty(list, "scrollTop", {
      value: 0,
      writable: true,
      configurable: true,
    });

    fireEvent.keyDown(list, { key: "PageDown" });
    expect(list.scrollTop).toBe(200);
  });

  it("PageDown does not scroll past the bottom of the container", () => {
    renderList(makeItems(100), 200);
    const list = screen.getByRole("list");

    Object.defineProperty(list, "clientHeight", { value: 200, writable: true });
    Object.defineProperty(list, "scrollHeight", {
      value: 400,
      writable: true,
    });
    Object.defineProperty(list, "scrollTop", {
      value: 250,
      writable: true,
      configurable: true,
    });

    fireEvent.keyDown(list, { key: "PageDown" });
    // max scroll = scrollHeight - clientHeight = 200
    expect(list.scrollTop).toBe(200);
  });

  it("PageUp scrolls the container up by its client height", () => {
    renderList(makeItems(100), 200);
    const list = screen.getByRole("list");

    Object.defineProperty(list, "clientHeight", { value: 200, writable: true });
    Object.defineProperty(list, "scrollHeight", {
      value: 4000,
      writable: true,
    });
    Object.defineProperty(list, "scrollTop", {
      value: 600,
      writable: true,
      configurable: true,
    });

    fireEvent.keyDown(list, { key: "PageUp" });
    expect(list.scrollTop).toBe(400);
  });

  it("PageUp does not scroll past the top (scrollTop = 0)", () => {
    renderList(makeItems(100), 200);
    const list = screen.getByRole("list");

    Object.defineProperty(list, "clientHeight", { value: 200, writable: true });
    Object.defineProperty(list, "scrollHeight", {
      value: 4000,
      writable: true,
    });
    Object.defineProperty(list, "scrollTop", {
      value: 50,
      writable: true,
      configurable: true,
    });

    fireEvent.keyDown(list, { key: "PageUp" });
    expect(list.scrollTop).toBe(0);
  });

  it("unrelated keys do not modify scrollTop", () => {
    renderList(makeItems(20), 200);
    const list = screen.getByRole("list");

    Object.defineProperty(list, "scrollTop", {
      value: 100,
      writable: true,
      configurable: true,
    });

    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(list.scrollTop).toBe(100);
  });
});

describe("VirtualizedList – empty state", () => {
  it("renders the empty-state slot when isEmpty=true", () => {
    render(
      <VirtualizedList
        items={[]}
        rowHeight={40}
        isEmpty
        emptyState={<p>No trades found.</p>}
        keyExtractor={(item: Item) => item.id}
        renderItem={(item: Item) => <span>{item.label}</span>}
      />,
    );
    expect(screen.getByText("No trades found.")).toBeInTheDocument();
  });
});
