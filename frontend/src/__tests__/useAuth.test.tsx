import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../hooks/useAuth';

function TestConsumer() {
  const { isAuthenticated, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <button onClick={() => signIn({ id: '1', address: '0xabc' }, 'token-123')}>signin</button>
      <button onClick={() => signOut()}>signout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

describe('useAuth signOut cache purge', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('clears offlineCache, notificationStore, and trade drafts on signOut', () => {
    window.localStorage.setItem('offlineCache', '{"a":1}');
    window.localStorage.setItem('notificationStore', '[]');
    window.localStorage.setItem('tradeDrafts', '{}');
    window.localStorage.setItem('tradeDraft:42', '{}');
    window.localStorage.setItem('unrelated', 'keep-me');

    renderWithProvider();
    act(() => {
      screen.getByText('signout').click();
    });

    expect(window.localStorage.getItem('offlineCache')).toBeNull();
    expect(window.localStorage.getItem('notificationStore')).toBeNull();
    expect(window.localStorage.getItem('tradeDrafts')).toBeNull();
    expect(window.localStorage.getItem('tradeDraft:42')).toBeNull();
    expect(window.localStorage.getItem('unrelated')).toBe('keep-me');
  });

  it('clears auth token and user on signOut', () => {
    renderWithProvider();
    act(() => {
      screen.getByText('signin').click();
    });
    expect(screen.getByTestId('status').textContent).toBe('in');
    expect(window.localStorage.getItem('authToken')).toBe('token-123');

    act(() => {
      screen.getByText('signout').click();
    });
    expect(screen.getByTestId('status').textContent).toBe('out');
    expect(window.localStorage.getItem('authToken')).toBeNull();
    expect(window.localStorage.getItem('authUser')).toBeNull();
  });

  it('does not throw when caches are missing', () => {
    renderWithProvider();
    expect(() => {
      act(() => {
        screen.getByText('signout').click();
      });
    }).not.toThrow();
  });

  it('does not throw when localStorage access fails', () => {
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    renderWithProvider();
    expect(() => {
      act(() => {
        screen.getByText('signout').click();
      });
    }).not.toThrow();

    removeSpy.mockRestore();
  });
});
