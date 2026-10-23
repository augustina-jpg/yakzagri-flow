import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/csp-report/route';

const MAX_PAYLOAD_BYTES = 16 * 1024;

function makeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/csp-report', {
    method: 'POST',
    headers: { 'content-type': 'application/csp-report', ...headers },
    body,
  });
}

function validReport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    'csp-report': {
      'document-uri': 'https://example.com/page',
      'violated-directive': 'script-src',
      'blocked-uri': 'https://evil.example.com/x.js',
      ...overrides,
    },
  });
}

describe('POST /api/csp-report', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a valid CSP report', async () => {
    const res = await POST(makeRequest(validReport()));
    expect(res.status).toBe(204);
  });

  it('rejects payloads larger than 16KB', async () => {
    const oversized = JSON.stringify({
      'csp-report': {
        'document-uri': 'https://example.com/page',
        'violated-directive': 'script-src',
        'blocked-uri': 'x'.repeat(MAX_PAYLOAD_BYTES + 1),
      },
    });
    const res = await POST(makeRequest(oversized));
    expect(res.status).toBe(413);
  });

  it('rejects invalid JSON', async () => {
    const res = await POST(makeRequest('{not-json'));
    expect(res.status).toBe(400);
  });

  it('rejects payloads missing the csp-report field', async () => {
    const res = await POST(makeRequest(JSON.stringify({ foo: 'bar' })));
    expect(res.status).toBe(400);
  });

  it('rejects payloads with wrong shape', async () => {
    const res = await POST(makeRequest(JSON.stringify({ 'csp-report': 'not-an-object' })));
    expect(res.status).toBe(400);
  });

  it('rejects payloads missing required fields', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ 'csp-report': { 'document-uri': 'https://example.com' } })),
    );
    expect(res.status).toBe(400);
  });

  it('sanitizes control characters in logged fields', async () => {
    const logSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await POST(
      makeRequest(
        validReport({
          'blocked-uri': 'https://evil.example.com/x.js\nINJECTED\r\u0000LOG',
        }),
      ),
    );
    expect(res.status).toBe(204);
    const logged = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).not.toContain('\nINJECTED');
    expect(logged).not.toContain('\r');
    expect(logged).not.toContain('\u0000');
  });
});
