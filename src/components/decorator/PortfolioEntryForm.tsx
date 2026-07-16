import React, { useRef, useState } from "react";
import { Camera, MapPin, Palette, Plus, Save, Tag, Text } from "lucide-react";

import { ServerError } from "@/components/auth/ServerError";
import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/button";
import type { ApiErrorBody } from "@/lib/api-error";
import type { PortfolioEntry } from "@/types";

export type PortfolioEntryView = PortfolioEntry & { image_url: string | null };

interface Props {
  onCreated: (entry: PortfolioEntryView) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function PortfolioEntryForm({ onCreated }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [eventDescription, setEventDescription] = useState("");
  const [decorationStyle, setDecorationStyle] = useState("");
  const [location, setLocation] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function clearFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(next: File | undefined) {
    setServerError(null);
    if (!next) {
      clearFile();
      return;
    }

    if (!ALLOWED_TYPES.has(next.type)) {
      setServerError("Only JPEG, PNG, and WebP images are allowed");
      clearFile();
      return;
    }

    if (next.size > MAX_BYTES) {
      setServerError("Image must be 5 MB or smaller");
      clearFile();
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    if (!file) {
      setServerError("Photo is required");
      return;
    }

    setIsSaving(true);

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const body = new FormData();
    body.append("file", file);
    body.append("event_description", eventDescription);
    body.append("decoration_style", decorationStyle);
    body.append("location", location);
    body.append("tags", JSON.stringify(tags));

    try {
      const response = await fetch("/api/portfolio/upload", {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as { entry?: PortfolioEntryView } | ApiErrorBody;

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
        clearFile();
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

      <div className="space-y-2">
        <p className="text-sm text-blue-100/80">Photo (required)</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-white/10">
            {previewUrl ? (
              <img src={previewUrl} alt="Selected portfolio photo" className="size-full object-cover" />
            ) : (
              <Camera className="size-8 text-white/40" />
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                handleFileChange(event.target.files?.[0]);
              }}
            />
            <Button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
            >
              {file ? "Change photo" : "Choose photo"}
            </Button>
            <p className="text-xs text-blue-100/60">JPEG, PNG, or WebP up to 5 MB.</p>
          </div>
        </div>
      </div>

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
          "Uploading..."
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
