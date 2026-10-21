import { createQueryString, request } from "./client";
import type { AdminAuditListResponse } from "./types";

export const adminAuditApi = {
  list: (
    token: string,
    params?: {
      page?: number;
      limit?: number;
      actorAddress?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
    },
  ) =>
    request<AdminAuditListResponse>(
      `/admin/audit${createQueryString({
        page: params?.page,
        limit: params?.limit,
        actorAddress: params?.actorAddress,
        action: params?.action,
        startDate: params?.startDate,
        endDate: params?.endDate,
      })}`,
      { token },
    ),
};