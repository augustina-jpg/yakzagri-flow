import { render, screen } from "@testing-library/react";
import { VirtualizedList } from "../components/ui/VirtualizedList";

type Row = { id: string; label: string };

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `row-${i}`,
    label: `Trade ${i}`,
  }));

const renderRow = (row: Row) => <span>{row.label}</span>;
const keyExtractor = (row: Row) => row.id;

describe("VirtualizedList", () => {
  it("renders an empty state when there are no rows", () => {
    render(
      <VirtualizedList
        items={[]}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        emptyMessage="No trades"
      />,
    );

    expect(screen.getByText("No trades")).toBeInTheDocument();
  });

  it("renders all rows when below the virtualization threshold", () => {
    const rows = makeRows(10);

    render(
      <VirtualizedList
        items={rows}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        threshold={50}
      />,
    );

    rows.forEach((row) => {
      expect(screen.getByText(row.label)).toBeInTheDocument();
    });
  });

  it("virtualizes large lists and only renders a window of rows", () => {
    const rows = makeRows(500);

    render(
      <VirtualizedList
        items={rows}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        threshold={50}
        itemHeight={40}
        height={400}
        overscan={2}
      />,
    );

    const rendered = screen.getAllByText(/^Trade \d+$/);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(rows.length);
    expect(screen.getByText("Trade 0")).toBeInTheDocument();
  });

  it("renders the full list when virtualization is disabled", () => {
    const rows = makeRows(120);

    render(
      <VirtualizedList
        items={rows}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        virtualize={false}
      />,
    );

    expect(screen.getAllByText(/^Trade \d+$/).length).toBe(rows.length);
  });
});
