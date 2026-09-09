import type { ModerationStatus } from "@/types";

const ALLOWED_STATUSES: ModerationStatus[] = ["pending", "approved", "rejected"];

export function parseModerationQueueStatus(raw: string | null): ModerationStatus {
  if (raw !== null && ALLOWED_STATUSES.includes(raw as ModerationStatus)) {
    return raw as ModerationStatus;
  }

  return "pending";
}
