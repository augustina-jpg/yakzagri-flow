"use client";
import { t as translateCopy } from "@/lib/i18n";


import React, { startTransition, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  DEFAULT_PREFERENCES,
  readPreferences,
  writePreferences,
  type AppPreferences,
} from "@/lib/preferences";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ValidationErrors {
  [key: string]: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border-default bg-card p-5 md:p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <hr className="border-border-default" />;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  // Stable IDs derived from the label text so the switch button can reference
  // its visible label and optional description via aria-labelledby /
  // aria-describedby rather than a duplicated aria-label string.
  const baseId = `toggle-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const labelId = `${baseId}-label`;
  const descriptionId = `${baseId}-description`;

  /**
   * Space is the native toggle key for role="switch" (already handled by the
   * browser for <button>). We add Enter so users who habitually press Enter to
   * activate controls also get the expected behaviour.
   */
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onChange(!checked);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p id={labelId} className="text-sm font-medium text-text-primary">
          {label}
        </p>
        {description && (
          <p id={descriptionId} className="text-xs text-text-secondary mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={() => onChange(!checked)}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
          checked ? "bg-gold" : "bg-bg-elevated"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-text-primary shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SelectField({
  label,
  description,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  const fieldId = `setting-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const descriptionId = `${fieldId}-description`;
  const errorId = `${fieldId}-error`;
  const describedBy = [description && descriptionId, error && errorId]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
      <div className="flex-1">
        <label htmlFor={fieldId} className="text-sm font-medium text-text-primary">{label}</label>
        {description && (
          <p id={descriptionId} className="text-xs text-text-secondary mt-0.5">{description}</p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-status-danger mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10a1 1 0 110 2 1 1 0 010-2zm0-7a1 1 0 011 1v4a1 1 0 11-2 0V5a1 1 0 011-1z" />
            </svg>
            {error}
          </p>
        )}
      </div>
      <select
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`rounded-lg border ${error ? "border-status-danger" : "border-border-default"} bg-bg-input text-text-primary text-sm px-3 py-2 focus:outline-none focus:border-border-focus transition-colors sm:w-44`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { locale, setLocale } = useLocale();
  const {
    address,
    isAuthenticated,
    isWalletConnected,
    isWalletDetected,
    isLoading,
    connectWallet,
    authenticate,
    logout,
  } = useAuth();

  const [notifications, setNotifications] = useState(DEFAULT_PREFERENCES.notifications);
  const [prefs, setPrefs] = useState<Pick<AppPreferences, "network" | "currency" | "autoSignOut">>(DEFAULT_PREFERENCES);

  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );

  useEffect(() => {
    const saved = readPreferences();
    startTransition(() => {
      setNotifications(saved.notifications);
      setPrefs({
        network: saved.network,
        currency: saved.currency,
        autoSignOut: saved.autoSignOut,
      });
    });
  }, []);

  function setNotif<K extends keyof AppPreferences["notifications"]>(
    key: K,
    value: AppPreferences["notifications"][K],
  ) {
    setNotifications((prev) => ({ ...prev, [key]: value }));
  }

  function setPref<K extends "network" | "currency" | "autoSignOut">(
    key: K,
    value: AppPreferences[K],
  ) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setValidationErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function validatePreferences(): boolean {
    const errors: ValidationErrors = {};

    if (!prefs.network) {
      errors.network = "Network selection is required";
    }

    if (!prefs.currency) {
      errors.currency = "Currency selection is required";
    }

    if (!prefs.autoSignOut) {
      errors.autoSignOut = "Auto sign-out preference is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCopyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSavePreferences() {
    if (!validatePreferences()) {
      return;
    }

    writePreferences({ ...prefs, notifications });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  }

  const walletStatus = isLoading
    ? "Checking…"
    : isAuthenticated
      ? "Authenticated"
      : isWalletConnected
        ? "Wallet linked — sign in to authenticate"
        : isWalletDetected
          ? "Freighter detected — permission required"
          : "Freighter not detected";

  return (
    <section className="min-h-full bg-bg-primary px-6 py-8 lg:px-10">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{translateCopy("ui.settings_c7f73bb")}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {translateCopy("ui.manage_your_wallet_notifications_3ed9a7d")}
          </p>
        </div>

        <SectionCard
          title={t("common.language")}
          description={t("common.languageDescription")}
        >
          <select
            aria-label={t("common.language")}
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            className="w-full sm:w-64 rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-border-focus"
          >
            <option value="en-NG">{t("common.englishNigeria")}</option>
            <option value="en-US">{t("common.englishUnitedStates")}</option>
            <option value="ha-NG">{t("common.hausa")}</option>
            <option value="yo-NG">{t("common.yoruba")}</option>
            <option value="ig-NG">{t("common.igbo")}</option>
            {locale === "pseudo" && <option value="pseudo">{translateCopy("ui.pseudo_testing_90b1ccd")}</option>}
          </select>
        </SectionCard>

        {/* ── Wallet & Identity ── */}
        <SectionCard
          title={translateCopy("ui.wallet_identity_4efb32d")}
          description="Your Stellar wallet is your identity on Amana."
        >
          <div className="rounded-xl border border-border-default bg-bg-elevated px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-text-muted">
                {translateCopy("ui.wallet_address_d6607aa")}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isAuthenticated
                    ? "bg-emerald-muted text-emerald"
                    : isWalletConnected
                      ? "bg-gold-muted text-gold"
                      : "bg-bg-elevated text-text-muted border border-border-default"
                }`}
              >
                {isAuthenticated
                  ? "Authenticated"
                  : isWalletConnected
                    ? "Connected"
                    : "Disconnected"}
              </span>
            </div>

            {address ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-text-primary font-mono break-all">
                  {address}
                </code>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  title={translateCopy("ui.copy_address_4eaae53")}
                  className="shrink-0 p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                  {copied ? (
                    <svg
                      className="w-4 h-4 text-emerald"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M2 8l4 4 8-8" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <rect x="5" y="5" width="9" height="9" rx="1" />
                      <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
                    </svg>
                  )}
                </button>
              </div>
            ) : (
              <p className="text-sm text-text-muted italic">{walletStatus}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {!isWalletConnected && (
              <button
                type="button"
                onClick={connectWallet}
                disabled={isLoading}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-gold-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Connecting…" : "Connect Freighter"}
              </button>
            )}
            {isWalletConnected && !isAuthenticated && (
              <button
                type="button"
                onClick={authenticate}
                disabled={isLoading}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-gold-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Signing…" : "Sign In"}
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-status-danger/40 text-status-danger px-4 py-2 text-sm font-semibold hover:bg-status-danger/10 transition-colors"
              >
                {translateCopy("ui.sign_out_61fd08f")}
              </button>
            )}
          </div>
        </SectionCard>

        {/* ── Appearance ── */}
        <SectionCard
          title={translateCopy("ui.appearance_41def7a")}
          description="Switch between light, dark, or system-preference theme."
        >
          <ThemeToggle />
          <p className="text-xs text-text-muted mt-2">
            {translateCopy("ui.your_preference_is_saved_locally_5120f9e")}
          </p>
        </SectionCard>

        {/* ── Notifications ── */}
        <SectionCard
          title={translateCopy("ui.notifications_753a22b")}
          description="Choose which events trigger in-app alerts."
        >
          <div className="space-y-4">
            <Toggle
              label="Trade updates"
              description="Status changes on your active trades."
              checked={notifications.tradeUpdates}
              onChange={(v) => setNotif("tradeUpdates", v)}
            />
            <Divider />
            <Toggle
              label="Dispute alerts"
              description="New disputes or mediator decisions."
              checked={notifications.disputeAlerts}
              onChange={(v) => setNotif("disputeAlerts", v)}
            />
            <Divider />
            <Toggle
              label="Vault activity"
              description="Deposits, releases, and lock events."
              checked={notifications.vaultActivity}
              onChange={(v) => setNotif("vaultActivity", v)}
            />
            <Divider />
            <Toggle
              label="System announcements"
              description="Platform updates and maintenance notices."
              checked={notifications.systemAnnouncements}
              onChange={(v) => setNotif("systemAnnouncements", v)}
            />
          </div>
        </SectionCard>

        {/* ── Application Preferences ── */}
        <SectionCard
          title={translateCopy("ui.application_preferences_41d8dfa")}
          description="Network, display currency, and session settings."
        >
          <div className="space-y-5">
            <SelectField
              label="Network"
              description="The Stellar network your wallet interacts with."
              value={prefs.network}
              onChange={(v) => setPref("network", v as AppPreferences["network"])}
              error={validationErrors.network}
              options={[
                { value: "mainnet", label: "Mainnet" },
                { value: "testnet", label: "Testnet" },
              ]}
            />
            <Divider />
            <SelectField
              label="Preferred currency"
              description="Fiat currency used for value estimates."
              value={prefs.currency}
              onChange={(v) => setPref("currency", v as AppPreferences["currency"])}
              options={[
                { value: "USD", label: "USD — US Dollar" },
                { value: "EUR", label: "EUR — Euro" },
                { value: "GBP", label: "GBP — British Pound" },
                { value: "NGN", label: "NGN — Nigerian Naira" },
                { value: "cNGN", label: "cNGN — CNGN stablecoin" },
              ]}
            />
            <Divider />
            <SelectField
              label="Auto sign-out"
              description="Automatically end your session after inactivity."
              value={prefs.autoSignOut}
              onChange={(v) =>
                setPref("autoSignOut", v as AppPreferences["autoSignOut"])
              }
              options={[
                { value: "15", label: "15 minutes" },
                { value: "30", label: "30 minutes" },
                { value: "60", label: "1 hour" },
                { value: "never", label: "Never" },
              ]}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSavePreferences}
              className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-text-inverse hover:bg-gold-hover transition-colors"
            >
              {translateCopy("ui.save_preferences_d8ab74e")}
            </button>
            {saveSuccess && (
              <span className="text-sm text-emerald flex items-center gap-1.5">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M2 8l4 4 8-8" />
                </svg>
                {translateCopy("ui.saved_c0ae8f6")}
              </span>
            )}
          </div>
        </SectionCard>

        {/* ── Security ── */}
        <SectionCard
          title={translateCopy("ui.security_f25ce1b")}
          description="Information about how your session and keys are protected."
        >
          <ul className="space-y-3">
            {[
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M8 1l5 2.2V7c0 3.3-2.3 5.8-5 6.8C3.3 12.8 1 10.3 1 7V3.2L8 1z" />
                  </svg>
                ),
                label: "Non-custodial",
                detail:
                  "Amana never holds your private keys. All signing happens in Freighter.",
              },
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect x="3" y="7" width="10" height="7" rx="1" />
                    <path d="M5 7V5a3 3 0 016 0v2" />
                  </svg>
                ),
                label: "Session token",
                detail: isAuthenticated
                  ? "Active — stored in sessionStorage, cleared on tab close."
                  : "No active session.",
              },
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 5v3l2 2" />
                  </svg>
                ),
                label: "Challenge-response auth",
                detail:
                  "Sign-in uses a one-time challenge signed by your wallet — no passwords.",
              },
            ].map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-3 rounded-xl border border-border-default bg-bg-elevated px-4 py-3"
              >
                <span className="mt-0.5 shrink-0 text-gold">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {item.label}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* ── About ── */}
        <SectionCard title={translateCopy("ui.about_6b21fb7")}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              { label: "Platform", value: "Amana" },
              { label: "Version", value: "V4.8.2" },
              {
                label: "Network",
                value:
                  prefs.network === "mainnet"
                    ? "Stellar Mainnet"
                    : "Stellar Testnet",
              },
              { label: "Smart contracts", value: "Soroban" },
              { label: "Storage", value: "IPFS" },
              { label: "Wallet", value: "Freighter" },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-text-muted">{row.label}</dt>
                <dd className="text-text-primary font-medium mt-0.5">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>
    </section>
  );
}
