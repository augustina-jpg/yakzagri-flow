import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StreamClawbackForm } from "../StreamClawbackForm";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

jest.mock("@/lib/api", () => {
  const { ApiError: RealApiError } = jest.requireActual("@/lib/api/client");
  return {
    api: {
      adminStreams: {
        clawbackPreview: jest.fn(),
      },
    },
    ApiError: RealApiError,
  };
});

const mockAddToast = jest.fn();
jest.mock("@/hooks/useToast", () => ({
  useToast: jest.fn(),
}));

const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockClawbackPreview = api.adminStreams.clawbackPreview as jest.MockedFunction<
  typeof api.adminStreams.clawbackPreview
>;

describe("StreamClawbackForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseToast.mockReturnValue({
      toasts: [],
      addToast: mockAddToast,
      addToastWithCorrelation: jest.fn(),
      updateToast: jest.fn(),
      removeToast: jest.fn(),
      dismissByCorrelation: jest.fn(),
    });
  });

  const renderForm = (onPreview?: jest.Mock) =>
    render(
      <StreamClawbackForm
        token="test-token"
        streamId="stream-abc-123"
        remainingVested="7500"
        onPreview={onPreview}
      />,
    );

  const fillRequiredFields = async (
    user: ReturnType<typeof userEvent.setup>,
    amount = "3000",
  ) => {
    await user.type(screen.getByLabelText(/clawback amount/i), amount);
    await user.selectOptions(screen.getByLabelText(/reason code/i), "FRAUD_CONFIRMED");
    await user.type(screen.getByLabelText(/audit ticket/i), "SEC-1234");
    await user.type(screen.getByLabelText(/confirmation phrase/i), "stream-abc-123");
  };

  // ── Client-side validation (#57) ─────────────────────────────────────

  it("disables the review button while the amount field is empty", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /preview clawback/i })).toBeDisabled();
  });

  it("shows a clear validation error and disables review for an amount exceeding the remaining balance", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/clawback amount/i), "7501");

    expect(screen.getByText(/cannot exceed the remaining vested balance of 7500/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview clawback/i })).toBeDisabled();
  });

  it("shows a clear validation error for a zero amount", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/clawback amount/i), "0");

    expect(screen.getByText(/greater than zero/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview clawback/i })).toBeDisabled();
  });

  it("enables the review button for a valid amount within the remaining balance", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);

    expect(screen.queryByText(/cannot exceed|greater than zero|whole number/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview clawback/i })).toBeEnabled();
  });

  // ── Mandatory reason code, audit ticket, confirmation phrase (#213) ──

  it("keeps the review button disabled when the reason code is missing", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/clawback amount/i), "3000");
    await user.type(screen.getByLabelText(/audit ticket/i), "SEC-1234");
    await user.type(screen.getByLabelText(/confirmation phrase/i), "stream-abc-123");

    expect(screen.getByText(/select a reason code/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview clawback/i })).toBeDisabled();
  });

  it("keeps the review button disabled when the audit ticket reference is missing", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/clawback amount/i), "3000");
    await user.selectOptions(screen.getByLabelText(/reason code/i), "COURT_ORDER");
    await user.type(screen.getByLabelText(/confirmation phrase/i), "stream-abc-123");

    expect(screen.getByText(/audit ticket reference is required/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview clawback/i })).toBeDisabled();
  });

  it("keeps the review button disabled when the confirmation phrase does not match the stream ID", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/clawback amount/i), "3000");
    await user.selectOptions(screen.getByLabelText(/reason code/i), "SANCTIONS_COMPLIANCE");
    await user.type(screen.getByLabelText(/audit ticket/i), "SEC-1234");
    await user.type(screen.getByLabelText(/confirmation phrase/i), "stream-abc-12");

    expect(screen.getByText(/confirmation phrase must exactly match/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview clawback/i })).toBeDisabled();
  });

  // ── Confirmation modal (#56) ─────────────────────────────────────────

  it("opens the preview dialog with the entered amount instead of requesting immediately", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /preview clawback/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/read-only preview/i)).toBeInTheDocument();
    expect(mockClawbackPreview).not.toHaveBeenCalled();
    expect(screen.getByText("stream-abc-123")).toBeInTheDocument();
  });

  it("does not call the API when the modal is cancelled", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /preview clawback/i }));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockClawbackPreview).not.toHaveBeenCalled();
  });

  // ── Submission + error mapping (#59) ─────────────────────────────────

  it("requests the read-only preview only after review and reports its projected balance", async () => {
    const user = userEvent.setup();
    const onPreview = jest.fn();
    mockClawbackPreview.mockResolvedValueOnce({
      streamId: "stream-abc-123",
      remainingVested: "7500",
      requestedClawback: "3000",
      postClawbackBalance: "4500",
      preview: true,
      timestamp: "2026-07-30T12:00:00.000Z",
    });

    renderForm(onPreview);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /preview clawback/i }));
    await user.click(screen.getByRole("button", { name: /run preview/i }));

    await waitFor(() => {
      expect(mockClawbackPreview).toHaveBeenCalledWith("test-token", "stream-abc-123", "3000");
    });
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({ postClawbackBalance: "4500" }),
    );
    expect(screen.getByText(/projected remaining vested balance: 4500/i)).toBeInTheDocument();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
  });

  it("shows the CLAWBACK_TOO_LARGE tailored message when the backend rejects the amount", async () => {
    const user = userEvent.setup();
    mockClawbackPreview.mockRejectedValueOnce(
      new ApiError(400, "Requested clawback 3000 exceeds remaining vested amount 2000", {
        code: "CLAWBACK_TOO_LARGE",
        message: "Requested clawback 3000 exceeds remaining vested amount 2000",
        details: { remainingVested: "2000" },
        timestamp: new Date().toISOString(),
      }),
    );

    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /preview clawback/i }));
    await user.click(screen.getByRole("button", { name: /run preview/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Amount Too Large" }),
      );
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a generic message for a 403 response", async () => {
    const user = userEvent.setup();
    mockClawbackPreview.mockRejectedValueOnce(
      new ApiError(403, "Forbidden: admin access required", {
        error: "Forbidden: admin access required",
      }),
    );

    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /preview clawback/i }));
    await user.click(screen.getByRole("button", { name: /run preview/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error 403", type: "error" }),
      );
    });
  });

  it("shows a generic message for a 500 response", async () => {
    const user = userEvent.setup();
    mockClawbackPreview.mockRejectedValueOnce(
      new ApiError(500, "Internal server error", { error: "Internal server error" }),
    );

    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /preview clawback/i }));
    await user.click(screen.getByRole("button", { name: /run preview/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error 500", type: "error" }),
      );
    });
  });
});
