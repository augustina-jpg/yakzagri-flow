import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for Pinata operations that require the secret key.
 *
 * The Pinata secret must never be exposed to the browser, so any call that
 * needs `PINATA_SECRET` is routed through this handler. The client only ever
 * talks to this route using the safe-to-expose `NEXT_PUBLIC_PINATA_*` config.
 */

const PINATA_API_URL = 'https://api.pinata.cloud';

function getServerConfig() {
  const apiKey = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_SECRET;

  if (!apiKey || !secret) {
    return null;
  }

  return { apiKey, secret };
}

export async function POST(request: NextRequest) {
  const config = getServerConfig();

  if (!config) {
    return NextResponse.json(
      { error: 'Pinata server credentials are not configured' },
      { status: 500 },
    );
  }

  let body: { action?: string; payload?: unknown; sha256?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, payload, sha256 } = body;

  if (action !== 'pinJSONToIPFS') {
    return NextResponse.json(
      { error: `Unsupported Pinata action: ${action ?? 'undefined'}` },
      { status: 400 },
    );
  }

  if (sha256 !== undefined && !/^[a-f0-9]{64}$/i.test(sha256)) {
    return NextResponse.json(
      { error: 'Invalid SHA-256 digest' },
      { status: 400 },
    );
  }

  // Merge the client-computed digest into the pinataMetadata so it is
  // persisted alongside the pinned content for tamper verification.
  const pinataPayload =
    payload && typeof payload === 'object'
      ? { ...(payload as Record<string, unknown>) }
      : {};

  if (sha256) {
    const existingMetadata =
      pinataPayload.pinataMetadata &&
      typeof pinataPayload.pinataMetadata === 'object'
        ? (pinataPayload.pinataMetadata as Record<string, unknown>)
        : {};

    const existingKeyValues =
      existingMetadata.keyvalues &&
      typeof existingMetadata.keyvalues === 'object'
        ? (existingMetadata.keyvalues as Record<string, unknown>)
        : {};

    pinataPayload.pinataMetadata = {
      ...existingMetadata,
      keyvalues: {
        ...existingKeyValues,
        sha256,
      },
    };
  }

  try {
    const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: config.apiKey,
        pinata_secret_api_key: config.secret,
      },
      body: JSON.stringify(pinataPayload),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to reach Pinata',
      },
      { status: 502 },
    );
  }
}
