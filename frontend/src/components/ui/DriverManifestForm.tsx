"use client";
import { t as translateCopy } from "@/lib/i18n";


import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";

export interface DriverManifestData {
  driverName: string;
  driverPhone: string;
  licensePlate: string;
}

const NIGERIAN_E164_PATTERN = /^\+234\d{10}$/;
const PLATE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{1,12}[A-Za-z0-9]$/;

/**
 * Normalize a Nigerian phone number to E.164 format (`+234XXXXXXXXXX`).
 * Returns null when the input cannot be resolved to a valid number.
 */
export function normalizeNigerianPhone(raw: string): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (cleaned === "") {
    return null;
  }

  let digits: string;

  if (cleaned.startsWith("+234")) {
    digits = cleaned.slice(4);
  } else if (cleaned.startsWith("234")) {
    digits = cleaned.slice(3);
  } else if (cleaned.startsWith("0")) {
    digits = cleaned.slice(1);
  } else {
    return null;
  }

  if (!/^\d{10}$/.test(digits)) {
    return null;
  }

  const normalized = `+234${digits}`;
  return NIGERIAN_E164_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Validate a vehicle registration plate.
 * Returns an error message when invalid, or null when valid.
 */
export function validatePlate(raw: string): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed === "") {
    return "License plate is required";
  }
  if (!PLATE_PATTERN.test(trimmed)) {
    return "Enter a valid license plate (2-14 letters, numbers, spaces or dashes)";
  }
  return null;
}

interface DriverManifestFormProps {
  isOpen: boolean;
  onComplete: (data: DriverManifestData) => void;
  onDismiss?: () => void;
}

export function DriverManifestForm({ isOpen, onComplete, onDismiss }: DriverManifestFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [plateTouched, setPlateTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const phoneError = useMemo(() => {
    if (driverPhone.trim() === "") {
      return "Driver phone is required";
    }
    return normalizeNigerianPhone(driverPhone) === null
      ? "Enter a valid Nigerian phone number (e.g. 0803 000 0000)"
      : null;
  }, [driverPhone]);

  const plateError = useMemo(() => validatePlate(licensePlate), [licensePlate]);

  const showPhoneError = (phoneTouched || submitAttempted) && phoneError !== null;
  const showPlateError = (plateTouched || submitAttempted) && plateError !== null;

  const submitEnabled =
    driverName.trim() !== '' &&
    phoneError === null &&
    plateError === null;

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = bodyOverflow || "unset";
    };
  }, [isOpen]);


  const handlePhoneBlur = () => {
    setPhoneTouched(true);
    const normalized = normalizeNigerianPhone(driverPhone);
    if (normalized !== null) {
      setDriverPhone(normalized);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    const form = formRef.current;

    if (!form) {
      return;
    }

    const normalizedPhone = normalizeNigerianPhone(driverPhone);
    const plateValidationError = validatePlate(licensePlate);

    if (normalizedPhone === null || plateValidationError !== null) {
      return;
    }

    onComplete({
      driverName: driverName.trim(),
      driverPhone: normalizedPhone,
      licensePlate: licensePlate.trim(),
    });

    setDriverName("");
    setDriverPhone("");
    setLicensePlate("");
    setPhoneTouched(false);
    setPlateTouched(false);
    setSubmitAttempted(false);

    onDismiss?.();
  };

  const handleClose = () => {
    onDismiss?.();
  };

  const iconAccent = useMemo(() => "bg-gold/15 text-gold", []);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(nextOpen) => !nextOpen && onDismiss?.()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-overlay backdrop-blur-lg z-50 flex items-center justify-center">
          <Dialog.Content className="bg-card border border-border-default shadow-modal max-w-md w-full max-h-[90vh] rounded-2xl flex flex-col">
            <div className="p-6 border-b border-border-default">
              <div className="flex items-center gap-3 mb-4">
                <span className={clsx("rounded-lg p-2", iconAccent)}>
                  <Icon name="truck" size="lg" aria-label={translateCopy("ui.driver_vehicle_986d191")} className="text-gold" />
                </span>
                <div>
                  <Dialog.Title className="text-xl font-semibold text-primary">{translateCopy("ui.driver_manifest_9fe8366")}</Dialog.Title>
                  <Dialog.Description className="text-sm text-secondary mt-1">
                    {translateCopy("ui.enter_driver_and_vehicle_data_fo_9c7eb0e")}
                  </Dialog.Description>
                </div>
              </div>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 flex-1">
              <FormField label="Driver Name" name="driver-name" required>
                <input
                  type="text"
                  name="driver-name"
                  className="w-full rounded-xl border border-border-default bg-bg-input px-4 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                  value={driverName}
                  onChange={(event) => setDriverName(event.target.value)}
                  placeholder={translateCopy("ui.e_g_amina_khalid_d133ea8")}
                  required
                />
              </FormField>

              <FormField
                label="Driver Phone"
                name="driver-phone"
                hint="Local numbers (0803...) are converted to +234 automatically"
                error={showPhoneError ? phoneError ?? undefined : undefined}
                required
              >
                <input
                  type="tel"
                  name="driver-phone"
                  className="w-full rounded-xl border border-border-default bg-bg-input px-4 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                  value={driverPhone}
                  onChange={(event) => setDriverPhone(event.target.value)}
                  onBlur={handlePhoneBlur}
                  placeholder={translateCopy("ui.e_g_234_803_000_0000_a54ac33")}
                  aria-invalid={showPhoneError}
                  required
                />
              </FormField>

              <FormField
                label="License Plate"
                name="license-plate"
                error={showPlateError ? plateError ?? undefined : undefined}
                required
              >
                <input
                  type="text"
                  name="license-plate"
                  className="w-full rounded-xl border border-border-default bg-bg-input px-4 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                  value={licensePlate}
                  onChange={(event) => setLicensePlate(event.target.value)}
                  onBlur={() => setPlateTouched(true)}
                  placeholder={translateCopy("ui.e_g_geg_1123_h_814141c")}
                  aria-invalid={showPlateError}
                  required
                />
              </FormField>

              <div className="flex gap-3 mt-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-border-default text-secondary hover:bg-elevated transition-colors"
                >
                  {translateCopy("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={!submitEnabled}
                  className="flex-1 px-4 py-2 rounded-lg bg-gold text-text-inverse font-medium hover:bg-gold-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {translateCopy("ui.submit_manifest_13f57ee")}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
