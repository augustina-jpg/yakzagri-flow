import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClawbackConfirmationModal } from "../ClawbackConfirmationModal";

const baseProps = {
  streamId: "stream-abc-123",
  amount: "3000",
  remainingVested: "7500",
  reasonCode: "FRAUD_CONFIRMED" as const,
  auditTicketId: "SEC-4821",
};

describe("ClawbackConfirmationModal", () => {
  it("is not rendered when closed", () => {
    render(
      <ClawbackConfirmationModal
        open={false}
        streamId="stream-abc-123"
        amount="3000"
        remainingVested="7500"
        onPreview={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("displays the stream id, requested amount, and remaining vested amount", () => {
    render(
      <ClawbackConfirmationModal
        open
        streamId="stream-abc-123"
        amount="3000"
        remainingVested="7500"
        onPreview={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("stream-abc-123")).toBeInTheDocument();
    expect(screen.getByText("3000")).toBeInTheDocument();
    expect(screen.getByText("7500")).toBeInTheDocument();
  });

  it("displays the reason code and audit ticket reference", () => {
    render(
      <ClawbackConfirmationModal
        open
        {...baseProps}
        onPreview={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText(/fraud_confirmed/i)).toBeInTheDocument();
    expect(screen.getByText("SEC-4821")).toBeInTheDocument();
  });

  it("keeps Run preview disabled until the confirmation phrase matches the stream id", async () => {
    const user = userEvent.setup();
    const onPreview = jest.fn();

    render(
      <ClawbackConfirmationModal
        open
        {...baseProps}
        onPreview={onPreview}
        onCancel={jest.fn()}
      />,
    );

    const runPreview = screen.getByRole("button", { name: /run preview/i });
    expect(runPreview).toBeDisabled();

    const input = screen.getByLabelText(/confirmation phrase/i);
    await user.type(input, "stream-abc-12");
    expect(runPreview).toBeDisabled();

    await user.type(input, "3");
    expect(runPreview).toBeEnabled();

    expect(onPreview).not.toHaveBeenCalled();
    await user.click(runPreview);
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it("rejects a confirmation phrase that does not exactly match the stream id", async () => {
    const user = userEvent.setup();
    const onPreview = jest.fn();

    render(
      <ClawbackConfirmationModal
        open
        {...baseProps}
        onPreview={onPreview}
        onCancel={jest.fn()}
      />,
    );

    const input = screen.getByLabelText(/confirmation phrase/i);
    await user.type(input, "STREAM-ABC-123");

    expect(screen.getByRole("button", { name: /run preview/i })).toBeDisabled();
    expect(onPreview).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is clicked, without calling onConfirm", async () => {
    const user = userEvent.setup();
    const onPreview = jest.fn();
    const onCancel = jest.fn();

    render(
      <ClawbackConfirmationModal
        open
        {...baseProps}
        onPreview={onPreview}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPreview).not.toHaveBeenCalled();
  });

  it("calls onCancel (not onConfirm) when dismissed via Escape", () => {
    const onPreview = jest.fn();
    const onCancel = jest.fn();

    render(
      <ClawbackConfirmationModal
        open
        {...baseProps}
        onPreview={onPreview}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPreview).not.toHaveBeenCalled();
  });

  it("disables both buttons while confirming", () => {
    render(
      <ClawbackConfirmationModal
        open
        {...baseProps}
        onPreview={jest.fn()}
        onCancel={jest.fn()}
        previewing
      />,
    );

    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /loading preview/i })).toBeDisabled();
  });
});
