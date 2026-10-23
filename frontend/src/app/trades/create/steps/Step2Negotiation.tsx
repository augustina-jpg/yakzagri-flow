"use client";
import { t as translateCopy } from "@/lib/i18n";

import { useState } from "react";
import { useTrade } from "../TradeContext";
import { validateStep2 } from "../validation";
import { formatNumber } from "@/lib/i18n/format";

export default function Step2Negotiation() {
  const { data, update, setStep } = useTrade();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBuyerRatio = (val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    update({ buyerRatio: clamped, sellerRatio: 100 - clamped });
    setErrors((prev) => ({ ...prev, sum: "", buyerRatio: "", sellerRatio: "" }));
  };

  const totalValue =
    data.quantity && data.pricePerUnit
      ? parseFloat(data.quantity) * parseFloat(data.pricePerUnit)
      : 0;

  const buyerLoss = totalValue ? formatNumber((data.buyerRatio / 100) * totalValue) : "—";
  const sellerLoss = totalValue ? formatNumber((data.sellerRatio / 100) * totalValue) : "—";

  const buyerRefund = totalValue ? (data.buyerRatio / 100) * totalValue : 0;
  const sellerPayout = totalValue ? (data.sellerRatio / 100) * totalValue : 0;

  const presetRatios = [50, 70, 80, 100];
=======

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validateStep2({
      buyerRatio: data.buyerRatio,
      sellerRatio: data.sellerRatio,
      deliveryDays: data.deliveryDays,
    });
    setErrors((prev) => ({
      ...prev,
      [field]: errs[field] || "",
    }));
  };

  const handleReview = () => {
    const allTouched: Record<string, boolean> = {};
    for (const key of ["buyerRatio", "sellerRatio", "deliveryDays"]) {
      allTouched[key] = true;
    }
    setTouched(allTouched);
    const errs = validateStep2({
      buyerRatio: data.buyerRatio,
      sellerRatio: data.sellerRatio,
      deliveryDays: data.deliveryDays,
    });
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      setStep(3);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Loss ratio */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{translateCopy("ui.loss_ratio_buyer_seller_2845a0d")}</span>
          <span className="text-gold font-semibold text-sm">
            {data.buyerRatio}% / {data.sellerRatio}%
          </span>
        </div>

        <label htmlFor="buyerRatio" className="sr-only">{translateCopy("ui.buyer_loss_ratio_percentage_aa74e46")}</label>
        <input
          id="buyerRatio"
          type="range"
          min={0}
          max={100}
          step={5}
          value={data.buyerRatio}
          aria-label={translateCopy("ui.buyer_loss_ratio_a0e1590")}
          aria-valuetext={`Buyer absorbs ${data.buyerRatio} percent, Seller absorbs ${data.sellerRatio} percent`}
          onChange={(e) => handleBuyerRatio(parseInt(e.target.value))}
          className="w-full accent-gold"
        />

        <div className="flex flex-wrap gap-2" role="group" aria-label="Preset loss ratios">
          {presetRatios.map((ratio) => {
            const active = data.buyerRatio === ratio;
            return (
              <button
                key={ratio}
                type="button"
                onClick={() => handleBuyerRatio(ratio)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? "bg-gold text-text-inverse border-gold"
                    : "bg-bg-elevated text-text-secondary border-border-default hover:border-border-hover"
                }`}
              >
                {ratio}/{100 - ratio}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-bg-elevated border border-border-default px-4 py-3">
            <p className="text-xs text-text-muted mb-1">{translateCopy("ui.buyer_absorbs_319cfa2")}</p>
            <p className="text-text-primary font-semibold">{data.buyerRatio}%</p>
            {totalValue > 0 && (
              <p className="text-xs text-text-secondary mt-1">{data.currency} {buyerLoss}</p>
            )}
          </div>
          <div className="rounded-lg bg-bg-elevated border border-border-default px-4 py-3">
            <p className="text-xs text-text-muted mb-1">{translateCopy("ui.seller_absorbs_6dd1cf2")}</p>
            <p className="text-text-primary font-semibold">{data.sellerRatio}%</p>
            {totalValue > 0 && (
              <p className="text-xs text-text-secondary mt-1">{data.currency} {sellerLoss}</p>
            )}
          </div>
        </div>
        {errors.sum && touched.buyerRatio && <p role="alert" aria-live="polite" className="text-status-danger text-xs text-center">{errors.sum}</p>}

        {/* Live payout breakdown */}
        <div className="rounded-lg bg-bg-elevated border border-border-default px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Loss payout preview</span>
            <span className="text-xs text-text-secondary">
              Trade amount: {totalValue > 0 ? `${data.currency} ${formatNumber(totalValue)}` : "—"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-text-muted mb-1">Buyer refund</p>
              <p className="text-text-primary font-semibold text-sm">
                {totalValue > 0 ? `${formatNumber(buyerRefund)} cNGN` : "—"}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {totalValue > 0 ? `≈ ₦${formatNumber(buyerRefund)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Seller payout</p>
              <p className="text-text-primary font-semibold text-sm">
                {totalValue > 0 ? `${formatNumber(sellerPayout)} cNGN` : "—"}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {totalValue > 0 ? `≈ ₦${formatNumber(sellerPayout)}` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery window */}
      <div className="flex flex-col gap-1">
        <label htmlFor="deliveryDays" className="text-sm text-text-secondary">{translateCopy("ui.delivery_window_days_afe0adf")}</label>
        <input
          id="deliveryDays"
          type="number"
          min="1"
          max="90"
          value={data.deliveryDays}
          onChange={(e) => {
            const raw = parseInt(e.target.value);
            const clamped = isNaN(raw) ? 1 : Math.min(90, Math.max(1, raw));
            update({ deliveryDays: String(clamped) });
            setErrors((prev) => ({ ...prev, deliveryDays: "" }));
          }}
          onBlur={() => handleBlur("deliveryDays")}
          className="bg-bg-input border border-border-default rounded-md px-4 py-3 text-text-primary focus:outline-none focus:border-border-focus"
        />
        {errors.deliveryDays && touched.deliveryDays && <p role="alert" aria-live="polite" className="text-status-danger text-xs mt-1">{errors.deliveryDays}</p>}
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label htmlFor="tradeNotes" className="text-sm text-text-secondary">{translateCopy("ui.additional_terms_notes_9a27e30")}</label>
        <textarea
          id="tradeNotes"
          rows={3}
          placeholder={translateCopy("ui.e_g_goods_must_be_bagged_and_sea_f879108")}
          value={data.notes}
          onChange={(e) => update({ notes: e.target.value })}
          className="bg-bg-input border border-border-default rounded-md px-4 py-3 text-text-primary text-sm resize-none focus:outline-none focus:border-border-focus"
        />
      </div>

      {/* Info callout */}
      <div className="rounded-lg bg-emerald-muted border border-emerald/20 px-4 py-3 text-sm text-emerald">
        {translateCopy("ui.funds_will_be_locked_as_cngn_via_270528e")}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(1)}
          className="flex-1 h-12 rounded-full border border-border-default text-text-secondary hover:border-border-hover transition-colors"
        >
          {translateCopy("common.back")}
        </button>
        <button
          onClick={handleReview}
          className="flex-1 h-12 rounded-full bg-gradient-gold-cta text-text-inverse font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {translateCopy("ui.review_trade_56119c6")}
        </button>
      </div>
    </div>
  );
}
