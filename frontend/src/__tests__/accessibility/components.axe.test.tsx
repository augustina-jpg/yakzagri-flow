import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RepScoreRing } from "@/components/ui/RepScoreRing";
import { TradeListItem } from "@/components/trade/TradeListItem";

expect.extend(toHaveNoViolations);

describe("Accessibility audit — WCAG 2.1 AA", () => {
  describe("Skip to main content link", () => {
    const renderLayout = () =>
      render(
        <div>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <nav aria-label="Main navigation">
            <a href="/dashboard">Dashboard</a>
            <a href="/trades">Trades</a>
          </nav>
          <main id="main-content" tabIndex={-1}>
            <h1>Dashboard</h1>
          </main>
        </div>
      );

    it("is the first focusable element in the layout", async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.tab();

      const skipLink = screen.getByRole("link", { name: "Skip to main content" });
      expect(skipLink).toHaveFocus();
    });

    it("targets the main content landmark", () => {
      renderLayout();

      const skipLink = screen.getByRole("link", { name: "Skip to main content" });
      expect(skipLink).toHaveAttribute("href", "#main-content");
      expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    });

    it("moves focus to the main content landmark when activated", async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.tab();
      await user.keyboard("{Enter}");

      expect(screen.getByRole("main")).toHaveFocus();
    });

    it("has no axe violations", async () => {
      const { container } = renderLayout();
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("RepScoreRing", () => {
    it("shows a text label and announces the score with sufficient contrast tokens", async () => {
      const { container } = render(<RepScoreRing score={4.5} />);

      expect(screen.getByRole("img", { name: "Trust score: 4.5 out of 5" })).toBeInTheDocument();
      expect(screen.getByText("Trust Score")).toBeInTheDocument();
      expect(container.querySelector("text")).toHaveAttribute("fill", "var(--text-primary)");
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("Button", () => {
    it("primary variant has no axe violations", async () => {
      const { container } = render(<Button variant="primary">Submit</Button>);
      expect(await axe(container)).toHaveNoViolations();
    });

    it("secondary variant has no axe violations", async () => {
      const { container } = render(<Button variant="secondary">Cancel</Button>);
      expect(await axe(container)).toHaveNoViolations();
    });

    it("disabled state has no axe violations", async () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("FormField", () => {
    it("has no axe violations with a valid input", async () => {
      const { container } = render(
        <FormField label="Email" name="email" required>
          <input type="email" />
        </FormField>
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no axe violations in error state", async () => {
      const { container } = render(
        <FormField label="Email" name="email" error="Invalid email address">
          <input type="email" aria-invalid />
        </FormField>
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no axe violations with hint text", async () => {
      const { container } = render(
        <FormField label="Username" name="username" hint="Letters only">
          <input type="text" />
        </FormField>
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("Tabs", () => {
    const items = [
      { value: "active", label: "Active" },
      { value: "settled", label: "Settled" },
      { value: "disputed", label: "Disputed" },
    ];

    it("underline variant has no axe violations", async () => {
      const { container } = render(
        <Tabs items={items} activeValue="active" onChange={() => {}} variant="underline" />
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("bordered variant has no axe violations", async () => {
      const { container } = render(
        <Tabs items={items} activeValue="settled" onChange={() => {}} variant="bordered" />
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("Badge", () => {
    it("has no axe violations", async () => {
      const { container } = render(<Badge>New</Badge>);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("StatusBadge", () => {
    it("has no axe violations", async () => {
      const { container } = render(<StatusBadge status="pending" />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("TradeListItem", () => {
    const baseProps = {
      tradeId: "trade-001",
      commodity: "Crude Oil",
      counterparty: { role: "Buyer", address: "0x1234567890abcdef" },
      amountCngn: "500,000",
      status: "PENDING" as const,
      createdAt: "2026-06-01T10:00:00Z",
      onView: () => {},
    };

    it("has no axe violations in PENDING state", async () => {
      const { container } = render(<TradeListItem {...baseProps} />);
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no axe violations in SETTLED state", async () => {
      const { container } = render(
        <TradeListItem {...baseProps} status="SETTLED" />
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no axe violations in DISPUTED state", async () => {
      const { container } = render(
        <TradeListItem {...baseProps} status="DISPUTED" />
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no axe violations with deposit/withdraw actions", async () => {
      const { container } = render(
        <TradeListItem
          {...baseProps}
          onDeposit={() => {}}
          onWithdraw={() => {}}
        />
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("Interactive modal and stepper states", () => {
    it("trade action modal (deposit/withdraw) has no axe violations", async () => {
      const { container } = render(
        <div role="dialog" aria-modal="true" aria-labelledby="trade-modal-title">
          <h2 id="trade-modal-title">Trade actions</h2>
          <TradeListItem
            tradeId="trade-002"
            commodity="Crude Oil"
            counterparty={{ role: "Seller", address: "0xabcdef1234567890" }}
            amountCngn="250,000"
            status="PENDING"
            createdAt="2026-06-02T10:00:00Z"
            onView={() => {}}
            onDeposit={() => {}}
            onWithdraw={() => {}}
          />
          <Button variant="primary">Confirm</Button>
          <Button variant="secondary">Cancel</Button>
        </div>
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("dispute stepper step has no axe violations", async () => {
      const { container } = render(
        <div>
          <ol aria-label="Dispute resolution steps">
            <li aria-current="step">1. Open dispute</li>
            <li>2. Provide evidence</li>
            <li>3. Resolution</li>
          </ol>
          <FormField label="Reason" name="reason" required>
            <textarea />
          </FormField>
          <Button variant="primary">Next</Button>
        </div>
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("vault deposit stepper step has no axe violations", async () => {
      const { container } = render(
        <div>
          <ol aria-label="Vault deposit steps">
            <li aria-current="step">1. Select amount</li>
            <li>2. Confirm</li>
          </ol>
          <FormField label="Amount" name="amount" required>
            <input type="number" inputMode="decimal" />
          </FormField>
          <StatusBadge status="pending" />
          <Button variant="primary">Deposit</Button>
        </div>
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
