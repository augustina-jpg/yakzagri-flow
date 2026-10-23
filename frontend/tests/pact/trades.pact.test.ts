import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
import { describe, it, expect } from 'vitest';

const { like, eachLike, integer, decimal, string, regex } = MatchersV3;

const provider = new PactV3({
  consumer: 'trades-frontend',
  provider: 'trades-api',
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

describe('Trades API contract', () => {
  it('returns a list of trades', async () => {
    provider
      .given('trades exist')
      .uponReceiving('a request for the trades list')
      .withRequest({
        method: 'GET',
        path: '/api/v1/trades',
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: eachLike({
          id: string('trade-1'),
          symbol: string('BTC/USD'),
          amount: decimal(1.5),
          status: string('filled'),
        }),
      });

    await provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/v1/trades`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  it('returns a list of disputes', async () => {
    provider
      .given('disputes exist')
      .uponReceiving('a request for the disputes list')
      .withRequest({
        method: 'GET',
        path: '/api/v1/disputes',
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: eachLike({
          id: string('dispute-1'),
          tradeId: string('trade-1'),
          reason: string('payment_not_received'),
          status: string('open'),
          createdAt: string('2024-01-01T00:00:00.000Z'),
        }),
      });

    await provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/v1/disputes`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  it('creates a dispute', async () => {
    provider
      .given('a trade exists')
      .uponReceiving('a request to create a dispute')
      .withRequest({
        method: 'POST',
        path: '/api/v1/disputes',
        headers: { 'Content-Type': 'application/json' },
        body: {
          tradeId: string('trade-1'),
          reason: string('payment_not_received'),
        },
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: string('dispute-1'),
          tradeId: string('trade-1'),
          reason: string('payment_not_received'),
          status: string('open'),
          createdAt: string('2024-01-01T00:00:00.000Z'),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/v1/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: 'trade-1',
          reason: 'payment_not_received',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
    });
  });

  it('returns a stream by id', async () => {
    provider
      .given('a stream exists')
      .uponReceiving('a request for a stream by id')
      .withRequest({
        method: 'GET',
        path: '/api/v1/streams/stream-1',
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: string('stream-1'),
          tradeId: string('trade-1'),
          status: string('active'),
          rate: decimal(0.5),
          totalAmount: decimal(100),
          streamedAmount: decimal(25),
          startedAt: string('2024-01-01T00:00:00.000Z'),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/v1/streams/stream-1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe('stream-1');
    });
  });

  it('returns 404 for an unknown stream', async () => {
    provider
      .given('a stream does not exist')
      .uponReceiving('a request for an unknown stream by id')
      .withRequest({
        method: 'GET',
        path: '/api/v1/streams/unknown',
      })
      .willRespondWith({
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: string('stream_not_found'),
          message: string('Stream not found'),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/v1/streams/unknown`);
      expect(res.status).toBe(404);
    });
  });

  it('returns the wallet balance', async () => {
    provider
      .given('a wallet exists')
      .uponReceiving('a request for the wallet balance')
      .withRequest({
        method: 'GET',
        path: '/api/v1/wallet/balance',
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          asset: string('USD'),
          balance: decimal(1000.5),
          available: decimal(900.5),
          locked: decimal(100),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/v1/wallet/balance`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.asset).toBeDefined();
    });
  });

  it('returns 401 for an unauthorized wallet balance request', async () => {
    provider
      .given('the request is unauthorized')
      .uponReceiving('an unauthorized request for the wallet balance')
      .withRequest({
        method: 'GET',
        path: '/api/v1/wallet/balance',
      })
      .willRespondWith({
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: string('unauthorized'),
          message: string('Authentication required'),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/v1/wallet/balance`);
      expect(res.status).toBe(401);
    });
  });
});
