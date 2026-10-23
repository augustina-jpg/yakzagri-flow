import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '../useErrorHandler';
import { ApiError } from '../../lib/api';

describe('useErrorHandler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('classifies ApiError with a status code', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new ApiError('Not found', 404));
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.type).toBe('api');
    expect(result.current.error?.message).toBe('Not found');
    expect(result.current.error?.status).toBe(404);
  });

  it('classifies network timeout errors', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new Error('Network timeout'));
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.type).toBe('network');
    expect(result.current.error?.message).toBe('Network timeout');
  });

  it('classifies unknown errors', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new Error('Something unexpected'));
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.type).toBe('unknown');
    expect(result.current.error?.message).toBe('Something unexpected');
  });

  it('clears the current error', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new ApiError('Server error', 500));
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
