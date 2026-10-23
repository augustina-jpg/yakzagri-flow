import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PaymentOverviewCard } from "../PaymentOverviewCard";

describe("PaymentOverviewCard", () => {
  it("renders total trade value, fee, net payout, and asset allocation breakdown in cNGN", () => {
    render(<PaymentOverviewCard totalCngn={1000} ngnRate={1500} />);

    expect(screen.getByText("Total Trade Value")).toBeInTheDocument();
    expect(screen.getByText("EziAgric Platform Fee (1%)")).toBeInTheDocument();
    expect(screen.getByText("Net Payout")).toBeInTheDocument();
    expect(screen.getByTestId("vault-allocation-breakdown")).toBeInTheDocument();
    expect(screen.getByText("Seller Settlement Pool")).toBeInTheDocument();
    expect(screen.getByText("99%")).toBeInTheDocument();
  });

  it("toggles currency display from cNGN to NGN", () => {
    render(<PaymentOverviewCard totalCngn={100} ngnRate={1500} />);

    fireEvent.click(screen.getByRole("button", { name: "NGN" }));
    expect(screen.getAllByText(/₦150,000/).length).toBeGreaterThan(0);
  });
});
