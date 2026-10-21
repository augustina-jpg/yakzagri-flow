"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useEffect, useMemo, useRef, useState } from "react";
import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

import { useFreighterIdentity } from "@/hooks/useFreighterIdentity";
import { Badge } from "@/components/ui/Badge";
import { WalletAddressBadge } from "@/components/ui/WalletAddressBadge";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import { api, ApiError, type EvidenceRecord } from "@/lib/api";

type Props = { disputeId: string };

type ConfirmationModalState = {
  isOpen: boolean;
  sellerGetsBps: number | null;
  splitLabel: string;
};

type VideoLoadState = "loading" | "ready" | "terminal-failure";

const DEFAULT_MEDIATOR_ADDRESSES = ["GEXAMPLEMEDIATORPUBLICKEY1"];
const TOKEN_STORAGE_KEY = "amana_jwt";

const PINATA_GATEWAYS = [
  process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL?.trim(),
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
].filter((value): value is string => Boolean(value));

const DEFAULT_NETWORK_PASSPHRASE = Networks.TESTNET;
const isDev = process.env.NEXT_PUBLIC_APP_ENV === "development";

function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function isProbablyIpfsCid(value: string): boolean {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return false;
  }

  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmedValue)) {
    return true;
  }

  return /^bafy[2-7a-z]{20,}$/i.test(trimmedValue);
}

export function pickBestEvidenceCid(records: EvidenceRecord[]): string | null {
  if (records.length === 0) {
    return null;
  }

  const newestRecord = [...records].sort((left, right) => {
    const leftTimestamp = new Date(left.createdAt).getTime();
    const rightTimestamp = new Date(right.createdAt).getTime();

    if (Number.isNaN(leftTimestamp) || Number.isNaN(rightTimestamp)) {
      return 0;
    }

    return rightTimestamp - leftTimestamp;
  })[0];

  const candidateCid = newestRecord?.cid?.trim();
  return candidateCid && isProbablyIpfsCid(candidateCid) ? candidateCid : null;
}

export default function MediatorPanelClient({ disputeId }: Props) {
  const { address, isAuthorized, isLoading, connectWallet } =
    useFreighterIdentity();
  const [txStatus, setTxStatus] = useState<string>("");
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [activeGatewayIndex, setActiveGatewayIndex] = useState(0);
  const [videoLoadState, setVideoLoadState] =
    useState<VideoLoadState>("loading");
  const [resolvedCid, setResolvedCid] = useState<string | null>(null);
  const [cidSource, setCidSource] = useState<
    "backend" | "query" | "none" | "loading"
  >("loading");
  const [cidMessage, setCidMessage] = useState("");
  const [modal, setModal] = useState<ConfirmationModalState>({
    isOpen: false,
    sellerGetsBps: null,
    splitLabel: "",
  });

  const submittingRef = useRef(false);

  const [execString, setExecString] = useState<string>("");
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const mediatorAddresses = useMemo(() => {
    const fromEnv = (process.env.NEXT_PUBLIC_MEDIATOR_WALLETS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    return fromEnv.length > 0 ? fromEnv : DEFAULT_MEDIATOR_ADDRESSES;
  }, []);

  const isMediator = Boolean(address && mediatorAddresses.includes(address));
  const canResolve = isMediator && !isSubmittingTx;
  const explorerNetwork =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? "public" : "testnet";

  const pinataUrl = resolvedCid
    ? `${PINATA_GATEWAYS[activeGatewayIndex]}/${resolvedCid}`
    : null;

  useEffect(() => {
    let cancelled = false;

    async function resolveEvidenceCid() {
      setCidSource("loading");
      setCidMessage("");
      setResolvedCid(null);

      const parsedTradeId = Number(disputeId);
      if (!Number.isInteger(parsedTradeId) || parsedTradeId < 0) {
        if (!cancelled) {
          setCidSource("none");
          setCidMessage("Invalid dispute id. Expected a numeric trade id.");
        }
        return;
      }

      const url = new URL(window.location.href);
      const queryCid = url.searchParams.get("cid")?.trim() ?? "";
      const fallbackCid = isProbablyIpfsCid(queryCid) ? queryCid : null;
      const token = getStoredToken();

      if (!token) {
        if (!cancelled && fallbackCid) {
          setCidSource("query");
          setResolvedCid(fallbackCid);
          setCidMessage("Using CID from query parameter fallback.");
          return;
        }

        if (!cancelled) {
          setCidSource("none");
          setCidMessage(
            "No evidence CID available. Authenticate to load evidence from the backend, or supply a valid ?cid=... parameter.",
          );
        }
        return;
      }

      try {
        const response = await api.trades.getEvidence(
          token,
          String(parsedTradeId),
        );
        const backendCid = pickBestEvidenceCid(response.evidence);

        if (!cancelled && backendCid) {
          setCidSource("backend");
          setResolvedCid(backendCid);
          return;
        }

        if (!cancelled && fallbackCid) {
          setCidSource("query");
          setResolvedCid(fallbackCid);
          setCidMessage(
            "No backend evidence CID found. Using query parameter fallback.",
          );
          return;
        }

        if (!cancelled) {
          setCidSource("none");
          setCidMessage("No evidence found for this trade.");
        }
      } catch (error) {
        const message =
          error instanceof ApiError
            ? `Evidence lookup failed (${error.status}).`
            : "Evidence lookup failed.";

        if (!cancelled && fallbackCid) {
          setCidSource("query");
          setResolvedCid(fallbackCid);
          setCidMessage(`${message} Using query parameter fallback.`);
          return;
        }

        if (!cancelled) {
          setCidSource("none");
          setCidMessage(`${message} No CID available for playback.`);
        }
      }
    }

    void resolveEvidenceCid();

    return () => {
      cancelled = true;
    };
  }, [disputeId]);

  useEffect(() => {
    if (!resolvedCid) {
      return;
    }

    setActiveGatewayIndex(0);
    setVideoLoadState("loading");
  }, [resolvedCid]);

  function handleVideoError() {
    const nextIndex = activeGatewayIndex + 1;
    if (nextIndex < PINATA_GATEWAYS.length) {
      setActiveGatewayIndex(nextIndex);
      setVideoLoadState("loading");
    } else {
      setVideoLoadState("terminal-failure");
    }
  }

  function switchGateway() {
    const nextIndex = (activeGatewayIndex + 1) % PINATA_GATEWAYS.length;
    setActiveGatewayIndex(nextIndex);
    setVideoLoadState("loading");
  }

  function buildExec(split: string) {
    const s = `soroban://execute?cmd=resolve_dispute&split=${split}&dispute=${disputeId}`;
    setExecString(s);
  }

  function openConfirmationModal(sellerGetsBps: number, splitLabel: string) {
    setModal({ isOpen: true, sellerGetsBps, splitLabel });
  }

  function getBuyerSplit(sellerBps: number): number {
    return 10000 - sellerBps;
  }

  function closeModal() {
    setModal({ isOpen: false, sellerGetsBps: null, splitLabel: "" });
  }

  function handleConfirmResolution() {
    const bps = modal.sellerGetsBps;
    if (bps === null) return;
    closeModal();
    void executeResolution(bps);
  }

  function handleOpenConfirmation(sellerGetsBps: number, splitLabel: string) {
    setResolutionError(null);
    openConfirmationModal(sellerGetsBps, splitLabel);
  }

  async function executeResolution(sellerGetsBps: number) {
    if (submittingRef.current) return;
    if (!address) {
      setTxStatus("Connect Freighter first.");
      return;
    }

    submittingRef.current = true;
    const parsedTradeId = Number(disputeId);
    if (!Number.isInteger(parsedTradeId) || parsedTradeId < 0) {
      submittingRef.current = false;
      setTxStatus("Dispute ID must be a numeric on-chain trade_id.");
      return;
    }

    const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID?.trim();
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim();

    if (!contractId || !rpcUrl) {
      submittingRef.current = false;
      setTxStatus("Missing NEXT_PUBLIC_CONTRACT_ID or NEXT_PUBLIC_RPC_URL.");
      return;
    }

    setIsSubmittingTx(true);
    setResolutionError(null);
    setTxStatus("Preparing Soroban transaction...");

    try {
      const networkPassphrase =
        process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
          ? Networks.PUBLIC
          : DEFAULT_NETWORK_PASSPHRASE;

      const rpcServer = new rpc.Server(rpcUrl);
      const source = await rpcServer.getAccount(address);
      const contract = new Contract(contractId);

      const tx = new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          contract.call(
            "resolve_dispute",
            nativeToScVal(BigInt(parsedTradeId), { type: "u64" }),
            Address.fromString(address).toScVal(),
            nativeToScVal(sellerGetsBps, { type: "u32" }),
          ),
        )
        .setTimeout(180)
        .build();

      const prepared = await rpcServer.prepareTransaction(tx);
      const signResult = await signTransaction(prepared.toXDR(), {
        networkPassphrase,
        address,
      });

      if (signResult.error) {
        throw new Error(signResult.error.message ?? "Freighter signing failed");
      }

      const signedTx = TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        networkPassphrase,
      );

      const sendResponse = await rpcServer.sendTransaction(signedTx);
      if (sendResponse.status === "ERROR") {
        throw new Error(
          typeof sendResponse.errorResult === "string"
            ? sendResponse.errorResult
            : JSON.stringify(
                sendResponse.errorResult ?? "Transaction rejected by RPC",
              ),
        );
      }

      setTxStatus(`Submitted. Hash: ${sendResponse.hash}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Soroban execution failed";
      setResolutionError(message);
      setTxStatus(message);
    } finally {
      submittingRef.current = false;
      setIsSubmittingTx(false);
    }
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">
          {translateCopy("ui.mediator_panel_00fec92")}
        </h1>
        <p className="text-text-secondary mt-1">
          {translateCopy("ui.dispute_3e05bb7")}{" "}
          <span className="font-mono text-text-primary">{disputeId}</span> {translateCopy("ui.review_evidence_and_resolve_on_c_64bc054")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Evidence Video */}
        <div className="lg:col-span-7">
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-card">
            {!pinataUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
                <svg
                  className="w-10 h-10 text-status-danger"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-white font-medium">{translateCopy("ui.evidence_unavailable_0e55ae7")}</p>
                <p className="text-gray-400 text-sm max-w-md">
                  {cidSource === "loading" ? "Loading evidence..." : cidMessage}
                </p>
              </div>
            ) : videoLoadState === "terminal-failure" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
                <svg
                  className="w-10 h-10 text-status-danger"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-white font-medium">{translateCopy("ui.evidence_unavailable_0e55ae7")}</p>
                <p className="text-gray-400 text-sm">
                  {translateCopy("ui.all_ipfs_gateways_failed_to_load_0d063eb")}
                </p>
                <button
                  onClick={() => {
                    setActiveGatewayIndex(0);
                    setVideoLoadState("loading");
                  }}
                  className="mt-2 px-4 py-2 bg-bg-elevated border border-border-default text-text-primary text-sm rounded-md hover:bg-bg-input transition-colors"
                >
                  {translateCopy("ui.retry_from_first_gateway_bb038ef")}
                </button>
              </div>
            ) : (
              <>
                {videoLoadState === "loading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
                      <span className="text-gray-300 text-xs">
                        {translateCopy("ui.loading_via_gateway_2460fac")}{" "}{activeGatewayIndex + 1}/
                        {PINATA_GATEWAYS.length}…
                      </span>
                    </div>
                  </div>
                )}
                <video
                  key={pinataUrl}
                  controls
                  className="w-full h-full object-contain bg-black"
                  src={pinataUrl}
                  onLoadStart={() => setVideoLoadState("loading")}
                  onCanPlay={() => setVideoLoadState("ready")}
                  onError={handleVideoError}
                />
              </>
            )}
          </div>

          {/* Video meta */}
          <div className="mt-3 text-sm text-text-secondary space-y-2">
            <div>
              {translateCopy("ui.dispute_id_4d79a1b")}{" "}
              <span className="font-mono text-text-primary">{disputeId}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {pinataUrl && videoLoadState !== "terminal-failure" && (
                <span className="text-xs text-text-muted">
                  {translateCopy("ui.gateway_5a0e181")}{" "}{activeGatewayIndex + 1}/{PINATA_GATEWAYS.length}
                </span>
              )}
              {pinataUrl &&
                PINATA_GATEWAYS.length > 1 &&
                videoLoadState !== "terminal-failure" && (
                  <button
                    onClick={switchGateway}
                    className="text-xs text-gold hover:underline underline-offset-2"
                  >
                    {translateCopy("ui.switch_gateway_162f42d")}
                  </button>
                )}
              {isMediator ? (
                <Badge variant="success">{translateCopy("ui.authorized_mediator_4271d07")}</Badge>
              ) : (
                <Badge variant="danger">{translateCopy("ui.unauthorized_740b831")}</Badge>
              )}
            </div>
          </div>

          {/* Dev-only: IPFS debug info */}
          {isDev && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs space-y-1">
              <div className="font-semibold text-yellow-700">{translateCopy("ui.dev_2fada46")}</div>
              <div>{translateCopy("ui.pinata_cid_dcc00d0")}{" "}{resolvedCid ?? "Unavailable"}</div>
              <div>{translateCopy("ui.cid_source_97ea985")}{" "}{cidSource}</div>
              {cidMessage && <div>{translateCopy("ui.message_9e02959")}{" "}{cidMessage}</div>}
              <div>
                {translateCopy("ui.gateway_7946db5")}{" "}
                <Badge variant="info">
                  {PINATA_GATEWAYS[activeGatewayIndex]}
                </Badge>
              </div>
              <div>{translateCopy("ui.wallet_9ab9249")}{" "}{address ?? "Not connected"}</div>
            </div>
          )}
        </div>

        {/* Right: Resolution Panel */}
        <div className="lg:col-span-5">
          <div className="bg-bg-card rounded-xl shadow-card p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                {translateCopy("ui.resolve_dispute_a495c38")}
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                {translateCopy("ui.select_a_loss_ratio_split_to_set_508a2d7")}
              </p>
            </div>

            <div className="rounded-md border border-border-default bg-bg-elevated p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {translateCopy("ui.connected_wallet_0563ce9")}
              </p>
              {address ? (
                <WalletAddressBadge
                  address={address}
                  truncate="middle"
                  showCopy
                  showExplorer
                  explorerNetwork={explorerNetwork}
                />
              ) : (
                <p className="text-sm text-text-muted">{translateCopy("ui.no_wallet_connected_19e0f9b")}</p>
              )}
            </div>

            {!isAuthorized && (
              <button
                onClick={() => void connectWallet()}
                disabled={isLoading}
                className="w-full rounded-md bg-gold text-text-inverse py-2.5 text-sm font-medium hover:bg-gold-hover transition-colors disabled:opacity-50"
              >
                {isLoading ? "Connecting..." : "Connect Freighter"}
              </button>
            )}

            {isAuthorized && !isMediator && (
              <Badge variant="danger">
                {translateCopy("ui.unauthorized_wallet_access_is_re_26ca3e7")}
              </Badge>
            )}

            {/* Primary actions */}
            <div className="grid grid-cols-1 gap-3">
              <button
                disabled={!canResolve}
                onClick={() => handleOpenConfirmation(5000, "50/50")}
                data-testid="resolve-split-50-50"
                className="w-full rounded-md bg-emerald-700 text-white px-3 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-emerald-800 transition"
              >
                {translateCopy("ui.resolve_equal_split_50_50_8b3305d")}
              </button>

              <button
                disabled={!canResolve}
                onClick={() => handleOpenConfirmation(7000, "70/30")}
                data-testid="resolve-split-70-30"
                className="w-full rounded-md bg-emerald-700 text-white px-3 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-emerald-800 transition"
              >
                {translateCopy("ui.resolve_seller_favoured_70_30_3711ff4")}
              </button>

              <button
                disabled={!canResolve}
                onClick={() => handleOpenConfirmation(0, "0/100")}
                data-testid="resolve-split-0-100"
                className="w-full rounded-md bg-emerald-700 text-white px-3 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-emerald-800 transition"
              >
                {translateCopy("ui.resolve_buyer_win_0_100_placeholder")}
              </button>

              <button
                disabled={!canResolve}
                onClick={() => handleOpenConfirmation(10000, "100/0")}
                data-testid="resolve-split-100-0"
                className="w-full rounded-md bg-emerald-700 text-white px-3 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-emerald-800 transition"
              >
                {translateCopy("ui.resolve_seller_win_100_0_placeholder")}
              </button>
            </div>

            {/* Tx status feedback */}
            {txStatus && (
              <p
                data-testid="tx-status"
                role={resolutionError ? "alert" : "status"}
                className="text-xs text-text-secondary break-all"
              >
                {txStatus}
              </p>
            )}

            {/* Dev-only: exec string builder */}
            {isDev && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded space-y-2">
                <p className="text-xs font-semibold text-yellow-700">
                  {translateCopy("ui.dev_exec_string_builder_9796dcd")}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={!isMediator}
                    onClick={() => buildExec("50-50")}
                    className="flex-1 rounded border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {translateCopy("ui.build_50_50_774eb85")}
                  </button>
                  <button
                    disabled={!isMediator}
                    onClick={() => buildExec("70-30")}
                    className="flex-1 rounded border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {translateCopy("ui.build_70_30_612609e")}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={execString}
                  className="block w-full rounded border-gray-200 h-16 p-2 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    disabled={!execString}
                    onClick={() => navigator.clipboard?.writeText(execString)}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                  >
                    {translateCopy("ui.copy_af74f7c")}
                  </button>
                  <a
                    href={execString || "#"}
                    onClick={(e) => {
                      if (!execString) e.preventDefault();
                    }}
                    className="px-2 py-1 bg-gray-100 rounded text-xs"
                  >
                    {translateCopy("ui.preview_f1fbb2b")}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        open={modal.isOpen && modal.sellerGetsBps !== null}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <ModalContent role="alertdialog" mobileFullScreen={false} className="max-w-md">
          {modal.sellerGetsBps !== null && (
            <>
              <ModalHeader>
                <ModalTitle>{translateCopy("ui.confirm_resolution_1c8af18")}</ModalTitle>
              </ModalHeader>

              <ModalBody className="space-y-4">
                <div className="border border-border-default rounded-lg bg-bg-elevated p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-text-secondary">
                      {translateCopy("ui.trade_id_b32a8bb")}
                    </span>
                    <span className="text-sm font-mono text-text-primary">
                      {disputeId}
                    </span>
                  </div>
                  <div className="border-t border-border-default" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-text-secondary">
                      {translateCopy("ui.split_208adf5")}
                    </span>
                    <span
                      data-testid="split-label"
                      className="text-sm font-semibold text-text-primary"
                    >
                      {modal.splitLabel}
                    </span>
                  </div>
                  <div className="border-t border-border-default" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-text-secondary">
                      {translateCopy("ui.seller_receives_f80dbbe")}
                    </span>
                    <span
                      data-testid="seller-receives"
                      className="text-sm font-semibold text-status-success"
                    >
                      {(modal.sellerGetsBps / 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-text-secondary">
                      {translateCopy("ui.buyer_receives_6af6881")}
                    </span>
                    <span
                      data-testid="buyer-receives"
                      className="text-sm font-semibold text-gold"
                    >
                      {(getBuyerSplit(modal.sellerGetsBps) / 100).toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                  <ModalDescription className="text-xs text-yellow-800">
                    <span className="font-semibold">{translateCopy("ui.warning_3217f29")}</span>{" "}
                    {translateCopy("ui.this_action_is_irreversible_and__629365e")}
                  </ModalDescription>
                </div>
              </ModalBody>

              <div className="grid grid-cols-2 gap-2 border-t border-border-default px-6 py-4 sm:gap-3">
                <button
                  onClick={closeModal}
                  disabled={isSubmittingTx}
                  data-testid="cancel-resolution"
                  className="px-3 sm:px-4 py-2.5 border border-border-default text-text-primary text-sm font-medium rounded-md hover:bg-bg-elevated disabled:opacity-50 transition"
                  aria-label={translateCopy("ui.cancel_resolution_4acad72")}
                >
                  {translateCopy("common.cancel")}
                </button>
                <button
                  onClick={handleConfirmResolution}
                  disabled={isSubmittingTx}
                  data-testid="confirm-resolution"
                  className="px-3 sm:px-4 py-2.5 bg-emerald-700 text-white text-sm font-medium rounded-md hover:bg-emerald-800 disabled:opacity-50 transition"
                  aria-label={translateCopy("ui.confirm_and_sign_resolution_2d0dc86")}
                >
                  {isSubmittingTx ? "Processing..." : "Confirm & Sign"}
                </button>
              </div>
            </>
          )}
        </ModalContent>
      </Modal>

    </div>
  );
}
