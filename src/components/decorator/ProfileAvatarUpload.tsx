import React, { useRef, useState } from "react";
import { Camera, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ApiErrorBody } from "@/lib/api-error";
import type { DecoratorProfile } from "@/types";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface Props {
  photoUrl: string | null;
  disabled?: boolean;
  onUploaded: (profile: DecoratorProfile) => void;
}

export function ProfileAvatarUpload({ photoUrl, disabled = false, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(photoUrl);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(file: File | undefined) {
    setError(null);

    if (!file) {
      return;
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Only JPEG, PNG, and WebP images are allowed");
      return;
    }

    if (file.size > MAX_BYTES) {
      setError("Image must be 5 MB or smaller");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setIsUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as { profile?: DecoratorProfile } | ApiErrorBody;

      if (!response.ok) {
        const message = "error" in payload ? payload.error.message : "Failed to upload avatar";
        setError(message);
        setPreviewUrl(photoUrl);
        return;
      }

      if ("profile" in payload && payload.profile) {
        setPreviewUrl(payload.profile.profile_photo_url);
        onUploaded(payload.profile);
      }
    } catch {
      setError("Failed to upload avatar");
      setPreviewUrl(photoUrl);
    } finally {
      URL.revokeObjectURL(localPreview);
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
        {previewUrl ? (
          <img src={previewUrl} alt="Profile avatar" className="size-full object-cover" />
        ) : (
          <Camera className="size-8 text-white/40" />
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-white">Profile photo</p>
        <p className="text-xs text-blue-100/60">JPEG, PNG, or WebP up to 5 MB.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled || isUploading}
          onChange={(event) => {
            void handleFileChange(event.target.files?.[0]);
          }}
        />
        <Button
          type="button"
          disabled={disabled || isUploading}
          onClick={() => {
            inputRef.current?.click();
          }}
          className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
        >
          {isUploading ? "Uploading..." : previewUrl ? "Change photo" : "Upload photo"}
        </Button>
        {disabled ? <p className="text-xs text-amber-200/80">Save your profile first, then upload a photo.</p> : null}
        {error ? (
          <p className="flex items-center gap-1 text-xs text-red-300">
            <CircleAlert className="size-3" />
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
