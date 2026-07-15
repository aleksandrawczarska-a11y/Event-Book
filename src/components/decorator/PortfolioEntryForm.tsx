import React, { useState } from "react";
import { MapPin, Palette, Plus, Save, Tag, Text } from "lucide-react";

import { ServerError } from "@/components/auth/ServerError";
import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/button";
import type { ApiErrorBody } from "@/lib/api-error";
import type { PortfolioEntry } from "@/types";

interface Props {
  onCreated: (entry: PortfolioEntry) => void;
}

export function PortfolioEntryForm({ onCreated }: Props) {
  const [eventDescription, setEventDescription] = useState("");
  const [decorationStyle, setDecorationStyle] = useState("");
  const [location, setLocation] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setServerError(null);

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_description: eventDescription,
          decoration_style: decorationStyle,
          location,
          tags,
        }),
      });

      const payload = (await response.json()) as { entry?: PortfolioEntry } | ApiErrorBody;

      if (!response.ok) {
        setServerError("error" in payload ? payload.error.message : "Failed to create entry");
        return;
      }

      if ("entry" in payload && payload.entry) {
        onCreated(payload.entry);
        setEventDescription("");
        setDecorationStyle("");
        setLocation("");
        setTagsInput("");
      }
    } catch {
      setServerError("Failed to create entry");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2">
        <Plus className="size-4 text-purple-300" />
        <h2 className="text-lg font-semibold text-white">Add portfolio entry</h2>
      </div>

      <p className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-100/80">
        Photo upload comes in the next step. You can add description and tags now.
      </p>

      <FormField
        id="event_description"
        label="Event description"
        value={eventDescription}
        onChange={setEventDescription}
        placeholder="Wedding reception at a lakeside venue"
        icon={<Text className="size-4" />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="decoration_style"
          label="Decoration style"
          value={decorationStyle}
          onChange={setDecorationStyle}
          placeholder="Boho"
          icon={<Palette className="size-4" />}
        />
        <FormField
          id="location"
          label="Location"
          value={location}
          onChange={setLocation}
          placeholder="Wrocław"
          icon={<MapPin className="size-4" />}
        />
      </div>

      <FormField
        id="tags"
        label="Tags"
        value={tagsInput}
        onChange={setTagsInput}
        placeholder="flowers, outdoor, pastel (comma-separated)"
        icon={<Tag className="size-4" />}
      />

      <ServerError message={serverError} />

      <Button
        type="submit"
        disabled={isSaving}
        className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-500"
      >
        {isSaving ? (
          "Saving..."
        ) : (
          <span className="flex items-center gap-2">
            <Save className="size-4" />
            Add entry
          </span>
        )}
      </Button>
    </form>
  );
}
