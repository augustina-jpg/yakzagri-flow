import { renderHook, waitFor } from '@testing-library/react';
import { useWallet } from '../useWallet';
import { ApiError } from '@/lib/api';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      get: jest.fn(),
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- access mocked module
const { api } = require('@/lib/api') as { api: { get: jest.Mock } };

describe('useWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts in a loading state', () => {
    api.get.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWallet());

    expect(result.current.loading).toBe(true);
    expect(result.current.balance).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('loads the balance on success', async () => {
    api.get.mockResolvedValue({ balance: '123.45', currency: 'USD' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.balance).toEqual({ balance: '123.45', currency: 'USD' });
    expect(result.current.error).toBeNull();
  });

  it('exposes an ApiError when the request fails', async () => {
    const apiError = new ApiError('Unauthorized', 401);
    api.get.mockRejectedValue(apiError);

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(apiError);
    expect(result.current.balance).toBeNull();
  });

  it('does not fetch when unauthenticated', async () => {
    const { result } = renderHook(() => useWallet({ authenticated: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.balance).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
