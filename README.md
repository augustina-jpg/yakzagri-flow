# 🌾 yakzagri-flow Frontend: Trust as a Service for Agricultural Products

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**yakzagri-flow (EziAgric)** is a decentralized escrow protocol designed to secure agricultural trade across different regions. By leveraging **Soroban Smart Contracts** on the **Stellar network**, EziAgric eliminates the "Trust Gap" between buyers and sellers, ensuring fair trade even when parties are hundreds of miles apart.

**This repository contains the frontend web application only.** The backend API, Soroban smart contracts, mobile app, infrastructure, and operational tooling live in the separate [yakzagri-flow backend](https://github.com/yakzagri-flow/yakzagri-flow) repository.

---

## 🚀 The Mission

To provide a programmable safety net for regional commodity trading. EziAgric ensures that the risk of "sending first" is eliminated, replaced by a secure, neutral vault that only releases funds when delivery is verified.

## 🛠 Features

- **Smart Escrow UI:** Build, fund, and track trades backed by secure fund holding using cNGN/stablecoins on the Stellar network.
- **Dynamic Loss Sharing:** Negotiable risk-sharing ratios (e.g., 50/50, 70/30) hardcoded into every trade to handle transit accidents or theft.
- **Proof-of-Delivery (PoD):** An optional video-based verification protocol involving the buyer and the driver to confirm the state of goods. Video evidence can be submitted and stored on IPFS for dispute resolution.
- **Volatility Protection:** Utilizes Stellar Path Payments to allow users to pay in local currency (NGN) while locking value in cNGN.
- **Wallet Integration:** Freighter wallet connection with a wallet state machine and offline-first support.
- **Admin & Mediator Dashboards:** Admin feature gates, dispute-resolution workflows, and treasury/streams/asset views.

## 🏗 Technical Stack

- **Framework:** [Next.js](https://nextjs.org/) 16 (App Router, React 19, Turbopack)
- **Styling:** Tailwind CSS 4 with design-token-driven theme
- **State:** Zustand (wallet, trades, UI, notifications, offline queue)
- **Blockchain:** [Stellar](https://www.stellar.org/) via `@stellar/stellar-sdk` + Freighter
- **API:** Typed Zod-validated clients against the backend API (`/api/v1`)
- **Storage:** IPFS (via Pinata) + Supabase for off-chain metadata
- **Testing:** Jest + Testing Library (unit), Playwright (e2e + visual), Pact (API contract)
- **Observability:** OpenTelemetry traced fetch + CSP via middleware

## 🧪 Local Development

### Setup

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

### Common scripts (run inside `frontend/`)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start the production server |
| `pnpm lint` | ESLint |
| `pnpm test` | Jest unit + component tests |
| `pnpm exec playwright test` | Playwright e2e + visual tests |

### Backend API

The frontend talks to the backend API (default `http://localhost:4000`, prefix `/api/v1`).
Set `NEXT_PUBLIC_API_URL` in `.env.local` to point at a running backend instance.
See [`docs/api/`](./docs/api/) for the API contract documentation.

## 🔒 Required PR CI Gates

CI is defined in `.github/workflows/ci.yml` and is frontend-scoped only:

- **Frontend Required Gate**: `pnpm install`, `pnpm lint`, `tsc --noEmit`, `pnpm build`, `pnpm test` in `frontend/`
- **Visual Regression Gate**: Playwright snapshot tests (Chromium desktop + mobile)
- **Security Audit**: blocking `pnpm audit` gate with expiring waivers (`.github/audit-waivers.json`)

## 🔄 How It Works (The EziAgric Flow)

1. **Initiate:** The Seller lists products. The Buyer initiates a trade, depositing funds that are converted to cNGN via a Stellar Path Payment.
2. **Lock:** The Smart Contract locks the funds and stores the agreed-upon `Loss_Ratio`.
3. **Dispatch:** The Seller provides the driver's name, phone number, and vehicle manifest.
4. **Verification:** - **Success:** Buyer receives goods and uploads a confirmation video. Funds release to Seller.
   - **Dispute:** Buyer uploads a video of loss/damage with driver affirmation. A mediator reviews the evidence.
5. **Settlement:** Based on the outcome, funds are distributed (either 100% to one party or split via the `Loss_Ratio`).

## 📐 Frontend Documentation

- [`frontend/docs/`](./frontend/docs/) — accessibility, i18n, offline resilience, wallet states, admin route guard
- [`docs/api/`](./docs/api/) — backend API contract the frontend consumes
- [`docs/shared-schemas.md`](./docs/shared-schemas.md) — shared domain-schema parity strategy

## 🤝 Contributing

yakzagri-flow is an open-source project aimed at improving food security and trade efficiency. We welcome developers, designers, and agricultural experts!

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/NewFeature`).
3. Commit your Changes (`git commit -m 'Add NewFeature'`).
4. Push to the Branch (`git push origin feature/NewFeature`).
5. Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## Handsoff notes

<!-- handsoff-issue-95 -->
- #95: [docs] Fix README duplicated CI section and stray text

<!-- handsoff-issue-273 -->
- #273: [testing] Add unit tests for lib/api/trades.ts, streams.ts, wallet.ts, and reputation.ts clients
