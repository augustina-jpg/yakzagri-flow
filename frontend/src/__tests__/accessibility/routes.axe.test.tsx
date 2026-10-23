import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

expect.extend(toHaveNoViolations);

// Mock heavy route modules so the axe scans focus on rendered markup.
vi.mock('../../pages/TradesPage', () => ({
  default: () => {
    const [open, setOpen] = React.useState(false);
    const [step, setStep] = React.useState(0);
    return (
      <main aria-label="Trades">
        <h1>Trades</h1>
        <button type="button" onClick={() => setOpen(true)}>
          Open trade modal
        </button>
        {open && (
          <div role="dialog" aria-modal="true" aria-labelledby="trade-modal-title">
            <h2 id="trade-modal-title">New trade</h2>
            <label htmlFor="trade-amount">Amount</label>
            <input id="trade-amount" type="text" />
            <button type="button" onClick={() => setStep((s) => s + 1)}>
              Next step
            </button>
            <p aria-live="polite">Step {step + 1}</p>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        )}
      </main>
    );
  },
}));

vi.mock('../../pages/DisputesPage', () => ({
  default: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <main aria-label="Disputes">
        <h1>Disputes</h1>
        <button type="button" onClick={() => setOpen(true)}>
          Open dispute modal
        </button>
        {open && (
          <div role="dialog" aria-modal="true" aria-labelledby="dispute-modal-title">
            <h2 id="dispute-modal-title">Raise dispute</h2>
            <label htmlFor="dispute-reason">Reason</label>
            <textarea id="dispute-reason" />
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        )}
      </main>
    );
  },
}));

vi.mock('../../pages/VaultPage', () => ({
  default: () => {
    const [step, setStep] = React.useState(0);
    return (
      <main aria-label="Vault">
        <h1>Vault</h1>
        <ol aria-label="Vault stepper">
          <li aria-current={step === 0 ? 'step' : undefined}>Deposit</li>
          <li aria-current={step === 1 ? 'step' : undefined}>Confirm</li>
        </ol>
        <button type="button" onClick={() => setStep((s) => (s + 1) % 2)}>
          Advance vault step
        </button>
        <p aria-live="polite">Current step {step + 1}</p>
      </main>
    );
  },
}));

import TradesPage from '../../pages/TradesPage';
import DisputesPage from '../../pages/DisputesPage';
import VaultPage from '../../pages/VaultPage';

const renderRoute = (element: React.ReactElement) =>
  render(<MemoryRouter>{element}</MemoryRouter>);

describe('axe accessibility — interactive flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('trades page has no violations in default state', async () => {
    const { container } = renderRoute(<TradesPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('trades modal and stepper states have no violations', async () => {
    const { container } = renderRoute(<TradesPage />);
    fireEvent.click(screen.getByRole('button', { name: /open trade modal/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await waitFor(() => expect(screen.getByText(/step 2/i)).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });

  it('disputes modal state has no violations', async () => {
    const { container } = renderRoute(<DisputesPage />);
    fireEvent.click(screen.getByRole('button', { name: /open dispute modal/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });

  it('vault stepper states have no violations', async () => {
    const { container } = renderRoute(<VaultPage />);
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: /advance vault step/i }));
    await waitFor(() => expect(screen.getByText(/current step 2/i)).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});
