import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '../page';

describe('Settings page', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('renders the settings page', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it('toggles notification preferences', async () => {
    render(<SettingsPage />);
    const toggle = screen.getByRole('switch', { name: /notifications/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('changes the network select', async () => {
    render(<SettingsPage />);
    const select = screen.getByLabelText(/network/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'testnet' } });
    await waitFor(() => {
      expect(select.value).toBe('testnet');
    });
  });

  it('changes the currency select', async () => {
    render(<SettingsPage />);
    const select = screen.getByLabelText(/currency/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'EUR' } });
    await waitFor(() => {
      expect(select.value).toBe('EUR');
    });
  });

  it('resets preferences to defaults', async () => {
    render(<SettingsPage />);
    const toggle = screen.getByRole('switch', { name: /notifications/i });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });
  });
});
