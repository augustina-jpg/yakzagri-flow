/**
 * Tests for Trade Detail page (#771)
 *
 * Covers: each trade status, role-based button visibility,
 *         loading state, error state, signing flow.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TradeDetailPage from "@/app/trades/[id]/page";
import { useTradeDetail } from "@/hooks/useTradeDetail";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { signTransaction } from "@stellar/freighter-api";
import { pollTransaction } from "@/lib/stellar";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "trade-123" }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/hooks/useTradeDetail");
jest.mock("@/hooks/useWallet");
jest.mock("@/hooks/useAuth");
jest.mock("@/lib/api", () => ({
  api: {
    trades: {
      deposit: jest.fn(),
      confirmDelivery: jest.fn(),
      releaseFunds: jest.fn(),
      initiateDispute: jest.fn(),
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
  apiConfig: {
    getStellarNetworkPassphrase: () => "Test SDF Network ; September 2015",
    getStellarRpcUrl: () => "https://soroban-testnet.stellar.org",
  },
}));

jest.mock("@stellar/freighter-api", () => ({
  signTransaction: jest.fn(),
}));

jest.mock("@/lib/stellar", () => ({
  pollTransaction: jest.fn(),
}));

const mockUseTradeDetail = useTradeDetail as jest.MockedFunction<typeof useTradeDetail>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockSignTransaction = signTransaction as jest.MockedFunction<typeof signTransaction>;
const mockPollTransaction = pollTransaction as jest.MockedFunction<typeof pollTransaction>;
const mockDeposit = api.trades.deposit as jest.MockedFunction<typeof api.trades.deposit>;
const mockConfirmDelivery = api.trades.confirmDelivery as jest.MockedFunction<typeof api.trades.confirmDelivery>;
const mockReleaseFunds = api.trades.releaseFunds as jest.MockedFunction<typeof api.trades.releaseFunds>;
const mockInitiateDispute = api.trades.initiateDispute as jest.MockedFunction<typeof api.trades.initiateDispute>;

const BUYER_ADDRESS = "GBUYER123456789012345678901234567890123456789012345678";
const SELLER_ADDRESS = "GSELLER12345678901234567890123456789012345678901234567";

function makeTrade(status: string, overrides = {}) {
  return {
    tradeId: "trade-123",
    buyerAddress: BUYER_ADDRESS,
    sellerAddress: SELLER_ADDRESS,
    amountCngn: "5000",
    buyerLossBps: 100,
    sellerLossBps: 200,
    status,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    ...overrides,
  };
}

function mockAuth(address: string) {
  mockUseAuth.mockReturnValue({
    address,
    token: "jwt-token",
    shortAddress: `${address.slice(0, 6)}...${address.slice(-6)}`,
    isAuthenticated: true,
    isWalletConnected: true,
    isWalletDetected: true,
    isLoading: false,
    error: null,
    connectWallet: jest.fn(),
    authenticate: jest.fn(),
    logout: jest.fn(),
    refreshAuth: jest.fn(),
  });
}

function mockWallet() {
  mockUseWallet.mockReturnValue({
    balance: "1000",
    asset: "cNGN",
    loading: false,
    error: null,
    refetch: jest.fn(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWallet();
  mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr", signerAddress: "GABC" } as unknown as Awaited<ReturnType<typeof signTransaction>>);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ result: { hash: "tx-mock-hash-456" } }),
  });
  mockPollTransaction.mockResolvedValue({
    status: "SUCCESS",
    hash: "tx-mock-hash-456",
    ledger: 123456,
  });
});

// ── Loading state ──────────────────────────────────────────────────────────────

describe("Trade Detail — loading state", () => {
  it("shows a spinner while loading", () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: null,
      loading: true,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    expect(document.querySelector("svg.animate-spin")).toBeInTheDocument();
  });
});

// ── Error state ────────────────────────────────────────────────────────────────

describe("Trade Detail — error state", () => {
  it("shows the error message and a retry button", () => {
    mockAuth(BUYER_ADDRESS);
    const refetch = jest.fn();
    mockUseTradeDetail.mockReturnValue({
      trade: null,
      loading: false,
      error: "Trade not found",
      refetch,
    });
    render(<TradeDetailPage />);
    expect(screen.getByText("Trade not found")).toBeInTheDocument();
    expect(screen.getByText(/retry/i)).toBeInTheDocument();
  });

  it("calls refetch when retry is clicked", async () => {
    mockAuth(BUYER_ADDRESS);
    const refetch = jest.fn();
    mockUseTradeDetail.mockReturnValue({
      trade: null,
      loading: false,
      error: "Fetch failed",
      refetch,
    });
    render(<TradeDetailPage />);
    await userEvent.click(screen.getByText(/retry/i));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

// ── Status display ─────────────────────────────────────────────────────────────

describe("Trade Detail — trade status display", () => {
  it.each(["PENDING", "FUNDED", "SETTLED", "DISPUTED", "CANCELLED"])(
    "shows %s status badge",
    (status) => {
      mockAuth(BUYER_ADDRESS);
      mockUseTradeDetail.mockReturnValue({
        trade: makeTrade(status),
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      render(<TradeDetailPage />);
      expect(screen.getByText(status)).toBeInTheDocument();
    }
  );
});

// ── Role-based button visibility ───────────────────────────────────────────────

describe("Trade Detail — role-based action buttons", () => {
  it("shows Deposit button for buyer in PENDING status", () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    expect(screen.getByTestId("action-deposit")).toBeInTheDocument();
  });

  it("does NOT show Deposit button for seller in PENDING status", () => {
    mockAuth(SELLER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    expect(screen.queryByTestId("action-deposit")).not.toBeInTheDocument();
  });

  it("shows Confirm Delivery for buyer in FUNDED status", () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    expect(screen.getByTestId("action-confirm-delivery")).toBeInTheDocument();
  });

  it("shows Release Funds for seller in FUNDED status", () => {
    mockAuth(SELLER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    expect(screen.getByTestId("action-release-funds")).toBeInTheDocument();
  });

  it("shows Initiate Dispute for buyer in FUNDED status", () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    expect(screen.getByTestId("action-dispute")).toBeInTheDocument();
  });

  it("shows Initiate Dispute for seller in FUNDED status", () => {
    mockAuth(SELLER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    expect(screen.getByTestId("action-dispute")).toBeInTheDocument();
  });

  it("shows no actions for observer", () => {
    mockAuth("GOBSERVER000000000000000000000000000000000000000000000000");
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    expect(screen.queryByTestId("action-deposit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-confirm-delivery")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-release-funds")).not.toBeInTheDocument();
    expect(screen.getByText(/not a party to this trade/i)).toBeInTheDocument();
  });

  it("shows settled message for SETTLED status", () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("SETTLED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    expect(screen.getByText(/no further actions are available/i)).toBeInTheDocument();
  });
});

// ── Next Required Action callout ──────────────────────────────────────────────

describe("Trade Detail — Next Required Action callout", () => {
  it("shows an action-required deposit message for the buyer in PENDING", () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    const callout = screen.getByTestId("next-action-callout");
    expect(callout).toBeInTheDocument();
    expect(callout).toHaveTextContent(/action required/i);
    expect(callout).toHaveTextContent(/deposit/i);
  });

  it("shows a waiting-for-buyer message for the seller in PENDING", () => {
    mockAuth(SELLER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    const callout = screen.getByTestId("next-action-callout");
    expect(callout).toBeInTheDocument();
    expect(callout).toHaveTextContent(/waiting for buyer/i);
  });

  it("shows an action-required release message for the seller in FUNDED", () => {
    mockAuth(SELLER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    const callout = screen.getByTestId("next-action-callout");
    expect(callout).toBeInTheDocument();
    expect(callout).toHaveTextContent(/action required/i);
    expect(callout).toHaveTextContent(/release/i);
  });

  it("shows an action-required confirm-delivery message for the buyer in FUNDED", () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    const callout = screen.getByTestId("next-action-callout");
    expect(callout).toBeInTheDocument();
    expect(callout).toHaveTextContent(/action required/i);
    expect(callout).toHaveTextContent(/confirm delivery/i);
  });

  it("shows an action-required mediation message for a mediator in DISPUTED", () => {
    mockAuth("GMEDIATOR00000000000000000000000000000000000000000000000");
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("DISPUTED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    const callout = screen.getByTestId("next-action-callout");
    expect(callout).toBeInTheDocument();
    expect(callout).toHaveTextContent(/action required/i);
    expect(callout).toHaveTextContent(/mediat/i);
  });

  it("shows a neutral waiting message for an observer", () => {
    mockAuth("GOBSERVER000000000000000000000000000000000000000000000000");
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<TradeDetailPage />);
    const callout = screen.getByTestId("next-action-callout");
    expect(callout).toBeInTheDocument();
    expect(callout).toHaveTextContent(/waiting/i);
    expect(callout).not.toHaveTextContent(/action required/i);
  });
});

// ── Signing flow ───────────────────────────────────────────────────────────────

describe("Trade Detail — Freighter signing flow", () => {
  it("submits a dispute with the selected category and entered reason", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockInitiateDispute.mockResolvedValue({ unsignedXdr: "dispute-xdr" });

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-dispute"));
    await userEvent.selectOptions(screen.getByLabelText("Category"), "fraud");
    await userEvent.type(screen.getByLabelText("Reason"), "The payment receipt is fraudulent.");
    await userEvent.click(screen.getByRole("button", { name: "Submit dispute" }));

    await waitFor(() =>
      expect(mockInitiateDispute).toHaveBeenCalledWith(
        "jwt-token",
        "trade-123",
        "The payment receipt is fraudulent.",
        "fraud",
        expect.objectContaining({ idempotencyKey: expect.any(String) }),
      ),
    );
    await waitFor(() =>
      expect(mockSignTransaction).toHaveBeenCalledWith(
        "dispute-xdr",
        expect.objectContaining({ networkPassphrase: "Test SDF Network ; September 2015" }),
      ),
    );
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "https://soroban-testnet.stellar.org",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sendTransaction",
            params: { transaction: "signed-xdr" },
          }),
        }),
      ),
    );
  });

  it("requires a valid dispute reason before submitting", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-dispute"));
    await userEvent.type(screen.getByLabelText("Reason"), "          ");
    await userEvent.click(screen.getByRole("button", { name: "Submit dispute" }));

    expect(screen.getByRole("alert")).toHaveTextContent("between 10 and 500 characters");
    expect(mockInitiateDispute).not.toHaveBeenCalled();
  });

  it("calls deposit API, signs with Freighter, and broadcasts to Stellar when Deposit is clicked", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeposit.mockResolvedValue({ unsignedXdr: "unsigned-xdr-payload" });

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-deposit"));

    await waitFor(() => expect(mockDeposit).toHaveBeenCalledWith(
      "jwt-token",
      "trade-123",
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    ));
    await waitFor(() => expect(mockSignTransaction).toHaveBeenCalledWith(
      "unsigned-xdr-payload",
      expect.objectContaining({ networkPassphrase: "Test SDF Network ; September 2015" })
    ));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "https://soroban-testnet.stellar.org",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendTransaction",
          params: { transaction: "signed-xdr" },
        }),
      })
    ));
  });

  it("shows success message and transaction hash after successful signing and broadcast", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeposit.mockResolvedValue({ unsignedXdr: "xdr-payload" });

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-deposit"));

    await waitFor(() =>
      expect(screen.getByText(/completed successfully/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/tx-mock-hash-456/i)).toBeInTheDocument();
  });

  it("shows error message when signTransaction fails", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeposit.mockResolvedValue({ unsignedXdr: "xdr-payload" });
    mockSignTransaction.mockResolvedValue({
      error: { message: "User cancelled signing" },
    } as unknown as Awaited<ReturnType<typeof signTransaction>>);

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-deposit"));

    await waitFor(() =>
      expect(screen.getByText(/user cancelled signing/i)).toBeInTheDocument()
    );
  });

  it("shows error message when Stellar broadcast fails", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeposit.mockResolvedValue({ unsignedXdr: "xdr-payload" });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "RPC node broadcast error" } }),
    });

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-deposit"));

    await waitFor(() =>
      expect(screen.getByText(/RPC node broadcast error/i)).toBeInTheDocument()
    );
  });

  it("calls confirmDelivery API, signs, and broadcasts when Confirm Delivery is clicked", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockConfirmDelivery.mockResolvedValue({ unsignedXdr: "confirm-xdr" });

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-confirm-delivery"));

    await waitFor(() => expect(mockConfirmDelivery).toHaveBeenCalledWith(
      "jwt-token",
      "trade-123",
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    ));
    await waitFor(() => expect(mockSignTransaction).toHaveBeenCalledWith(
      "confirm-xdr",
      expect.objectContaining({ networkPassphrase: "Test SDF Network ; September 2015" })
    ));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "https://soroban-testnet.stellar.org",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendTransaction",
          params: { transaction: "signed-xdr" },
        }),
      })
    ));
  });

  it("calls releaseFunds API, signs, and broadcasts when Release Funds is clicked", async () => {
    mockAuth(SELLER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("FUNDED"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockReleaseFunds.mockResolvedValue({ unsignedXdr: "release-xdr" });

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-release-funds"));

    await waitFor(() => expect(mockReleaseFunds).toHaveBeenCalledWith(
      "jwt-token",
      "trade-123",
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    ));
    await waitFor(() => expect(mockSignTransaction).toHaveBeenCalledWith(
      "release-xdr",
      expect.objectContaining({ networkPassphrase: "Test SDF Network ; September 2015" })
    ));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "https://soroban-testnet.stellar.org",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendTransaction",
          params: { transaction: "signed-xdr" },
        }),
      })
    ));
  });

  it("polls the transaction after submission and shows ledger confirmation on SUCCESS", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeposit.mockResolvedValue({ unsignedXdr: "xdr-payload" });
    mockPollTransaction.mockResolvedValue({
      status: "SUCCESS",
      hash: "tx-mock-hash-456",
      ledger: 987654,
    });

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-deposit"));

    await waitFor(() =>
      expect(mockPollTransaction).toHaveBeenCalledWith(
        "tx-mock-hash-456",
        expect.objectContaining({ timeoutMs: expect.any(Number) }),
      )
    );
    await waitFor(() =>
      expect(screen.getByText(/confirmed in ledger #987654/i)).toBeInTheDocument()
    );
    const hashLink = screen.getByRole("link", { name: /tx-mock-hash-456/i });
    expect(hashLink).toHaveAttribute(
      "href",
      expect.stringContaining("tx-mock-hash-456"),
    );
  });

  it("surfaces decoded on-chain failure details when polling returns FAILED", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeposit.mockResolvedValue({ unsignedXdr: "xdr-payload" });
    mockPollTransaction.mockResolvedValue({
      status: "FAILED",
      hash: "tx-mock-hash-456",
      error: "HostError: Error(Contract, #4) — trade already funded",
    });

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-deposit"));

    await waitFor(() =>
      expect(screen.getByText(/trade already funded/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/completed successfully/i)).not.toBeInTheDocument();
  });

  it("surfaces a timeout message when polling does not confirm in time", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeposit.mockResolvedValue({ unsignedXdr: "xdr-payload" });
    mockPollTransaction.mockResolvedValue({
      status: "TIMEOUT",
      hash: "tx-mock-hash-456",
      error: "Timed out waiting for transaction confirmation",
    });

    render(<TradeDetailPage />);
    await userEvent.click(screen.getByTestId("action-deposit"));

    await waitFor(() =>
      expect(screen.getByText(/timed out waiting for transaction confirmation/i)).toBeInTheDocument()
    );
  });

  it("reuses stable Idempotency-Key on retry after failed attempt (#9)", async () => {
    mockAuth(BUYER_ADDRESS);
    mockUseTradeDetail.mockReturnValue({
      trade: makeTrade("PENDING"),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeposit.mockResolvedValue({ unsignedXdr: "xdr-retry" });
    // First attempt fails during signing
    mockSignTransaction.mockResolvedValueOnce({
      error: { message: "Network timeout" },
    } as any);
    // Second attempt succeeds
    mockSignTransaction.mockResolvedValueOnce({
      signedTxXdr: "signed-xdr",
    } as any);

    render(<TradeDetailPage />);

    // Click Deposit (1st attempt)
    await userEvent.click(screen.getByTestId("action-deposit"));
    await waitFor(() => expect(screen.getByText(/network timeout/i)).toBeInTheDocument());

    const firstKey = (mockDeposit.mock.calls[0][2] as any)?.idempotencyKey;
    expect(firstKey).toBeDefined();

    // Click Deposit again (retry attempt)
    await userEvent.click(screen.getByTestId("action-deposit"));
    await waitFor(() => expect(screen.getByText(/completed successfully/i)).toBeInTheDocument());

    const secondKey = (mockDeposit.mock.calls[1][2] as any)?.idempotencyKey;
    // Retried submit reuses the exact same Idempotency-Key to prevent duplicate on-chain operation
    expect(secondKey).toBe(firstKey);
  });
});
