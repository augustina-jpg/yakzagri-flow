import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminAuditHistoryPage from "../page";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { api, ApiError } from "@/lib/api";
import { trackAdminEvent } from "@/lib/analytics";

jest.mock("@/hooks/useAuth");
jest.mock("@/hooks/useIsAdmin");
jest.mock("@/lib/analytics", () => ({
  trackAdminEvent: jest.fn(),
}));
jest.mock("@/lib/api", () => {
  const { ApiError: RealApiError } = jest.requireActual("@/lib/api/client");
  return {
    api: {
      adminAudit: {
        list: jest.fn(),
      },
    },
    ApiError: RealApiError,
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseIsAdmin = useIsAdmin as jest.MockedFunction<typeof useIsAdmin>;
const mockList = api.adminAudit.list as jest.MockedFunction<typeof api.adminAudit.list>;
const mockTrackAdminEvent = trackAdminEvent as jest.MockedFunction<typeof trackAdminEvent>;

function makeEntry(overrides = {}) {
  return {
    id: 1,
    action: "TREASURY_WITHDRAW",
    actorAddress: "GADMIN1234567890",
    targetReference: "GDEST1234567890",
    note: "Reclaiming funds per OPS-42",
    createdAt: "2026-07-05T12:00:00.000Z",
    ...overrides,
  };
}

describe("AdminAuditHistoryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: "test-token",
      isAuthenticated: true,
    } as ReturnType<typeof useAuth>);
    mockUseIsAdmin.mockReturnValue(true);
  });

  it("shows a ForbiddenState instead of fetching when the wallet is not an admin", () => {
    mockUseIsAdmin.mockReturnValue(false);

    render(<AdminAuditHistoryPage />);

    expect(screen.getByTestId("forbidden-state")).toBeInTheDocument();
    expect(mockList).not.toHaveBeenCalled();
  });

  it("shows a skeleton while loading", () => {
    mockList.mockReturnValue(new Promise(() => {}));

    const { container } = render(<AdminAuditHistoryPage />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("emits a page-view analytics event on mount", () => {
    mockList.mockReturnValue(new Promise(() => {}));

    render(<AdminAuditHistoryPage />);

    expect(mockTrackAdminEvent).toHaveBeenCalledWith("admin_audit_page_view", "viewed");
  });

  it("renders audit entries once loaded", async () => {
    mockList.mockResolvedValueOnce({
      items: [makeEntry()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(<AdminAuditHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Treasury Withdraw")).toBeInTheDocument();
    });
    expect(screen.getByText(/GADMIN1234567890/)).toBeInTheDocument();
    expect(mockTrackAdminEvent).toHaveBeenCalledWith("admin_audit_page_view", "success", { page: 1 });
  });

  it("shows a ForbiddenState when the backend returns a 403", async () => {
    mockList.mockRejectedValueOnce(new ApiError(403, "Forbidden: admin access required"));

    render(<AdminAuditHistoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId("forbidden-state")).toBeInTheDocument();
    });
    expect(mockTrackAdminEvent).toHaveBeenCalledWith("admin_audit_page_view", "failed", {
      reason: "forbidden",
    });
  });

  it("shows a retryable error state for non-403 failures", async () => {
    mockList.mockRejectedValueOnce(new ApiError(500, "Failed to reach admin audit service"));

    render(<AdminAuditHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load admin action history")).toBeInTheDocument();
    });
    expect(screen.getByText("Failed to reach admin audit service")).toBeInTheDocument();
  });

  it("shows an empty state when there are no audit entries", async () => {
    mockList.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });

    render(<AdminAuditHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("No admin actions recorded yet")).toBeInTheDocument();
    });
  });

  describe("filtering", () => {
    const mixedEntries = [
      makeEntry({
        id: 1,
        action: "TREASURY_WITHDRAW",
        actorAddress: "GADMIN1111111111",
        createdAt: "2026-07-01T12:00:00.000Z",
      }),
      makeEntry({
        id: 2,
        action: "CONTRACT_PAUSE",
        actorAddress: "GADMIN2222222222",
        createdAt: "2026-07-10T12:00:00.000Z",
      }),
      makeEntry({
        id: 3,
        action: "DISPUTE_RESOLVED",
        actorAddress: "GADMIN3333333333",
        createdAt: "2026-07-20T12:00:00.000Z",
      }),
    ];

    beforeEach(() => {
      mockList.mockResolvedValue({
        items: mixedEntries,
        pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
      });
    });

    async function renderLoaded() {
      render(<AdminAuditHistoryPage />);
      await waitFor(() => {
        expect(screen.getByText("Treasury Withdraw")).toBeInTheDocument();
      });
    }

    it("renders all entries before any filters are applied", async () => {
      await renderLoaded();

      expect(screen.getByText("Treasury Withdraw")).toBeInTheDocument();
      expect(screen.getByText("Contract Pause")).toBeInTheDocument();
      expect(screen.getByText("Dispute Resolved")).toBeInTheDocument();
    });

    it("narrows the list when an actor address is typed", async () => {
      await renderLoaded();

      fireEvent.change(screen.getByLabelText(/actor address/i), {
        target: { value: "GADMIN2222222222" },
      });

      await waitFor(() => {
        expect(screen.getByText("Contract Pause")).toBeInTheDocument();
      });
      expect(screen.queryByText("Treasury Withdraw")).not.toBeInTheDocument();
      expect(screen.queryByText("Dispute Resolved")).not.toBeInTheDocument();
    });

    it("narrows the list when an action type is selected", async () => {
      await renderLoaded();

      fireEvent.change(screen.getByLabelText(/action type/i), {
        target: { value: "DISPUTE_RESOLVED" },
      });

      await waitFor(() => {
        expect(screen.getByText("Dispute Resolved")).toBeInTheDocument();
      });
      expect(screen.queryByText("Treasury Withdraw")).not.toBeInTheDocument();
      expect(screen.queryByText("Contract Pause")).not.toBeInTheDocument();
    });

    it("narrows the list when a start date is set", async () => {
      await renderLoaded();

      fireEvent.change(screen.getByLabelText(/start date/i), {
        target: { value: "2026-07-15" },
      });

      await waitFor(() => {
        expect(screen.getByText("Dispute Resolved")).toBeInTheDocument();
      });
      expect(screen.queryByText("Treasury Withdraw")).not.toBeInTheDocument();
      expect(screen.queryByText("Contract Pause")).not.toBeInTheDocument();
    });

    it("narrows the list when an end date is set", async () => {
      await renderLoaded();

      fireEvent.change(screen.getByLabelText(/end date/i), {
        target: { value: "2026-07-05" },
      });

      await waitFor(() => {
        expect(screen.getByText("Treasury Withdraw")).toBeInTheDocument();
      });
      expect(screen.queryByText("Contract Pause")).not.toBeInTheDocument();
      expect(screen.queryByText("Dispute Resolved")).not.toBeInTheDocument();
    });

    it("updates the active filter count and clears filters", async () => {
      await renderLoaded();

      fireEvent.change(screen.getByLabelText(/actor address/i), {
        target: { value: "GADMIN1111111111" },
      });
      fireEvent.change(screen.getByLabelText(/action type/i), {
        target: { value: "TREASURY_WITHDRAW" },
      });

      await waitFor(() => {
        expect(screen.getByTestId("active-filter-count")).toHaveTextContent("2");
      });

      fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

      await waitFor(() => {
        expect(screen.getByText("Contract Pause")).toBeInTheDocument();
      });
      expect(screen.getByText("Dispute Resolved")).toBeInTheDocument();
      expect(screen.getByTestId("active-filter-count")).toHaveTextContent("0");
    });
  });
});
