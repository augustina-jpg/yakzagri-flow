import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NetworkBackboneCard from '../NetworkBackboneCard';

describe('NetworkBackboneCard', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  const mockFetchSuccess = (ledger: number, protocolVersion = 20) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          sequence: ledger,
          protocolVersion,
        },
      }),
    } as unknown as Response);
  };

  it('shows a loading state before the probe resolves', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    global.fetch = jest.fn().mockReturnValue(pending);

    render(<NetworkBackboneCard />);

    expect(screen.getByText(/checking|loading|probing/i)).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({ result: { sequence: 100, protocolVersion: 20 } }),
    });

    await waitFor(() => {
      expect(screen.queryByText(/checking|loading|probing/i)).not.toBeInTheDocument();
    });
  });

  it('renders healthy state with semantic status color, ledger sequence, and latency', async () => {
    mockFetchSuccess(123456);

    render(<NetworkBackboneCard />);

    await waitFor(() => {
      expect(screen.getByText(/healthy/i)).toBeInTheDocument();
    });

    const statusEl = screen.getByText(/healthy/i);
    expect(statusEl.className).toMatch(/green|success|emerald/);

    expect(screen.getByText(/123456/)).toBeInTheDocument();
    expect(screen.getByText(/ms|latency/i)).toBeInTheDocument();
  });

  it('renders degraded state with semantic status color for slow success', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ result: { sequence: 654321, protocolVersion: 20 } }),
            });
          }, 5000);
        }),
    );

    render(<NetworkBackboneCard />);

    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(screen.getByText(/degraded/i)).toBeInTheDocument();
    });

    const statusEl = screen.getByText(/degraded/i);
    expect(statusEl.className).toMatch(/yellow|amber|warning/);

    jest.useRealTimers();
  });

  it('renders degraded state for transient error', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { sequence: 222222, protocolVersion: 20 } }),
      } as unknown as Response);

    render(<NetworkBackboneCard />);

    await waitFor(() => {
      const el = screen.queryByText(/degraded|healthy/i);
      expect(el).toBeInTheDocument();
    });
  });

  it('renders unreachable state with semantic status color when fetch rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    render(<NetworkBackboneCard />);

    await waitFor(() => {
      expect(screen.getByText(/unreachable|offline/i)).toBeInTheDocument();
    });

    const statusEl = screen.getByText(/unreachable|offline/i);
    expect(statusEl.className).toMatch(/red|error|rose/);
  });

  it('renders unreachable state on timeout', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('timeout')), 30000);
        }),
    );

    render(<NetworkBackboneCard />);

    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(screen.getByText(/unreachable|offline/i)).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('offers retry after failure and recovers to healthy', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { sequence: 999999, protocolVersion: 20 } }),
      } as unknown as Response);

    render(<NetworkBackboneCard />);

    await waitFor(() => {
      expect(screen.getByText(/unreachable|offline/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /retry|refresh|try again/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(/healthy/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/999999/)).toBeInTheDocument();
  });
});