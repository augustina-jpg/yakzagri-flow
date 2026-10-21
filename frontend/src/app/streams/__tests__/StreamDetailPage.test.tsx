import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useParams } from "next/navigation";
import StreamDetailPage from "../[id]/page";
import StreamsPage from "../page";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { api } from "@/lib/api";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
}));

jest.mock("@/hooks/useAuth");
jest.mock("@/hooks/useAdmin");
jest.mock("@/lib/api", () => ({
  api: {
    streams: {
      getRemaining: jest.fn(),
    },
    adminStreams: {
      list: jest.fn(),
    },
  },
  ApiError: class ApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

const mockUseParams = useParams as jest.MockedFunction<typeof useParams>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseAdmin = useAdmin as jest.MockedFunction<typeof useAdmin>;

describe("StreamsPage", () => {
  it("lists real stream records and links to their detail pages", async () => {
    mockUseAuth.mockReturnValue({
      token: "mock-token",
      isAuthenticated: true,
      isLoading: false,
      address: "GADMIN123",
      shortAddress: "GADMIN...123",
      isWalletConnected: true,
      isWalletDetected: true,
      error: null,
      connectWallet: jest.fn(),
      authenticate: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
    });
    mockUseAdmin.mockReturnValue({
      isAdmin: true,
      isAdminUIEnabled: true,
      canAccessAdmin: true,
      adminAddresses: ["GADMIN123"],
    });
    (api.adminStreams.list as jest.Mock).mockResolvedValue({
      items: [{
        streamId: "stream-real-42",
        recipient: "GRECIPIENT42",
        status: "ACTIVE",
        vestingState: "vesting",
        totalVested: "1000",
        claimed: "250",
        unclaimed: "750",
        pendingClawback: "0",
        adminTags: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(<StreamsPage />);

    const detailLink = await screen.findByRole("link", { name: /stream-real-42/i });
    expect(detailLink).toHaveAttribute("href", "/streams/stream-real-42");
    expect(screen.getByText("25% claimed")).toBeInTheDocument();
    expect(screen.queryByText("View Example Stream")).not.toBeInTheDocument();
  });
});

describe("StreamDetailPage", () => {
  const mockStreamId = "stream-123";
  const mockStreamData = {
    assetCode: "USDC",
    decimals: 7,
    totalVested: "1000000",
    claimed: "250000",
    unclaimed: "750000",
    pendingClawback: "0",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ id: mockStreamId });
  });

  describe("Admin Link Visibility with Feature Flag", () => {
    it("shows admin action link when user is admin and feature flag is enabled", async () => {
      mockUseAuth.mockReturnValue({
        token: "mock-token",
        isAuthenticated: true,
        isLoading: false,
        address: "GADMIN123",
        shortAddress: "GADMIN...123",
        isWalletConnected: true,
        isWalletDetected: true,
        error: null,
        connectWallet: jest.fn(),
        authenticate: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
      });

      mockUseAdmin.mockReturnValue({
        isAdmin: true,
        isAdminUIEnabled: true,
        canAccessAdmin: true,
        adminAddresses: ["GADMIN123"],
      });

      (api.streams.getRemaining as jest.Mock).mockResolvedValue(mockStreamData);

      render(<StreamDetailPage />);

      await waitFor(() => {
        expect(screen.getByText("Manage Stream")).toBeInTheDocument();
      });

      const adminLink = screen.getByText("Manage Stream").closest("a");
      expect(adminLink).toHaveAttribute("href", `/admin/streams/${mockStreamId}`);
    });

    it("does not show admin action link when feature flag is disabled", async () => {
      mockUseAuth.mockReturnValue({
        token: "mock-token",
        isAuthenticated: true,
        isLoading: false,
        address: "GADMIN123",
        shortAddress: "GADMIN...123",
        isWalletConnected: true,
        isWalletDetected: true,
        error: null,
        connectWallet: jest.fn(),
        authenticate: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
      });

      mockUseAdmin.mockReturnValue({
        isAdmin: true,
        isAdminUIEnabled: false,
        canAccessAdmin: false,
        adminAddresses: ["GADMIN123"],
      });

      (api.streams.getRemaining as jest.Mock).mockResolvedValue(mockStreamData);

      render(<StreamDetailPage />);

      await waitFor(() => {
        expect(screen.getByText("Stream Details")).toBeInTheDocument();
      });

      expect(screen.queryByText("Manage Stream")).not.toBeInTheDocument();
    });

    it("does not show admin action link when user is not admin", async () => {
      mockUseAuth.mockReturnValue({
        token: "mock-token",
        isAuthenticated: true,
        isLoading: false,
        address: "GUSER456",
        shortAddress: "GUSER...456",
        isWalletConnected: true,
        isWalletDetected: true,
        error: null,
        connectWallet: jest.fn(),
        authenticate: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
      });

      mockUseAdmin.mockReturnValue({
        isAdmin: false,
        isAdminUIEnabled: true,
        canAccessAdmin: false,
        adminAddresses: ["GADMIN123"],
      });

      (api.streams.getRemaining as jest.Mock).mockResolvedValue(mockStreamData);

      render(<StreamDetailPage />);

      await waitFor(() => {
        expect(screen.getByText("Stream Details")).toBeInTheDocument();
      });

      expect(screen.queryByText("Manage Stream")).not.toBeInTheDocument();
    });

    it("does not show admin action link when user is not authenticated", async () => {
      mockUseAuth.mockReturnValue({
        token: null,
        isAuthenticated: false,
        isLoading: false,
        address: null,
        shortAddress: null,
        isWalletConnected: false,
        isWalletDetected: true,
        error: null,
        connectWallet: jest.fn(),
        authenticate: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
      });

      mockUseAdmin.mockReturnValue({
        isAdmin: false,
        isAdminUIEnabled: true,
        canAccessAdmin: false,
        adminAddresses: ["GADMIN123"],
      });

      render(<StreamDetailPage />);

      await waitFor(() => {
        expect(screen.getByText("Authentication Required")).toBeInTheDocument();
      });

      expect(screen.queryByText("Manage Stream")).not.toBeInTheDocument();
    });
  });

  describe("Unauthenticated State", () => {
    it("shows the authentication prompt instead of an endless loading spinner", async () => {
      mockUseAuth.mockReturnValue({
        token: null,
        isAuthenticated: false,
        isLoading: false,
        address: null,
        shortAddress: null,
        isWalletConnected: false,
        isWalletDetected: true,
        error: null,
        connectWallet: jest.fn(),
        authenticate: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
      });

      mockUseAdmin.mockReturnValue({
        isAdmin: false,
        isAdminUIEnabled: true,
        canAccessAdmin: false,
        adminAddresses: ["GADMIN123"],
      });

      render(<StreamDetailPage />);

      expect(await screen.findByText("Authentication Required")).toBeInTheDocument();
      expect(screen.queryByText("Loading stream...")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(api.streams.getRemaining).not.toHaveBeenCalled();
    });
  });

  describe("Stream Data Display", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        token: "mock-token",
        isAuthenticated: true,
        isLoading: false,
        address: "GUSER456",
        shortAddress: "GUSER...456",
        isWalletConnected: true,
        isWalletDetected: true,
        error: null,
        connectWallet: jest.fn(),
        authenticate: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
      });

      mockUseAdmin.mockReturnValue({
        isAdmin: false,
        adminAddresses: ["GADMIN123"],
      });
    });

    it("displays stream data correctly", async () => {
      (api.streams.getRemaining as jest.Mock).mockResolvedValue(mockStreamData);

      render(<StreamDetailPage />);

      expect(await screen.findByText("0.1")).toBeInTheDocument(); // Total Vested
      expect(screen.getByText("0.025")).toBeInTheDocument(); // Claimed
      expect(screen.getByText("0.075")).toBeInTheDocument(); // Unclaimed
    });

    it("shows error state when stream fetch fails", async () => {
      (api.streams.getRemaining as jest.Mock).mockRejectedValue(
        new Error("Stream not found")
      );

      render(<StreamDetailPage />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load stream")).toBeInTheDocument();
      });

      expect(screen.getByText("Stream not found")).toBeInTheDocument();
    });

    it("renders a progress bar reflecting claimed/totalVested", async () => {
      (api.streams.getRemaining as jest.Mock).mockResolvedValue(mockStreamData);

      render(<StreamDetailPage />);

      const progressBar = await screen.findByRole("progressbar");
      // 250000 claimed / 1000000 totalVested = 25%
      expect(progressBar).toHaveAttribute("aria-valuenow", "25");
      expect(progressBar).toHaveAttribute("aria-valuemin", "0");
      expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    });

    it("renders the StalenessIndicator with the last-fetched timestamp", async () => {
      (api.streams.getRemaining as jest.Mock).mockResolvedValue(mockStreamData);

      render(<StreamDetailPage />);

      await screen.findByText("0.1");

      expect(screen.getByTestId("staleness-indicator")).toBeInTheDocument();
      expect(screen.getByText(/last (fetched|updated)/i)).toBeInTheDocument();
    });

    it("refetches the balance and updates displayed data when Refresh Balance is clicked", async () => {
      (api.streams.getRemaining as jest.Mock).mockResolvedValue(mockStreamData);

      render(<StreamDetailPage />);

      await screen.findByText("0.1");
      expect(api.streams.getRemaining).toHaveBeenCalledTimes(1);

      (api.streams.getRemaining as jest.Mock).mockResolvedValue({
        ...mockStreamData,
        claimed: "500000",
        unclaimed: "500000",
      });

      fireEvent.click(screen.getByRole("button", { name: /refresh balance/i }));

      await waitFor(() => {
        expect(api.streams.getRemaining).toHaveBeenCalledTimes(2);
      });

      expect(await screen.findByText("0.05")).toBeInTheDocument();
      expect(screen.getAllByText("0.05").length).toBeGreaterThanOrEqual(2);

      await waitFor(() => {
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
      });
    });
  });

  describe("Breadcrumb Navigation", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        token: "mock-token",
        isAuthenticated: true,
        isLoading: false,
        address: "GUSER456",
        shortAddress: "GUSER...456",
        isWalletConnected: true,
        isWalletDetected: true,
        error: null,
        connectWallet: jest.fn(),
        authenticate: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
      });

      mockUseAdmin.mockReturnValue({
        isAdmin: false,
        adminAddresses: ["GADMIN123"],
      });

      (api.streams.getRemaining as jest.Mock).mockResolvedValue(mockStreamData);
    });

    it("displays breadcrumb navigation with correct hierarchy", async () => {
      render(<StreamDetailPage />);

      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      expect(screen.getByText("Streams")).toBeInTheDocument();
      expect(
        within(screen.getByLabelText("Breadcrumb")).getByText(mockStreamId),
      ).toBeInTheDocument();
    });
  });
});
