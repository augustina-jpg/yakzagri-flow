import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCachedNotifications } from '../hooks/useCachedNotifications';

const mockFetch = vi.fn();

const cachedNotifications = [
  { id: '1', title: 'Cached one', read: false },
  { id: '2', title: 'Cached two', read: true },
];

const freshNotifications = [
  { id: '3', title: 'Fresh one', read: false },
];

function mockCacheGet(value: unknown) {
  return vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
    value === undefined ? null : JSON.stringify(value),
  );
}

function mockCacheSet() {
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
}

describe('useCachedNotifications', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns cached notifications immediately on a cache hit', async () => {
    mockCacheGet(cachedNotifications);
    mockCacheSet();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => freshNotifications,
    });

    const { result } = renderHook(() => useCachedNotifications());

    expect(result.current.data).toEqual(cachedNotifications);
    expect(result.current.isLoading).toBe(false);

    await waitFor(() => {
      expect(result.current.data).toEqual(freshNotifications);
    });
  });

  it('revalidates in the background after serving cached data', async () => {
    mockCacheGet(cachedNotifications);
    const setItem = mockCacheSet();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => freshNotifications,
    });

    const { result } = renderHook(() => useCachedNotifications());

    expect(result.current.data).toEqual(cachedNotifications);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.data).toEqual(freshNotifications);
    });

    expect(setItem).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(freshNotifications),
    );
  });

  it('falls back to cached data when the network request fails', async () => {
    mockCacheGet(cachedNotifications);
    mockCacheSet();
    mockFetch.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useCachedNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(cachedNotifications);
    expect(result.current.error).toBeTruthy();
  });

  it('surfaces an error when there is no cache and the request fails', async () => {
    mockCacheGet(undefined);
    mockCacheSet();
    mockFetch.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useCachedNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeTruthy();
  });
});
