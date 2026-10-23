import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

function makeRequest(path: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(path, 'https://example.com'), init);
}

describe('middleware security headers', () => {
  it('sets Referrer-Policy to strict-origin-when-cross-origin', () => {
    const response = middleware(makeRequest('/'));
    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('sets X-Content-Type-Options to nosniff', () => {
    const response = middleware(makeRequest('/'));
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets a Permissions-Policy header', () => {
    const response = middleware(makeRequest('/'));
    const policy = response.headers.get('Permissions-Policy');
    expect(policy).toBeTruthy();
    expect(policy).toContain('camera=()');
    expect(policy).toContain('microphone=()');
    expect(policy).toContain('geolocation=()');
  });

  it('applies security headers on nested routes', () => {
    const response = middleware(makeRequest('/dashboard/settings'));
    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Permissions-Policy')).toBeTruthy();
  });

  it('applies security headers on API routes', () => {
    const response = middleware(makeRequest('/api/health'));
    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Permissions-Policy')).toBeTruthy();
  });
});
