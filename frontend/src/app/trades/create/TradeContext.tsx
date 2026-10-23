"use client";
import { createContext, useContext, useState, useEffect, useRef } from "react";

export type TradeData = {
  // Step 1
  commodity: string;
  quantity: string;
  unit: string;
  pricePerUnit: string;
  currency: string;
  sellerAddress: string;
  deliveryWindow: string;
  // Step 2
  buyerRatio: number;
  sellerRatio: number;
  deliveryDays: string;
  notes: string;
};

type TradeContextType = {
  step: number;
  setStep: (s: number) => void;
  data: TradeData;
  update: (partial: Partial<TradeData>) => void;
  resetTradeWizard: () => void;
};

const defaults: TradeData = {
  commodity: "",
  quantity: "",
  unit: "kg",
  pricePerUnit: "",
  currency: "NGN",
  sellerAddress: "",
  deliveryWindow: "",
  buyerRatio: 50,
  sellerRatio: 50,
  deliveryDays: "7",
  notes: "",
};

const TradeContext = createContext<TradeContextType>({} as TradeContextType);

const STORAGE_KEY = "amana:draft-trade";

export function TradeProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: Partial<TradeData>;
}) {
  const [step, setStep] = useState(1);
  const [resetVersion, setResetVersion] = useState(0);
  const persistedResetVersion = useRef(0);
  const [data, setData] = useState<TradeData>(() => {
    let base: TradeData = defaults;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          base = { ...defaults, ...parsed.data } as TradeData;
        }
      } catch {}
    }
    // Deep-linked initial data takes precedence on first mount
    return initialData ? { ...base, ...initialData } : base;
  });

  // Persist draft locally — survives refresh/restart, replays via offline queue
  useEffect(() => {
    if (persistedResetVersion.current !== resetVersion) {
      persistedResetVersion.current = resetVersion;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step, savedAt: new Date().toISOString() }));
    } catch {}
  }, [data, step, resetVersion]);

  // Restore step on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.step) setStep(parsed.step);
      }
    } catch {}
  }, []);

  const update = (partial: Partial<TradeData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  const resetTradeWizard = () => {
    setResetVersion((version) => version + 1);
    setData(defaults);
    setStep(1);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <TradeContext.Provider value={{ step, setStep, data, update, resetTradeWizard }}>
      {children}
    </TradeContext.Provider>
  );
}

export const useTrade = () => useContext(TradeContext);
