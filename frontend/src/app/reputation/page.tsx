"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError, type ReputationResponse } from "@/lib/api";
import { RepScoreRing } from "@/components/ui/RepScoreRing";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { AlertCircle, RefreshCw, TrendingUp, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { formatDate as formatLocalizedDate } from "@/lib/i18n";

function SkeletonReputationPage() {
  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-bg-elevated rounded-lg border border-border-default p-8 flex flex-col items-center gap-4">
          <Skeleton className="h-32 w-32 rounded-full" />
          <Skeleton className="h-5 w-16" />
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-elevated rounded-lg border border-border-default p-6 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-bg-elevated rounded-lg border border-border-default">
        <div className="p-6 border-b border-border-default space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return formatLocalizedDate(iso);
  } catch {
    return iso;
  }
}

function getImpactColor(impact: number): string {
  if (impact > 0) return "text-status-success";
  if (impact < 0) return "text-status-danger";
  return "text-text-secondary";
}

function getImpactLabel(impact: number): string {
  if (impact > 0) return `+${impact}`;
  return `${impact}`;
}

function getEventIcon(type: string) {
  switch (type) {
    case "trade_completed":
      return <CheckCircle2 className="w-4 h-4 text-status-success" />;
    case "trade_initiated":
      return <Clock className="w-4 h-4 text-status-info" />;
    case "dispute_initiated":
      return <AlertTriangle className="w-4 h-4 text-status-warning" />;
    case "dispute_resolved":
      return <AlertCircle className="w-4 h-4 text-status-danger" />;
    default:
      return <TrendingUp className="w-4 h-4 text-text-secondary" />;
  }
}

export default function ReputationPage() {
  const {
    token,
    isAuthenticated,
    isWalletConnected,
    isLoading: authLoading,
    connectWallet,
    authenticate,
  } = useAuth();

  const [data, setData] = useState<ReputationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendWindow, setTrendWindow] = useState<"all" | "7d" | "30d" | "90d">("all");

  const fetchReputation = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const reputation = await api.reputation.getMyReputation(token);
      setData(reputation);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load reputation data");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchReputation();
    }
  }, [isAuthenticated, token, fetchReputation]);

  const isPageLoading = authLoading || (isAuthenticated && loading);

  if (!isAuthenticated && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-gold" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary">{translateCopy("ui.connect_wallet_234d7c8")}</h2>
        <p className="text-text-secondary max-w-md">
          {translateCopy("ui.please_connect_your_wallet_to_vi_a4f8c6d")}
        </p>
        <Button
          variant="primary"
          onClick={() => (isWalletConnected ? authenticate() : connectWallet())}
          disabled={authLoading}
        >
          {authLoading ? "Connecting..." : isWalletConnected ? "Sign In" : "Connect Freighter"}
        </Button>
      </div>
    );
  }

  if (isPageLoading) {
    return <SkeletonReputationPage />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-status-danger" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">{translateCopy("ui.failed_to_load_reputation_940a7ad")}</h2>
        <p className="text-text-secondary max-w-md">{error}</p>
        <Button variant="primary" onClick={fetchReputation}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {translateCopy("ui.try_again_cef2fe0")}
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-text-secondary" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary">{translateCopy("ui.no_reputation_data_8b0fe48")}</h2>
        <p className="text-text-secondary max-w-md">
          {translateCopy("ui.your_reputation_will_be_calculat_af47dce")}
        </p>
      </div>
    );
  }

  const ringScore = (data.trustScore / 100) * 5;

  const scoreFactors = [
    {
      label: "Settlement Reliability",
      weight: "50%",
      score: Math.min(100, Math.round(data.successRate)),
    },
    {
      label: "Dispute Resolution Ratio",
      weight: "30%",
      score:
        data.totalTrades > 0
          ? Math.max(0, Math.round(((data.totalTrades - data.disputedTrades) / data.totalTrades) * 100))
          : 100,
    },
    {
      label: "Completion Volume",
      weight: "20%",
      score: Math.min(100, data.completedTrades * 10),
    },
  ];

  const filteredHistory = data.history.filter((item) => {
    if (trendWindow === "all") return true;
    const days = trendWindow === "7d" ? 7 : trendWindow === "30d" ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const ts = Date.parse(item.timestamp);
    return Number.isFinite(ts) ? ts >= cutoff : true;
  });

  const metrics = [
    {
      title: "Total Trades",
      value: data.totalTrades.toString(),
      icon: <TrendingUp className="w-5 h-5 text-gold" />,
    },
    {
      title: "Completed",
      value: data.completedTrades.toString(),
      icon: <CheckCircle2 className="w-5 h-5 text-status-success" />,
    },
    {
      title: "Disputed",
      value: data.disputedTrades.toString(),
      icon: <AlertTriangle className="w-5 h-5 text-status-warning" />,
    },
    {
      title: "Success Rate",
      value: `${data.successRate}%`,
      icon: <TrendingUp className="w-5 h-5 text-status-info" />,
    },
  ];

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{translateCopy("ui.reputation_5f21606")}</h1>
        <p className="text-text-secondary">
          {translateCopy("ui.your_trading_reputation_and_trus_302c8e8")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-bg-elevated rounded-lg border border-border-default p-8 flex flex-col items-center gap-3">
          <RepScoreRing score={ringScore} size="xl" animated />
          <p className="text-sm text-text-secondary mt-2">{translateCopy("ui.trust_score_2c7902e")}</p>
          <p className="text-3xl font-bold text-text-primary">{data.trustScore}</p>
          <p className="text-xs text-text-muted">{translateCopy("ui.out_of_100_da0953a")}</p>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.title}
              className="bg-bg-elevated rounded-lg border border-border-default p-6"
            >
              <div className="flex items-center gap-2 mb-3">
                {metric.icon}
                <h2 className="text-sm font-medium text-text-secondary">{metric.title}</h2>
              </div>
              <p className="text-2xl font-bold text-text-primary">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Score Breakdown Factors */}
      <div
        className="bg-bg-elevated rounded-lg border border-border-default p-6 mb-8"
        data-testid="reputation-score-factors"
      >
        <h2 className="text-lg font-semibold text-text-primary mb-4">Score Breakdown Factors</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {scoreFactors.map((factor) => (
            <div
              key={factor.label}
              className="rounded-lg border border-border-default bg-surface-1 p-4 space-y-2"
            >
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>{factor.label}</span>
                <span className="font-mono text-text-muted">Weight: {factor.weight}</span>
              </div>
              <div className="text-lg font-bold text-text-primary">{factor.score}%</div>
              <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full bg-gold transition-all"
                  style={{ width: `${factor.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-bg-elevated rounded-lg border border-border-default">
        <div className="p-6 border-b border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{translateCopy("ui.trust_history_4968d5f")}</h2>
            <p className="text-sm text-text-secondary mt-1">
              {translateCopy("ui.recent_events_that_impacted_your_52215a2")}
            </p>
          </div>
          <div
            className="flex items-center gap-1.5"
            role="group"
            aria-label="Historical trend filter"
            data-testid="reputation-trend-filter"
          >
            {(["all", "7d", "30d", "90d"] as const).map((windowKey) => (
              <button
                key={windowKey}
                type="button"
                aria-pressed={trendWindow === windowKey}
                onClick={() => setTrendWindow(windowKey)}
                className={`px-3 py-1 rounded-md text-xs font-semibold uppercase transition-colors ${
                  trendWindow === windowKey
                    ? "bg-gold text-text-inverse"
                    : "bg-surface-2 text-text-secondary hover:text-text-primary"
                }`}
              >
                {windowKey === "all" ? "All Time" : windowKey}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <Clock className="w-12 h-12 text-text-muted" />
              <p className="text-text-secondary">
                {translateCopy("ui.no_reputation_events_yet_complet_145eec9")}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 border-b border-border-default last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {getEventIcon(item.type)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">{item.event}</div>
                      <div className="text-xs text-text-secondary">{formatDate(item.timestamp)}</div>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${getImpactColor(item.impact)}`}>
                    {getImpactLabel(item.impact)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
