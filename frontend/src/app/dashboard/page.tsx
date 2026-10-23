"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/i18n";
import { api, ApiError, TradeResponse, TradeStatsResponse } from "@/lib/api";
import { BentoCard } from "@/components/ui/BentoCard";
import { Activity, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatNumber } from "@/lib/i18n/format";

export default function DashboardPage() {
  const {
    token,
    isAuthenticated,
    isWalletConnected,
    isLoading: authLoading,
    connectWallet,
    authenticate,
  } = useAuth();
  
  const [stats, setStats] = useState<TradeStatsResponse | null>(null);
  const [completedTrades, setCompletedTrades] = useState(0);
  const [recentTrades, setRecentTrades] = useState<TradeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!isAuthenticated || !token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [statsData, tradesData] = await Promise.all([
          api.trades.getStats(token),
          api.trades.list(token, { page: 1, limit: 100 }),
        ]);

        setStats(statsData);
        setRecentTrades(tradesData.items.slice(0, 5));

        const allTrades = [...tradesData.items];
        for (let page = 2; page <= tradesData.pagination.totalPages; page += 1) {
          const pageData = await api.trades.list(token, { page, limit: 100 });
          allTrades.push(...pageData.items);
        }
        setCompletedTrades(
          allTrades.filter((trade) => {
            const status = trade.status.toUpperCase();
            return status === "SETTLED" || status === "COMPLETED";
          }).length,
        );
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load dashboard data");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [isAuthenticated, token]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-gold" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary">{translateCopy("ui.connect_wallet_234d7c8")}</h2>
        <p className="text-text-secondary max-w-md">
          {translateCopy("ui.please_connect_your_wallet_to_ac_5e32708")}
        </p>
        <button
          onClick={() => (isWalletConnected ? authenticate() : connectWallet())}
          disabled={authLoading}
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {authLoading ? "Connecting..." : isWalletConnected ? "Sign In" : "Connect Freighter"}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-3">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>

        <div className="rounded-xl border border-border-default bg-bg-card p-5 space-y-4">
          <div className="flex justify-between items-end">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-14" />
          </div>
          <SkeletonList rows={4} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-status-danger/10 border border-status-danger/40 rounded-lg p-4 text-center">
          <p className="text-status-danger">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 text-sm font-medium bg-bg-elevated hover:bg-bg-card rounded-md border border-border-default transition-colors"
          >
            {translateCopy("ui.try_again_cef2fe0")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">{translateCopy("ui.dashboard_d87f47b")}</h1>
          <p className="text-text-secondary mt-1">{translateCopy("ui.overview_of_your_agricultural_tr_d2a1d58")}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/trades/create"
            className="px-5 py-2.5 bg-gold text-text-inverse font-semibold rounded-lg hover:bg-gold-hover transition-colors shadow-glow-gold"
          >
            {translateCopy("ui.create_trade_2747e94")}
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <BentoCard 
          title={translateCopy("ui.total_volume_eb89096")}
          icon={<CreditCard className="w-5 h-5" />}
          glowVariant="gold"
        >
          <div className="text-3xl font-bold text-text-primary mt-2">
            {stats?.totalVolume ? `${formatNumber(stats.totalVolume)} USDC` : "0 USDC"}
          </div>
          <div className="text-sm text-text-secondary mt-1">
            {translateCopy("ui.total_historical_trade_volume_aa4655d")}
          </div>
        </BentoCard>

        <BentoCard 
          title={translateCopy("ui.active_trades_ee8d911")}
          icon={<Activity className="w-5 h-5" />}
          glowVariant="emerald"
        >
          <div className="text-3xl font-bold text-text-primary mt-2">
            {stats?.openTrades || 0}
          </div>
          <div className="text-sm text-status-success mt-1">
            {translateCopy("ui.currently_in_progress_91d2aec")}
          </div>
        </BentoCard>

        <BentoCard 
          title={translateCopy("ui.completed_trades_cfc3825")}
          icon={<CheckCircle2 className="w-5 h-5" />}
        >
          <div className="text-3xl font-bold text-text-primary mt-2">
            {completedTrades}
          </div>
          <div className="text-sm text-text-secondary mt-1">
            {translateCopy("ui.successfully_settled_2cb5457")}
          </div>
        </BentoCard>

        <BentoCard 
          title={translateCopy("ui.total_trades_002b416")}
          icon={<AlertCircle className="w-5 h-5" />}
        >
          <div className="text-3xl font-bold text-text-primary mt-2">
            {stats?.totalTrades || 0}
          </div>
          <div className="text-sm text-text-secondary mt-1">
            {translateCopy("ui.lifetime_trades_created_cd4e5e1")}
          </div>
        </BentoCard>
      </div>

      {/* Recent Activity Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-semibold text-text-primary">{translateCopy("ui.recent_trades_28436af")}</h2>
          <Link href="/trades" className="text-sm text-gold hover:underline underline-offset-4">
            {translateCopy("ui.view_all_efd8355")}
          </Link>
        </div>
        
        {recentTrades.length === 0 ? (
          <div className="bg-bg-card border border-border-default rounded-xl p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center mb-3">
              <Activity className="w-6 h-6 text-text-muted" />
            </div>
            <p className="text-text-primary font-medium">{translateCopy("ui.no_recent_trades_found_3a3f178")}</p>
            <p className="text-text-secondary text-sm mt-1 max-w-sm mb-4">
              {translateCopy("ui.you_haven_t_initiated_or_receive_e915857")}
            </p>
            <Link
              href="/trades/create"
              className="px-4 py-2 bg-bg-elevated border border-border-default text-text-primary text-sm font-medium rounded-lg hover:bg-bg-input transition-colors"
            >
              {translateCopy("ui.start_trading_e00d57a")}
            </Link>
          </div>
        ) : (
          <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-text-muted uppercase bg-bg-elevated/50 border-b border-border-default">
                  <tr>
                    <th scope="col" className="px-6 py-4 font-medium">{translateCopy("ui.trade_id_153d513")}</th>
                    <th scope="col" className="px-6 py-4 font-medium">{translateCopy("ui.counterparty_97b2be4")}</th>
                    <th scope="col" className="px-6 py-4 font-medium">{translateCopy("ui.amount_43dc853")}</th>
                    <th scope="col" className="px-6 py-4 font-medium">{translateCopy("ui.status_bae7d5b")}</th>
                    <th scope="col" className="px-6 py-4 font-medium">{translateCopy("ui.date_eb9a4bc")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade, idx) => (
                    <tr 
                      key={trade.tradeId} 
                      className={`
                        border-b border-border-default hover:bg-bg-elevated/40 transition-colors
                        ${idx === recentTrades.length - 1 ? 'border-b-0' : ''}
                      `}
                    >
                      <td className="px-6 py-4 font-mono text-gold">
                        <Link href={`/trades/${trade.tradeId}`} className="hover:underline">
                          {trade.tradeId.substring(0, 8)}...
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-text-secondary font-mono">
                        {trade.sellerAddress.substring(0, 6)}...{trade.sellerAddress.substring(trade.sellerAddress.length - 4)}
                      </td>
                      <td className="px-6 py-4 text-text-primary font-medium">
                        {formatNumber(parseFloat(trade.amountCngn || "0"), {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}{" "}
                        cNGN
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize
                          ${trade.status === 'active' ? 'bg-status-success/20 text-status-success border border-status-success/30' : 
                            trade.status === 'completed' ? 'bg-bg-elevated text-text-secondary border border-border-default' :
                            trade.status === 'pending' ? 'bg-status-warning/20 text-status-warning border border-status-warning/30' :
                            'bg-status-danger/20 text-status-danger border border-status-danger/30'
                          }
                        `}>
                          {trade.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {formatDate(trade.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
