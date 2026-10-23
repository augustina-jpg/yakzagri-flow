# Frontend Security

This document describes the security mechanisms implemented in the frontend
middleware (`frontend/src/middleware.ts`): per-request CSP nonces, the
`/api/csp-report` telemetry endpoint, and the wallet iframe allowlist.

## Content Security Policy (CSP) nonces

### Generation

On every request the middleware generates a fresh, cryptographically random
nonce. The nonce is unique per request and is never reused across requests, so
cached or replayed responses cannot be used to bypass the policy.

### Propagation to the CSP header

The nonce is embedded in the `Content-Security-Policy` response header that the
middleware sets on the outgoing response. The `script-src` (and, where
applicable, `style-src`) directives include the nonce via the standard
`'nonce-<value>'` source expression, alongside the other sources the middleware
configures.

### Reaching scripts and styles

The same nonce value is exposed to the application so that inline `<script>`
and `<style>` tags can carry a matching `nonce` attribute. Only elements whose
`nonce` attribute matches the value in the CSP header are allowed to execute;
any inline script or style without a matching nonce is blocked by the browser.

Because the nonce changes on every request, do not hard-code it or cache it
across requests. Always read the per-request value provided by the middleware.

## CSP violation telemetry: `/api/csp-report`

Browsers send CSP violation reports to the endpoint configured in the policy's
`report-uri` / `report-to` directive. The middleware wires this to
`/api/csp-report`.

### What is accepted

The endpoint accepts the standard CSP report payloads that browsers POST when a
policy is violated (the `application/csp-report` and Reporting API
`application/reports+json` shapes). Reports describe the blocked resource, the
violated directive, and the document in which the violation occurred.

### How violations are logged and observed

Incoming reports are recorded by the endpoint so that violations can be
inspected and triaged. Use these reports to:

- Identify directives that are too strict and are blocking legitimate resources.
- Detect unexpected sources (for example, injected or third-party scripts).
- Confirm that nonce propagation is working (a missing or mismatched nonce shows
  up as a `script-src` / `style-src` violation).

When investigating, correlate the reported `blocked-uri` and `violated-directive`
with the CSP header returned for the affected request.

## Wallet iframe allowlist (`WALLET_FRAME_ALLOWLIST`)

Wallet integrations embed third-party origins in iframes. Rather than allowing
arbitrary frames, the middleware restricts framing to an explicit allowlist.

### Configuration

Wallet iframe origins are configured through the `WALLET_FRAME_ALLOWLIST`
environment variable. It is a list of origins (for example,
`https://wallet.example.com`) that are permitted to be framed by the app.

### Validation and reflection in the policy

The middleware reads `WALLET_FRAME_ALLOWLIST`, parses the configured origins,
and reflects them in the frame-related CSP directives (`frame-src` and
`child-src`). Only origins present in the allowlist are permitted as frame
sources; everything else is blocked by the browser.

To add or remove a wallet provider, update `WALLET_FRAME_ALLOWLIST` and redeploy
so the middleware picks up the new value. Do not add origins directly to the CSP
header in code — the allowlist is the single source of truth for framed wallet
origins.
