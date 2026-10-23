import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockParams = { id: 'stream-123' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useParams: () => mockParams,
  usePathname: () => '/admin/streams/stream-123',
}));

const mockStream = {
  id: 'stream-123',
  recipient: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV',
  sender: 'GZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
  amount: '1000.0000000',
  withdrawn: '250.0000000',
  status: 'Active',
  startTime: 1700000000,
  endTime: 1700086400,
  cliffTime: 1700000000,
  cancelable: true,
  createdAt: '2024-01-01T00:00:00.000Z',
};

const mockFetchStream = jest.fn();
const mockPreviewClawback = jest.fn();

jest.mock('@/lib/api/admin', () => ({
  fetchAdminStream: (...args: unknown[]) => mockFetchStream(...args),
  previewClawback: (...args: unknown[]) => mockPreviewClawback(...args),
  executeClawback: jest.fn(),
}));

import AdminStreamDetailPage from '../page';

describe('Admin Stream Detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchStream.mockResolvedValue(mockStream);
    mockPreviewClawback.mockResolvedValue({
      amount: '750.0000000',
      recipient: mockStream.recipient,
      remaining: '0.0000000',
    });
  });

  it('renders stream metadata after loading', async () => {
    render(<AdminStreamDetailPage />);

    await waitFor(() => {
      expect(mockFetchStream).toHaveBeenCalledWith('stream-123');
    });

    expect(await screen.findByText('stream-123')).toBeInTheDocument();
    expect(screen.getByText(mockStream.recipient)).toBeInTheDocument();
    expect(screen.getByText(mockStream.sender)).toBeInTheDocument();
    expect(screen.getByText(/1000/)).toBeInTheDocument();
    expect(screen.getByText(/250/)).toBeInTheDocument();
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });

  it('shows an error state when the stream fails to load', async () => {
    mockFetchStream.mockRejectedValueOnce(new Error('not found'));

    render(<AdminStreamDetailPage />);

    expect(await screen.findByText(/not found|error|failed/i)).toBeInTheDocument();
  });

  it('opens the clawback modal and shows the preview', async () => {
    render(<AdminStreamDetailPage />);

    await screen.findByText('stream-123');

    const clawbackButton = screen.getByRole('button', { name: /clawback/i });
    fireEvent.click(clawbackButton);

    await waitFor(() => {
      expect(mockPreviewClawback).toHaveBeenCalledWith('stream-123');
    });

    expect(await screen.findByText(/750/)).toBeInTheDocument();
  });

  it('closes the clawback modal', async () => {
    render(<AdminStreamDetailPage />);

    await screen.findByText('stream-123');
    fireEvent.click(screen.getByRole('button', { name: /clawback/i }));

    await screen.findByText(/750/);

    const cancelButton = screen.getByRole('button', { name: /cancel|close/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/750/)).not.toBeInTheDocument();
    });
  });

  it('handles a clawback preview error gracefully', async () => {
    mockPreviewClawback.mockRejectedValueOnce(new Error('preview failed'));

    render(<AdminStreamDetailPage />);

    await screen.findByText('stream-123');
    fireEvent.click(screen.getByRole('button', { name: /clawback/i }));

    expect(await screen.findByText(/preview failed|error|failed/i)).toBeInTheDocument();
  });
});
