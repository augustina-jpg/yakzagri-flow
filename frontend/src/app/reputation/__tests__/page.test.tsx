import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReputationPage from '../page';

const mockFetchReputation = jest.fn();

jest.mock('@/lib/api', () => ({
  fetchReputation: (...args: unknown[]) => mockFetchReputation(...args),
}));

describe('ReputationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading skeletons while fetching', () => {
    mockFetchReputation.mockReturnValue(new Promise(() => {}));

    render(<ReputationPage />);

    expect(screen.getByTestId('reputation-loading')).toBeInTheDocument();
  });

  it('renders the reputation score once loaded', async () => {
    mockFetchReputation.mockResolvedValue({ score: 87, level: 'Trusted' });

    render(<ReputationPage />);

    expect(await screen.findByText('87')).toBeInTheDocument();
    expect(screen.getByText('Trusted')).toBeInTheDocument();
    expect(screen.queryByTestId('reputation-loading')).not.toBeInTheDocument();
  });

  it('shows an error state and retries on button click', async () => {
    mockFetchReputation
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ score: 42, level: 'Newcomer' });

    render(<ReputationPage />);

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(mockFetchReputation).toHaveBeenCalledTimes(2);
  });
});
