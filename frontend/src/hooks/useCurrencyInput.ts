"use client";

import { useState, useCallback } from "react";
import {
  validateAmountFormat,
  validateAmountRange,
  amountToStroops,
  type AssetInfo,
} from "@/lib/stellar/assets";

interface UseCurrencyInputOptions {
  asset: AssetInfo;
  min?: string; // in stroops
  max?: string; // in stroops
  onValidChange?: (stroops: string) => void;
}

interface UseCurrencyInputResult {
  value: string;
  stroops: string | null;
  error: string | null;
  isValid: boolean;
  setValue: (value: string) => void;
  clear: () => void;
}

/**
 * Sanitizes a raw currency input string (e.g. from paste or mobile keyboards).
 *
 * - Strips currency symbols and any non-numeric characters (except `.` and `-`)
 * - Removes thousand separators (commas, spaces, underscores, apostrophes)
 * - Keeps only the first decimal point; subsequent ones are ignored
 * - Truncates fractional digits to the asset's configured decimals
 *
 * Examples (decimals = 2):
 *   "₦1,250,500.75" -> "1250500.75"
 *   "12.34.56"      -> "12.34"
 *   "1 250,5"       -> "1250.5"
 */
export function sanitizeCurrencyInput(raw: string, decimals: number): string {
  if (!raw) return "";

  // Remove thousand separators and whitespace first.
  let cleaned = raw.replace(/[\s,_'’]/g, "");

  // Strip everything that is not a digit, a decimal point or a leading minus.
  cleaned = cleaned.replace(/[^0-9.\-]/g, "");

  // Preserve a leading minus sign only; drop any other minus occurrences.
  const isNegative = cleaned.startsWith("-");
  cleaned = cleaned.replace(/-/g, "");

  // Keep only the first decimal point.
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    const intPart = cleaned.slice(0, firstDot);
    const fracPart = cleaned.slice(firstDot + 1).replace(/\./g, "");
    cleaned = `${intPart}.${fracPart}`;
  }

  // Clamp fractional digits to the asset's configured decimals.
  const safeDecimals = Math.max(0, Math.floor(decimals));
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1) {
    const intPart = cleaned.slice(0, dotIndex);
    const fracPart = cleaned.slice(dotIndex + 1, dotIndex + 1 + safeDecimals);
    cleaned = safeDecimals > 0 ? `${intPart}.${fracPart}` : intPart;
  }

  return isNegative && cleaned !== "" ? `-${cleaned}` : cleaned;
}

/**
 * Hook for managing currency input with validation
 */
export function useCurrencyInput({
  asset,
  min,
  max,
  onValidChange,
}: UseCurrencyInputOptions): UseCurrencyInputResult {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stroops, setStroops] = useState<string | null>(null);

  const handleChange = useCallback(
    (rawValue: string) => {
      const newValue = sanitizeCurrencyInput(rawValue, asset.decimals);

      setValue(newValue);
      setError(null);
      setStroops(null);

      if (!newValue.trim()) {
        return;
      }

      // Validate format
      const formatValidation = validateAmountFormat(newValue, asset.decimals);
      if (!formatValidation.valid) {
        setError(formatValidation.error || "Invalid format");
        return;
      }

      // Convert to stroops
      try {
        const stroopsValue = amountToStroops(newValue, asset.decimals);
        
        // Validate range if provided
        if (min || max) {
          const rangeValidation = validateAmountRange(
            stroopsValue,
            min || "0",
            max || stroopsValue
          );
          
          if (!rangeValidation.valid) {
            setError(rangeValidation.error || "Amount out of range");
            return;
          }
        }

        setStroops(stroopsValue);
        onValidChange?.(stroopsValue);
      } catch {
        setError("Invalid amount");
      }
    },
    [asset.decimals, min, max, onValidChange]
  );

  const clear = useCallback(() => {
    setValue("");
    setError(null);
    setStroops(null);
  }, []);

  return {
    value,
    stroops,
    error,
    isValid: stroops !== null && error === null,
    setValue: handleChange,
    clear,
  };
}
