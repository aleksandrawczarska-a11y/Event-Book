import React, { useState } from "react";
import { Check, ImageOff, X } from "lucide-react";

import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import type { ApiErrorBody } from "@/lib/api-error";
import type { ModerationStatus, PortfolioEntry } from "@/types";

export type ModerationQueueEntry = PortfolioEntry & {
  image_url: string | null;
  companyName: string;
};

interface Props {
  initialEntries: ModerationQueueEntry[];
  activeStatus: ModerationStatus;
}

export default function ModerationQueue({ initialEntries, activeStatus }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function handleModerate(id: string, moderation_status: "approved" | "rejected") {
    setActingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/portfolio/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moderation_status }),
      });

      const payload = (await response.json()) as { entry?: { id: string } } | ApiErrorBody;

      if (!response.ok) {
        setError("error" in payload ? payload.error.message : "Failed to update moderation status");
        return;
      }

      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch {
      setError("Failed to update moderation status");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <ServerError message={error} />

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center text-sm text-blue-100/70">
          No {activeStatus} portfolio entries to moderate.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex gap-3">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/10">
                  {entry.image_url ? (
                    <img
                      src={entry.image_url}
                      alt={entry.event_description ?? "Portfolio photo"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageOff className="size-5 text-white/40" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-blue-100/50">{entry.companyName}</p>
                  <p className="font-medium text-white">{entry.event_description ?? "Untitled realization"}</p>
                  <p className="text-sm text-blue-100/70">
                    {[entry.decoration_style, entry.location].filter(Boolean).join(" · ") || "No style/location"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={actingId === entry.id}
                  onClick={() => {
                    void handleModerate(entry.id, "approved");
                  }}
                  className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20"
                >
                  <Check className="size-4" />
                  {actingId === entry.id ? "Saving..." : "Approve"}
                </Button>
                <Button
                  type="button"
                  disabled={actingId === entry.id}
                  onClick={() => {
                    void handleModerate(entry.id, "rejected");
                  }}
                  className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20"
                >
                  <X className="size-4" />
                  {actingId === entry.id ? "Saving..." : "Reject"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
