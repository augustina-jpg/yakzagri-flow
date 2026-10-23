import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActionDedup } from '../lib/actionDedup';
import { buildIdempotencyKey } from '../lib/idempotency';

describe('ActionDedup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('suppresses duplicate actions within the dedup window', () => {
    const dedup = new ActionDedup(1000);

    expect(dedup.shouldProcess('stream:1:start')).toBe(true);
    expect(dedup.shouldProcess('stream:1:start')).toBe(false);
  });

  it('allows the same action again after the window expires', () => {
    const dedup = new ActionDedup(1000);

    expect(dedup.shouldProcess('stream:1:start')).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(dedup.shouldProcess('stream:1:start')).toBe(true);
  });

  it('treats distinct actions independently', () => {
    const dedup = new ActionDedup(1000);

    expect(dedup.shouldProcess('stream:1:start')).toBe(true);
    expect(dedup.shouldProcess('stream:1:stop')).toBe(true);
    expect(dedup.shouldProcess('stream:2:start')).toBe(true);
  });

  it('still suppresses duplicates right at the window boundary', () => {
    const dedup = new ActionDedup(1000);

    expect(dedup.shouldProcess('stream:1:start')).toBe(true);
    vi.advanceTimersByTime(999);
    expect(dedup.shouldProcess('stream:1:start')).toBe(false);
  });
});

describe('buildIdempotencyKey', () => {
  it('produces a deterministic key for identical inputs', () => {
    const first = buildIdempotencyKey('stream', '1', 'start');
    const second = buildIdempotencyKey('stream', '1', 'start');

    expect(first).toBe(second);
  });

  it('produces different keys for different inputs', () => {
    expect(buildIdempotencyKey('stream', '1', 'start')).not.toBe(
      buildIdempotencyKey('stream', '1', 'stop'),
    );
    expect(buildIdempotencyKey('stream', '1', 'start')).not.toBe(
      buildIdempotencyKey('stream', '2', 'start'),
    );
  });

  it('formats the key consistently regardless of input ordering', () => {
    const a = buildIdempotencyKey('stream', '1', 'start');
    const b = buildIdempotencyKey('stream', '1', 'start');

    expect(a).toMatch(/^stream:1:start$/);
    expect(b).toMatch(/^stream:1:start$/);
  });
});
