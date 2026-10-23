
import { t as translateCopy } from "@/lib/i18n";
import {
  ArrowRight,
  CircleDollarSign,
  Scale,
  ShieldCheck,
  Truck,
  Lock,
  CheckCircle2,
  Star,
} from "lucide-react";
import Link from "next/link";
import { LandingCtaButtons } from "@/components/landing/LandingCtaButtons";

const stats = [
  { label: "Settlement", value: "On-chain" },
  { label: "Platform fee", value: "1%" },
  { label: "Supported assets", value: "cNGN · USDC" },
  { label: "Wallet custody", value: "Non-custodial" },
];

const steps = [
  {
    step: "01",
    title: "Agree on the trade",
    description: "Set the commodity, price, delivery window, and loss-sharing terms.",
    icon: Scale,
  },
  {
    step: "02",
    title: "Lock funds in escrow",
    description: "The buyer funds the Stellar escrow after both parties approve the terms.",
    icon: Lock,
  },
  {
    step: "03",
    title: "Confirm delivery",
    description: "Share delivery evidence, then release funds when the trade is complete.",
    icon: CheckCircle2,
  },
];

const features = [
  {
    title: "Protected settlement",
    description: "Funds remain in smart-contract escrow until delivery is confirmed.",
    icon: ShieldCheck,
  },
  {
    title: "Clear loss sharing",
    description: "Buyers and sellers agree how transit losses are handled before funding.",
    icon: Scale,
  },
  {
    title: "Delivery evidence",
    description: "Attach proof of delivery to the trade for an auditable record.",
    icon: Truck,
  },
  {
    title: "Reputation history",
    description: "Completed trades build a visible record of reliable participation.",
    icon: Star,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-hero px-6 py-20 md:py-32 lg:px-10">
        {/* Subtle radial glow behind the headline */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-120 w-120 rounded-full bg-gold opacity-[0.04] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Eyebrow */}
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-muted px-4 py-1.5 text-sm font-medium text-gold">
            {translateCopy("ui.built_on_stellar_soroban_smart_c_299dafe")}
          </span>

          {/* Headline */}
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-text-primary md:text-5xl">
            {translateCopy("ui.agricultural_trade_you_can_597c837")}{" "}
            <span className="bg-gradient-gold-cta bg-clip-text text-transparent">
              {translateCopy("ui.trust_fcbc333")}
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary">
            {translateCopy("ui.amana_is_a_blockchain_powered_es_1313368")}
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/trades"
              className="rounded-lg bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800"
            >
              {translateCopy("ui.start_a_trade_3bd0ed4")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-border-default px-6 py-3 text-base font-semibold text-text-primary transition-colors hover:border-border-hover hover:bg-bg-card focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
            >
              {translateCopy("ui.open_dashboard_7ad1cae")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section
        aria-label={translateCopy("ui.platform_statistics_5260f1a")}
        className="border-y border-border-default bg-bg-card px-6 py-8 lg:px-10"
      >
        <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <dt className="text-sm text-text-muted">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-bold text-text-primary">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            {translateCopy("ui.how_it_works_1dd6a17")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-text-secondary">
            {translateCopy("ui.three_steps_from_agreement_to_se_599643b")}
          </p>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative rounded-xl border border-border-default bg-bg-card p-6 shadow-elev-1"
                >
                  {/* Step number */}
                  <span className="text-xs font-bold tracking-widest text-text-muted">
                    {item.step}
                  </span>
                  {/* Icon */}
                  <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gold-muted">
                    <Icon className="h-5 w-5 text-gold" />
                  </div>
                  {/* Content */}
                  <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="bg-bg-card px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            {translateCopy("ui.why_amana_17f89a9")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-text-secondary">
            {translateCopy("ui.purpose_built_for_agricultural_s_c37cbf5")}
          </p>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-xl border border-border-default bg-bg-primary p-6 shadow-elev-1"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-muted">
                    <Icon className="h-5 w-5 text-gold" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gold/20 bg-gradient-hero p-10 text-center shadow-elev-1">
          <h2 className="text-2xl font-bold md:text-3xl">
            {translateCopy("ui.ready_to_settle_your_first_trade_a627297")}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-text-secondary">
            {translateCopy("ui.connect_your_freighter_wallet_an_d3b64b6")}
          </p>
          <div className="mt-8 flex justify-center">
            <LandingCtaButtons />
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border-default px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-sm text-text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} {translateCopy("ui.amana_agricultural_escrow_on_ste_5f6d434")}</span>
          <nav aria-label={translateCopy("ui.footer_navigation_a32d98c")} className="flex gap-6">
            <Link href="/trades" className="hover:text-text-secondary transition-colors">
              {translateCopy("ui.trades_597b109")}
            </Link>
            <Link href="/vault" className="hover:text-text-secondary transition-colors">
              {translateCopy("ui.vault_fb46e37")}
            </Link>
            <Link href="/dashboard" className="hover:text-text-secondary transition-colors">
              {translateCopy("ui.dashboard_d87f47b")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
