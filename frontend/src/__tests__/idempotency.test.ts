import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createIdempotencyKey, withIdempotencyKey } from '../lib/idempotency';

describe('idempotency utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createIdempotencyKey', () => {
    it('produces a deterministic key for identical inputs', () => {
      const first = createIdempotencyKey('streams', 'create', { id: 'abc', name: 'Test' });
      const second = createIdempotencyKey('streams', 'create', { id: 'abc', name: 'Test' });
      expect(first).toBe(second);
    });

    it('is independent of object key ordering', () => {
      const a = createIdempotencyKey('streams', 'create', { id: 'abc', name: 'Test' });
      const b = createIdempotencyKey('streams', 'create', { name: 'Test', id: 'abc' });
      expect(a).toBe(b);
    });

    it('produces different keys for different actions', () => {
      const create = createIdempotencyKey('streams', 'create', { id: 'abc' });
      const update = createIdempotencyKey('streams', 'update', { id: 'abc' });
      expect(create).not.toBe(update);
    });

    it('produces different keys for different payloads', () => {
      const a = createIdempotencyKey('streams', 'create', { id: 'abc' });
      const b = createIdempotencyKey('streams', 'create', { id: 'xyz' });
      expect(a).not.toBe(b);
    });

    it('handles nested payloads deterministically', () => {
      const a = createIdempotencyKey('streams', 'create', {
        id: 'abc',
        meta: { b: 2, a: 1 },
      });
      const b = createIdempotencyKey('streams', 'create', {
        meta: { a: 1, b: 2 },
        id: 'abc',
      });
      expect(a).toBe(b);
    });

    it('returns a stable string format', () => {
      const key = createIdempotencyKey('streams', 'create', { id: 'abc' });
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe('withIdempotencyKey', () => {
    it('attaches a deterministic key to the request', () => {
      const request = { scope: 'streams', action: 'create', payload: { id: 'abc' } };
      const first = withIdempotencyKey(request);
      const second = withIdempotencyKey(request);
      expect(first.idempotencyKey).toBe(second.idempotencyKey);
    });

    it('preserves the original request fields', () => {
      const request = { scope: 'streams', action: 'create', payload: { id: 'abc' } };
      const result = withIdempotencyKey(request);
      expect(result.scope).toBe('streams');
      expect(result.action).toBe('create');
      expect(result.payload).toEqual({ id: 'abc' });
    });
  });
});
