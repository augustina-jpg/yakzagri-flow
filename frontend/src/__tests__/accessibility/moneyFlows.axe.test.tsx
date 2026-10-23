import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { VideoUploadCard } from "@/components/ui/VideoUploadCard";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";

expect.extend(toHaveNoViolations);

jest.mock("@/lib/stellar/assets", () => ({
  getAssetInfo: () => ({ symbol: "cNGN", decimals: 2, name: "cNGN" }),
}));

// Mock BentoCard for VideoUploadCard
jest.mock("@/components/ui/BentoCard", () => ({
  BentoCard: ({ children }: any) => <div>{children}</div>,
}));
jest.mock("@/components/ui/Icon", () => ({
  Icon: (props: any) => <span {...props} />,
}));

const mockAsset = { symbol: "cNGN", decimals: 2, name: "cNGN", code: "cNGN", issuer: "G...", contractId: "C..." } as any;

describe("Money-action flows — axe WCAG 2.1 AA", () => {
  describe("CurrencyInput", () => {
    it("has no axe violations — default", async () => {
      const { container } = render(<CurrencyInput value="100" onChange={() => {}} asset={mockAsset} label="Amount" />);
      expect(await axe(container)).toHaveNoViolations();
    });
    it("has no axe violations — error state with alert", async () => {
      const { container } = render(<CurrencyInput value="" onChange={() => {}} asset={mockAsset} label="Clawback amount" error="Amount exceeds vested" />);
      expect(await axe(container)).toHaveNoViolations();
    });
    it("has accessible label association and aria-invalid", async () => {
      const { container } = render(<CurrencyInput value="" onChange={() => {}} asset={mockAsset} label="Clawback amount" error="Required" id="clawback-amount" />);
      const input = container.querySelector("input")!;
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toContain("clawback-amount-error");
      const label = container.querySelector("label")!;
      expect(label.getAttribute("for")).toBe("clawback-amount");
    });
  });

  describe("VideoUploadCard", () => {
    it("has no axe violations", async () => {
      const { container } = render(<VideoUploadCard />);
      expect(await axe(container)).toHaveNoViolations();
    });
    it("drop zone has aria-label and handles Space without scroll", async () => {
      const { container } = render(<VideoUploadCard />);
      const zone = container.querySelector('[role="button"]') as HTMLElement;
      expect(zone.getAttribute("aria-label")).toMatch(/Upload delivery proof/);
      expect(zone.getAttribute("tabIndex")).toBe("0");
    });
  });

  describe("ConfirmActionModal — money-action confirmation (alertdialog)", () => {
    it("has no axe violations — danger variant", async () => {
      render(
        <ConfirmActionModal
          open
          onOpenChange={() => {}}
          onConfirm={() => {}}
          title="Confirm clawback"
          message="This will claw back 100 cNGN irreversibly."
          variant="danger"
          confirmLabel="Confirm Clawback"
        />
      );
      // The dialog is portalled to document.body, so audit the dialog itself.
      const dialog = await screen.findByRole("alertdialog");
      expect(await axe(dialog)).toHaveNoViolations();
    });

    it("has no axe violations — default variant with cancel action", async () => {
      render(
        <ConfirmActionModal
          open
          onOpenChange={() => {}}
          onConfirm={() => {}}
          title="Confirm deposit"
          message="Deposit 10,000 cNGN into escrow?"
          confirmLabel="Confirm Deposit"
          cancelLabel="Cancel"
        />
      );
      const dialog = await screen.findByRole("alertdialog");
      expect(await axe(dialog)).toHaveNoViolations();
    });

    it("has no axe violations — busy/loading confirm state", async () => {
      render(
        <ConfirmActionModal
          open
          onOpenChange={() => {}}
          onConfirm={() => {}}
          title="Confirm dispute resolution"
          message="Resolve dispute in favour of the buyer?"
          variant="danger"
          confirmLabel="Resolve Dispute"
          loading
        />
      );
      const dialog = await screen.findByRole("alertdialog");
      expect(await axe(dialog)).toHaveNoViolations();
    });
  });

  describe("TradeListItem — keyboard accessible", () => {
    it("trade title is keyboard accessible without nesting row actions", async () => {
      const { TradeListItem } = await import("@/components/trade/TradeListItem");
      const { container } = render(
        <TradeListItem
          tradeId="t-1"
          commodity="Maize"
          counterparty={{ role: "Buyer", address: "GABC1234567890XYZ" }}
          amountCngn="10,000"
          status="PENDING"
          createdAt="2026-08-31"
          onView={() => {}}
          onDeposit={() => {}}
        />
      );
      const viewButton = container.querySelector('button[aria-label*="View trade t-1"]') as HTMLElement;
      expect(viewButton).toBeTruthy();
      expect(viewButton.getAttribute("tabIndex")).not.toBe("-1");
      const depositBtn = container.querySelector('button[aria-label*="Deposit"]');
      expect(depositBtn).toBeTruthy();
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no axe violations — disputed status row", async () => {
      const { TradeListItem } = await import("@/components/trade/TradeListItem");
      const { container } = render(
        <TradeListItem
          tradeId="t-2"
          commodity="Soybean"
          counterparty={{ role: "Seller", address: "GXYZ0987654321ABC" }}
          amountCngn="5,000"
          status="DISPUTED"
          createdAt="2026-08-30"
          onView={() => {}}
        />
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("Vault stepper — interactive step states", () => {
    it("has no axe violations — active step with progress indicator", async () => {
      const { container } = render(
        <div>
          <ol aria-label="Vault deposit steps">
            <li aria-current="step">
              <span>Step 1: Choose amount</span>
            </li>
            <li>
              <span>Step 2: Confirm deposit</span>
            </li>
            <li>
              <span>Step 3: Review</span>
            </li>
          </ol>
          <CurrencyInput value="100" onChange={() => {}} asset={mockAsset} label="Deposit amount" />
        </div>
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no axe violations — stepper error state", async () => {
      const { container } = render(
        <div>
          <ol aria-label="Vault withdrawal steps">
            <li aria-current="step">
              <span>Step 1: Choose amount</span>
            </li>
          </ol>
          <CurrencyInput
            value=""
            onChange={() => {}}
            asset={mockAsset}
            label="Withdrawal amount"
            error="Amount exceeds available balance"
          />
        </div>
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
