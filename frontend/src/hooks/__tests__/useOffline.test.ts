import { renderHook, act, waitFor } from '@testing-library/react';
import { useOffline } from '../useOffline';

describe('useOffline', () => {
  const originalFetch = global.fetch;
  let onlineGetter: jest.SpyInstance;

  const setOnline = (value: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => value,
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    setOnline(true);
    onlineGetter = jest.spyOn(window.navigator, 'onLine', 'get');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    void onlineGetter;
  });

  it('reflects the initial online state', () => {
    const { result } = renderHook(() => useOffline());
    expect(result.current.isOnline).toBe(true);
  });

  it('reflects the initial offline state', () => {
    setOnline(false);
    const { result } = renderHook(() => useOffline());
    expect(result.current.isOnline).toBe(false);
  });

  it('transitions to offline when the offline event fires', () => {
    const { result } = renderHook(() => useOffline());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('transitions back to online when the online event fires', () => {
    setOnline(false);
    const { result } = renderHook(() => useOffline());
    expect(result.current.isOnline).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
  });

  it('removes event listeners on unmount', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOffline());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('reports online when the health probe succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);

    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await result.current.checkConnection?.();
    });

    expect(result.current.isOnline).toBe(true);
  });

  it('reports offline when the health probe fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await result.current.checkConnection?.();
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('reports offline when the health probe times out', async () => {
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((_resolve, reject) => {
          setTimeout(() => reject(new Error('timeout')), 10000);
        }),
    );

    const { result } = renderHook(() => useOffline());

    await act(async () => {
      const probe = result.current.checkConnection?.();
      jest.advanceTimersByTime(10000);
      await probe;
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(false);
    });
  });
});
