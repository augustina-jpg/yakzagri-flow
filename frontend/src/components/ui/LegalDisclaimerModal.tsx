"use client";
import { t as translateCopy } from "@/lib/i18n";


import React from "react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "./Modal";

export const LEGAL_POLICY_VERSION = "2026.1";
const DISCLAIMER_STORAGE_PREFIX = "amana:legal-disclaimer:";

export function getDisclaimerStorageKey(
  walletAddress: string = "anonymous",
  policyVersion: string = LEGAL_POLICY_VERSION,
): string {
  return `${DISCLAIMER_STORAGE_PREFIX}${walletAddress.toLowerCase()}:${policyVersion}`;
}

export function hasAcceptedLegalDisclaimer(
  walletAddress?: string | null,
  policyVersion: string = LEGAL_POLICY_VERSION,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = getDisclaimerStorageKey(walletAddress ?? "anonymous", policyVersion);
    return window.localStorage.getItem(key) === "accepted";
  } catch {
    return false;
  }
}

export function persistLegalDisclaimerAcceptance(
  walletAddress?: string | null,
  policyVersion: string = LEGAL_POLICY_VERSION,
): void {
  if (typeof window === "undefined") return;
  try {
    const key = getDisclaimerStorageKey(walletAddress ?? "anonymous", policyVersion);
    window.localStorage.setItem(key, "accepted");
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

interface LegalDisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  lossRatio: { buyer: number; seller: number };
  tradeValueCngn: string;
  walletAddress?: string | null;
  policyVersion?: string;
}

export function LegalDisclaimerModal({
  isOpen,
  onAccept,
  onDecline,
  lossRatio,
  tradeValueCngn,
  walletAddress,
  policyVersion = LEGAL_POLICY_VERSION,
}: LegalDisclaimerModalProps) {
  const buyerPercentage = lossRatio.buyer / 100;
  const sellerPercentage = lossRatio.seller / 100;

  function handleAccept() {
    persistLegalDisclaimerAcceptance(walletAddress, policyVersion);
    onAccept();
  }

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onDecline()}>
      <ModalContent
        className="max-h-[90vh] flex flex-col"
        mobileFullScreen={false}
      >
        <ModalHeader>
          <ModalTitle>{translateCopy("ui.loss_sharing_terms_4dec970")}</ModalTitle>
          <ModalDescription>
            {translateCopy("ui.please_review_the_loss_sharing_a_ae16bb4")} (v{policyVersion})
          </ModalDescription>
        </ModalHeader>

        <ModalBody className="scrollbar-thin scrollbar-thumb-white/10 flex-1">
          <div className="space-y-4">
            <p className="text-secondary text-sm">
              {translateCopy("ui.by_locking_funds_in_this_escrow__1e76a82")}
            </p>

            <div className="bg-gold-muted/30 text-gold p-4 rounded-lg font-medium border border-gold/20">
              <p className="text-sm mb-2">{translateCopy("ui.loss_allocation_e9d3d74")}</p>
              <div className="flex justify-between items-center">
                <span>{translateCopy("ui.buyer_bears_d389362")}</span>
                <span className="font-bold">
                  {(buyerPercentage * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span>{translateCopy("ui.seller_bears_62abdf0")}</span>
                <span className="font-bold">
                  {(sellerPercentage * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="text-xs text-muted space-y-2">
              <p>
                <strong>{translateCopy("ui.trade_value_3823b72")}</strong> {tradeValueCngn} cNGN
              </p>
              <p>
                {translateCopy("ui.in_the_event_of_loss_or_damage_d_b236614")}{" "}
                {(buyerPercentage * parseFloat(tradeValueCngn || "0")).toFixed(
                  2,
                )}{" "}
                {translateCopy("ui.cngn_and_the_seller_will_receive_223d344")}{" "}
                {(sellerPercentage * parseFloat(tradeValueCngn || "0")).toFixed(
                  2,
                )}{" "}
                {translateCopy("ui.cngn_after_applicable_fees_a9f273a")}
              </p>
              <p>
                {translateCopy("ui.this_agreement_is_final_and_cann_602bd70")}
              </p>
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="sm:justify-stretch sm:[&>*]:flex-1">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2 rounded-lg border border-border-default text-secondary hover:bg-elevated transition-colors"
          >
            {translateCopy("ui.decline_b59cf9e")}
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 px-4 py-2 rounded-lg bg-gold text-text-inverse font-medium hover:bg-gold-hover transition-colors"
          >
            {translateCopy("ui.accept_proceed_c4c3042")}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
