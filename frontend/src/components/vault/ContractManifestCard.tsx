
import { useCallback, useEffect, useRef, useState } from "react";
import { t as translateCopy } from "@/lib/i18n";
import { BentoCard } from "@/components/ui/BentoCard";
import { FileText, Eye, Copy, Check, ExternalLink, ShieldCheck, ShieldAlert } from "lucide-react";
import Image from 'next/image';
import Download from "@/app/assets/ExportIcon.png"

const STELLAR_NETWORKS = {
  testnet: {
    label: "Testnet",
    passphrase: "Test SDF Network ; September 2015",
    explorerBaseUrl: "https://stellar.expert/explorer/testnet/contract",
  },
  mainnet: {
    label: "Mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    explorerBaseUrl: "https://stellar.expert/explorer/public/contract",
  },
} as const;

type StellarNetwork = keyof typeof STELLAR_NETWORKS;

function resolveStellarNetwork(): StellarNetwork {
  const configured =
    typeof process !== "undefined"
      ? process.env?.NEXT_PUBLIC_STELLAR_NETWORK
      : undefined;
  return configured?.toLowerCase() === "mainnet" ? "mainnet" : "testnet";
}

interface Party {
  initials: string;
  name: string;
  color: "teal" | "emerald";
}

interface ContractManifestCardProps {
  contractId: string;
  agreementDate: string;
  settlementType: string;
  originParty: Party;
  recipientParty: Party;
  onExportPdf?: () => void;
  onViewClauses?: () => void;
  /** Expected on-chain WASM hash for the deployed Soroban contract. */
  wasmHash?: string;
  /** Hash reported by the network for the deployed contract, if known. */
  deployedWasmHash?: string;
  /** Override the network derived from configuration (useful for tests). */
  network?: StellarNetwork;
}

export function ContractManifestCard({
  contractId,
  agreementDate,
  settlementType,
  originParty,
  recipientParty,
  onExportPdf,
  onViewClauses,
  wasmHash,
  deployedWasmHash,
  network,
}: ContractManifestCardProps) {
  const getPartyBgColor = (color: Party["color"]) => {
    return color === "teal" ? "bg-teal" : "bg-emerald";
  };

  const activeNetwork = network ?? resolveStellarNetwork();
  const networkConfig = STELLAR_NETWORKS[activeNetwork];

  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyContractId = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(contractId);
      }
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [contractId]);

  const explorerUrl = `${networkConfig.explorerBaseUrl}/${contractId}`;

  const wasmStatus: "verified" | "mismatch" | "unverified" =
    wasmHash && deployedWasmHash
      ? wasmHash.toLowerCase() === deployedWasmHash.toLowerCase()
        ? "verified"
        : "mismatch"
      : "unverified";

  return (
    <BentoCard
      title={translateCopy("ui.contract_manifest_1052b0a")}
      icon={<FileText className="w-5 h-5" />}
      glowVariant="gold"
      className="h-104"
    >
      <div className="flex flex-col gap-2 -mt-8 mb-6">
        <div className="flex items-center justify-end gap-2">
          <span
            className="text-xs font-semibold text-text-primary bg-bg-input px-3 py-1 rounded-full"
            title={networkConfig.passphrase}
          >
            {networkConfig.label}
          </span>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 ${
              wasmStatus === "verified"
                ? "text-emerald bg-emerald-muted"
                : wasmStatus === "mismatch"
                  ? "text-red bg-red-muted"
                  : "text-text-secondary bg-bg-input"
            }`}
            role="status"
            aria-live="polite"
          >
            {wasmStatus === "verified" ? (
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {wasmStatus === "verified"
              ? translateCopy("ui.wasm_verified")
              : wasmStatus === "mismatch"
                ? translateCopy("ui.wasm_mismatch")
                : translateCopy("ui.wasm_unverified")}
          </span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <span
            className="text-xs font-mono text-gold bg-gold-muted px-3 py-1 rounded-full break-all"
            title={contractId}
          >
            {contractId}
          </span>
          <button
            type="button"
            onClick={handleCopyContractId}
            aria-label={
              copied
                ? translateCopy("ui.contract_id_copied")
                : translateCopy("ui.copy_contract_id")
            }
            title={
              copied
                ? translateCopy("ui.contract_id_copied")
                : translateCopy("ui.copy_contract_id")
            }
            className="flex items-center justify-center w-7 h-7 rounded-full bg-bg-input hover:bg-gold-muted text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={translateCopy("ui.view_on_explorer")}
            title={translateCopy("ui.view_on_explorer")}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-bg-input hover:bg-gold-muted text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? translateCopy("ui.contract_id_copied") : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-2 pl-5 pr-5">
        <div>
          <p className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-1">
            {translateCopy("ui.agreement_date_423ea5e")}
          </p>
          <p className="text-sm font-medium text-text-primary">{agreementDate}</p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-1">
            {translateCopy("ui.settlement_type_6c68618")}
          </p>
          <p className="text-sm font-medium text-text-primary">{settlementType}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6 pl-5 pr-5">
        <div className="mt-15">
          <p className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-2">
            {translateCopy("ui.origin_party_396fa75")}
          </p>
          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-lg ${getPartyBgColor(originParty.color)} text-text-inverse text-xs font-bold flex items-center justify-center`}
            >
              {originParty.initials}
            </span>
            <span className="text-sm text-text-primary">{originParty.name}</span>
          </div>
        </div>
        <div className="mt-15">
          <p className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-2">
            {translateCopy("ui.recipient_party_1e39325")}
          </p>
          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-lg ${getPartyBgColor(recipientParty.color)} text-text-inverse text-xs font-bold flex items-center justify-center`}
            >
              {recipientParty.initials}
            </span>
            <span className="text-sm text-text-primary">{recipientParty.name}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-15">
        <button
          onClick={onExportPdf}
          disabled={!onExportPdf}
          title={!onExportPdf ? "A contract PDF is not available for this position." : undefined}
          className="flex-1 flex items-center justify-center gap-2 bg-[#1E2D2666] hover:bg-bg-input text-text-primary font-medium py-2.5 px-4 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
           <Image
              src={Download}
              alt={translateCopy("ui.export_icon_1c4dcec")}
              width={11.67}
              height={11.67}
             />
          {translateCopy("ui.export_pdf_3dd7d56")}
        </button>
        <button
          onClick={onViewClauses}
          disabled={!onViewClauses}
          title={!onViewClauses ? "Contract clauses are not available for this position." : undefined}
          className="flex-1 flex items-center justify-center gap-2 bg-[#1E2D2666] hover:bg-bg-input text-text-primary font-medium py-2.5 px-4 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Eye className="w-4 h-4" />
          {translateCopy("ui.view_clauses_55dc206")}
        </button>
      </div>
    </BentoCard>
  );
}
