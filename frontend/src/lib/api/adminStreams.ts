import { createQueryString, request } from "./client";
import type {
  AdminStreamListResponse,
  StreamClawbackPreviewResponse,
  StreamStatus,
  VestingState,
} from "./types";

export interface AdminStreamListParams {
  page?: number;
  limit?: number;
  status?: StreamStatus;
  vestingState?: VestingState;
  adminTag?: string;
}

export type StreamHealthStatus =
  | "Streaming"
  | "Near Depletion"
  | "Completed"
  | "Paused";

export interface StreamHealth {
  /** Percentage of the stream that has been streamed/vested (0-100). */
  percentStreamed: number;
  /** Percentage of the stream balance remaining (0-100). */
  percentRemaining: number;
  /** Estimated timestamp (ms since epoch) when the stream depletes, or null. */
  estimatedDepletionAt: number | null;
  /** Derived health status for the stream. */
  status: StreamHealthStatus;
}

export interface StreamHealthInput {
  totalVested?: string | number | null;
  unclaimed?: string | number | null;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
  status?: StreamStatus | string | null;
}

const NEAR_DEPLETION_THRESHOLD = 10;

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toTimestamp(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Compute stream health metrics from vesting and timing data.
 *
 * - `totalVested` represents the total amount that has vested/streamed so far.
 * - `unclaimed` represents the remaining balance still held in the stream.
 * - The total stream size is derived as `totalVested + unclaimed`.
 * - Depletion is estimated by extrapolating the streaming rate from the
 *   elapsed time between `createdAt` and `updatedAt`.
 */
export function computeStreamHealth(input: StreamHealthInput): StreamHealth {
  const totalVested = toNumber(input.totalVested);
  const unclaimed = toNumber(input.unclaimed);
  const total = totalVested + unclaimed;

  const percentStreamed =
    total > 0 ? clampPercent((totalVested / total) * 100) : 0;
  const percentRemaining =
    total > 0 ? clampPercent((unclaimed / total) * 100) : 0;

  const createdAt = toTimestamp(input.createdAt);
  const updatedAt = toTimestamp(input.updatedAt);

  let estimatedDepletionAt: number | null = null;
  if (
    unclaimed > 0 &&
    totalVested > 0 &&
    createdAt !== null &&
    updatedAt !== null &&
    updatedAt > createdAt
  ) {
    const elapsed = updatedAt - createdAt;
    const ratePerMs = totalVested / elapsed;
    if (ratePerMs > 0) {
      const remainingMs = unclaimed / ratePerMs;
      estimatedDepletionAt = updatedAt + remainingMs;
    }
  }

  const rawStatus = (input.status ?? "").toString().toUpperCase();
  let status: StreamHealthStatus;
  if (rawStatus && rawStatus !== "ACTIVE") {
    status = "Paused";
  } else if (unclaimed <= 0) {
    status = "Completed";
  } else if (percentRemaining < NEAR_DEPLETION_THRESHOLD) {
    status = "Near Depletion";
  } else {
    status = "Streaming";
  }

  return {
    percentStreamed,
    percentRemaining,
    estimatedDepletionAt,
    status,
  };
}

export const adminStreamsApi = {
  list: (token: string, params?: AdminStreamListParams) =>
    request<AdminStreamListResponse>(
      `/admin/streams${createQueryString({
        page: params?.page,
        limit: params?.limit,
        status: params?.status,
        vestingState: params?.vestingState,
        adminTag: params?.adminTag,
      })}`,
      { token },
    ),

  clawbackPreview: (token: string, streamId: string, amount: string) =>
    request<StreamClawbackPreviewResponse>(
      `/admin/streams/${encodeURIComponent(streamId)}/clawback/preview`,
      {
        token,
        method: "POST",
        body: JSON.stringify({ amount }),
      },
    ),
};