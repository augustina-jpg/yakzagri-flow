# Mediator Resolution Panel - Phase 3 Proof

Date: 2026-03-28
Route: `/mediator/disputes/[id]`

## Implemented semantic fixes

1. Contract call switched from `initiate_dispute` to `resolve_dispute`.
2. Resolution call now uses contract signature:
   - `resolve_dispute(trade_id: u64, mediator: Address, seller_gets_bps: u32)`
3. Loss-ratio action mapping:
   - `Resolve 50/50 On-Chain` => `seller_gets_bps = 5000`
   - `Resolve 70/30 On-Chain` => `seller_gets_bps = 7000`
4. Guard added to ensure URL id is numeric and valid for on-chain `trade_id`.
5. Mediator gating remains strict via Freighter identity + wallet whitelist.

## Proof-of-Delivery (PoD) & Dispute architecture

This section documents the end-to-end PoD flow: video upload, IPFS pinning,
driver attestation, and mediator settlement, plus the dispute lifecycle.

### End-to-end sequence

```mermaid
sequenceDiagram
    autonumber
    actor Driver
    actor Buyer
    participant FE as Frontend (Next.js)
    participant Pinata as Pinata / IPFS
    participant Chain as Soroban Contract
    actor Mediator

    Note over Driver,Chain: 1. Proof-of-Delivery capture
    Driver->>FE: Record delivery video
    FE->>Pinata: Upload video (pin)
    Pinata-->>FE: Return CID + gateway URL
    FE->>Chain: submit_pod(trade_id, cid, driver)
    Chain-->>FE: PoD recorded (status = Delivered)

    Note over Buyer,Chain: 2. Buyer review window
    Buyer->>FE: Review PoD video (gateway)
    alt Buyer accepts
        Buyer->>Chain: confirm_delivery(trade_id)
        Chain-->>FE: status = Completed
    else Buyer disputes
        Buyer->>Chain: initiate_dispute(trade_id)
        Chain-->>FE: status = Disputed
    end

    Note over Mediator,Chain: 3. Mediator settlement
    Mediator->>FE: Open /mediator/disputes/[id]
    FE->>FE: Gate via Freighter identity + whitelist
    Mediator->>FE: Review PoD video + evidence
    Mediator->>Chain: resolve_dispute(trade_id, mediator, seller_gets_bps)
    Chain-->>FE: status = Resolved (funds split)
```

### IPFS pinning & gateway fallback

- Video is pinned through Pinata; the returned CID is stored on-chain via
  `submit_pod` so the attestation is immutable.
- The UI renders the video from the Pinata gateway and exposes a gateway
  fallback/switch action if the primary gateway is unavailable.
- The CID (not the raw video) is the canonical reference used by buyers and
  mediators during review.

### Driver attestation

- The driver wallet signs the `submit_pod` transaction, binding the CID to the
  driver identity and `trade_id`.
- Attestation is only accepted while the trade is in an `InTransit` state.

## State lifecycle guide

### PoD / trade states

```mermaid
stateDiagram-v2
    [*] --> Created
    Created --> InTransit: driver accepts
    InTransit --> Delivered: submit_pod(cid)
    Delivered --> Completed: confirm_delivery
    Delivered --> Disputed: initiate_dispute
    Disputed --> Resolved: resolve_dispute
    Completed --> [*]
    Resolved --> [*]
```

| State | Meaning | Allowed transitions |
| --- | --- | --- |
| `Created` | Trade opened, awaiting driver | `InTransit` |
| `InTransit` | Driver en route; PoD not yet submitted | `Delivered` |
| `Delivered` | PoD video pinned and attested on-chain | `Completed`, `Disputed` |
| `Disputed` | Buyer raised a dispute; awaiting mediator | `Resolved` |
| `Completed` | Buyer confirmed delivery; funds released | terminal |
| `Resolved` | Mediator settled via `seller_gets_bps` split | terminal |

### Dispute resolution states

```mermaid
stateDiagram-v2
    [*] --> Open: initiate_dispute
    Open --> UnderReview: mediator opens panel
    UnderReview --> Settled: resolve_dispute(seller_gets_bps)
    Settled --> [*]
```

- `seller_gets_bps` encodes the split: `5000` = 50/50, `7000` = 70/30.
- Resolution is terminal; the contract releases funds according to the bps split.

## Pipeline / command evidence

Run from `frontend/`:

```powershell
npx eslint "src/app/mediator/disputes/**/*.{ts,tsx}"
```

Result:

- Pass (no lint output for mediator disputes files).

```powershell
npx tsc --noEmit
```

Result:

- Fails due to pre-existing unrelated files, not mediator page changes.
- Current errors:
  - `src/app/dev-test/page.tsx` (missing `Spinner`, `LoadingState` symbols)
  - `src/components/ui/FormField.tsx` (React `cloneElement` typing mismatch)

## Screenshot checklist (attach to PR)

1. Mediator wallet connected and authorized badge visible.
2. Unauthorized wallet state showing access blocked.
3. Video panel rendering with Pinata gateway label.
4. Click `Resolve 50/50 On-Chain` and show transaction hash status text.
5. Optional: gateway fallback/switch action visible.

## Notes for reviewers

- Full repo typecheck is currently red for unrelated pre-existing issues.
- Mediator resolution path itself is wired to the correct on-chain method and argument semantics.
