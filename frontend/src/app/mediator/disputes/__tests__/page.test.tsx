import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MediatorDisputesPage from "../page";
import { useAuth } from "@/hooks/useAuth";
import { useFreighterIdentity } from "@/hooks/useFreighterIdentity";
import { api, ApiError } from "@/lib/api";

jest.mock("@/hooks/useAuth");
jest.mock("@/hooks/useFreighterIdentity");
jest.mock("@/lib/api", () => ({
  api: {
    disputes: {
      list: jest.fn(),
    },
  },
  ApiError: class ApiError extends Error {
    status: number;
    data: unknown;
    constructor(status: number, message: string, data?: unknown) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
    }
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseFreighterIdentity = useFreighterIdentity as jest.MockedFunction<
  typeof useFreighterIdentity
>;
const mockList = api.disputes.list as jest.MockedFunction<typeof api.disputes.list>;

const MEDIATOR_ADDRESS = "GEXAMPLEMEDIATORPUBLICKEY1";

function makeDispute(overrides = {}) {
  return {
    id: "dispute-1",
    tradeId: "trade-1",
    status: "OPEN",
    initiator: "GBUYER1234567890",
    createdAt: "2026-01-01T00:00:00Z",
    trade: {
      buyerAddress: "GBUYER1234567890",
      sellerAddress: "GSELLER1234567890",
      amountUsdc: "100",
    },
    ...overrides,
  };
}

describe("MediatorDisputesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: "test-token",
      isAuthenticated: true,
    } as ReturnType<typeof useAuth>);
    mockUseFreighterIdentity.mockReturnValue({
      address: MEDIATOR_ADDRESS,
    } as ReturnType<typeof useFreighterIdentity>);
  });

  it("shows a skeleton while loading", async () => {
    mockList.mockReturnValue(new Promise(() => {}));

    const { container } = render(<MediatorDisputesPage />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows a retryable error state with actionable messaging when the fetch fails", async () => {
    mockList.mockRejectedValueOnce(new ApiError(500, "Failed to reach disputes service"));

    render(<MediatorDisputesPage />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load disputes")).toBeInTheDocument();
    });
    expect(screen.getByText("Failed to reach disputes service")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("refetches disputes when the retry button is clicked", async () => {
    mockList
      .mockRejectedValueOnce(new ApiError(500, "Failed to reach disputes service"))
      .mockResolvedValueOnce({
        items: [makeDispute()],
        pagination: { totalPages: 1 },
      });

    render(<MediatorDisputesPage />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load disputes")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText(/Trade trade-1/)).toBeInTheDocument();
    });
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it("renders status filters as the shared Tabs component", async () => {
    mockList.mockResolvedValue({ items: [], pagination: { totalPages: 1 } });

    render(<MediatorDisputesPage />);

    await waitFor(() => {
      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "Open" })).toBeInTheDocument();
  });

  it("default-sorts the queue by oldest open dispute first", async () => {
    const now = Date.now();
    mockList.mockResolvedValue({
      items: [
        makeDispute({
          id: "dispute-newer",
          tradeId: "trade-newer",
          createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
        }),
        makeDispute({
          id: "dispute-older",
          tradeId: "trade-older",
          createdAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
        }),
      ],
      pagination: { totalPages: 1 },
    });

    render(<MediatorDisputesPage />);

    await waitFor(() => {
      expect(screen.getByText(/Trade trade-older/)).toBeInTheDocument();
    });

    const tradeLabels = screen
      .getAllByText(/Trade trade-/)
      .map((node) => node.textContent ?? "");
    expect(tradeLabels[0]).toContain("trade-older");
    expect(tradeLabels[1]).toContain("trade-newer");
  });

  it("renders a Critical SLA badge for disputes open longer than 24h", async () => {
    mockList.mockResolvedValue({
      items: [
        makeDispute({
          id: "dispute-critical",
          tradeId: "trade-critical",
          createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
        }),
      ],
      pagination: { totalPages: 1 },
    });

    render(<MediatorDisputesPage />);

    await waitFor(() => {
      expect(screen.getByText(/Trade trade-critical/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Critical SLA/i)).toBeInTheDocument();
  });

  it("reorders the queue when the sort selector changes to trade value", async () => {
    const now = Date.now();
    mockList.mockResolvedValue({
      items: [
        makeDispute({
          id: "dispute-older-low-value",
          tradeId: "trade-older-low-value",
          createdAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
          trade: {
            buyerAddress: "GBUYER1234567890",
            sellerAddress: "GSELLER1234567890",
            amountUsdc: "100",
          },
        }),
        makeDispute({
          id: "dispute-newer-high-value",
          tradeId: "trade-newer-high-value",
          createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
          trade: {
            buyerAddress: "GBUYER1234567890",
            sellerAddress: "GSELLER1234567890",
            amountUsdc: "5000",
          },
        }),
      ],
      pagination: { totalPages: 1 },
    });

    render(<MediatorDisputesPage />);

    await waitFor(() => {
      expect(screen.getByText(/Trade trade-older-low-value/)).toBeInTheDocument();
    });

    const sortSelect = screen.getByLabelText(/sort/i);
    await userEvent.selectOptions(sortSelect, "tradeValue");

    await waitFor(() => {
      const tradeLabels = screen
        .getAllByText(/Trade trade-/)
        .map((node) => node.textContent ?? "");
      expect(tradeLabels[0]).toContain("trade-newer-high-value");
      expect(tradeLabels[1]).toContain("trade-older-low-value");
    });
  });
});
