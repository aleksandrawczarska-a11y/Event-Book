import React, { useState } from "react";
import { ImageOff, Trash2 } from "lucide-react";

import { ServerError } from "@/components/auth/ServerError";
import { PortfolioEntryForm } from "@/components/decorator/PortfolioEntryForm";
import { Button } from "@/components/ui/button";
import type { ApiErrorBody } from "@/lib/api-error";
import type { PortfolioEntry } from "@/types";

interface Props {
  initialEntries: PortfolioEntry[];
}

export default function PortfolioPanel({ initialEntries }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this portfolio entry?")) {
      return;
    }

    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok?: boolean } | ApiErrorBody;

      if (!response.ok) {
        setError("error" in payload ? payload.error.message : "Failed to delete entry");
        return;
      }

      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch {
      setError("Failed to delete entry");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <ServerError message={error} />

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center text-sm text-blue-100/70">
          No portfolio entries yet. Add your first realization below.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex gap-3">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10">
                  <ImageOff className="size-5 text-white/40" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-white">{entry.event_description ?? "Untitled realization"}</p>
                  <p className="text-sm text-blue-100/70">
                    {[entry.decoration_style, entry.location].filter(Boolean).join(" · ") || "No style/location"}
                  </p>
                  {entry.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-white/10 bg-white/10 px-2 py-0.5 text-xs text-blue-100/80"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                disabled={deletingId === entry.id}
                onClick={() => {
                  void handleDelete(entry.id);
                }}
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20"
              >
                <Trash2 className="size-4" />
                {deletingId === entry.id ? "Deleting..." : "Delete"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <PortfolioEntryForm
        onCreated={(entry) => {
          setEntries((prev) => [entry, ...prev]);
          setError(null);
        }}
      />
    </div>
  );
}
