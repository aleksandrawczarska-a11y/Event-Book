import React, { useState } from "react";
import { Building2, Globe, Mail, MapPin, Phone, Save, User } from "lucide-react";

import { ServerError } from "@/components/auth/ServerError";
import { FormField } from "@/components/forms/FormField";
import { ProfileAvatarUpload } from "@/components/decorator/ProfileAvatarUpload";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiErrorBody } from "@/lib/api-error";
import type { DecoratorProfile } from "@/types";

interface Props {
  initialProfile: DecoratorProfile | null;
  eventTypeOptions: readonly string[];
  decorationStyleOptions: readonly string[];
}

interface FormState {
  company_name: string;
  city: string;
  description: string;
  instagram_url: string;
  contact_email: string;
  contact_phone: string;
  event_types: string[];
  decoration_styles: string[];
  is_published: boolean;
}

function toFormState(profile: DecoratorProfile | null): FormState {
  return {
    company_name: profile?.company_name ?? "",
    city: profile?.city ?? "",
    description: profile?.description ?? "",
    instagram_url: profile?.instagram_url ?? "",
    contact_email: profile?.contact_email ?? "",
    contact_phone: profile?.contact_phone ?? "",
    event_types: profile?.event_types ?? [],
    decoration_styles: profile?.decoration_styles ?? [],
    is_published: profile?.is_published ?? false,
  };
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function ProfileForm({ initialProfile, eventTypeOptions, decorationStyleOptions }: Props) {
  const [form, setForm] = useState<FormState>(() => toFormState(initialProfile));
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialProfile?.profile_photo_url ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(initialProfile !== null);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) {
        return prev;
      }
      return Object.fromEntries(Object.entries(prev).filter(([field]) => field !== key));
    });
    setSuccessMessage(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setServerError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const method = hasProfile ? "PUT" : "POST";

    try {
      const response = await fetch("/api/profile", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as { profile?: DecoratorProfile } | ApiErrorBody;

      if (!response.ok) {
        const apiError = "error" in payload ? payload.error : null;
        if (apiError?.code === "VALIDATION_FAILED") {
          const fields = apiError.context.fields;
          if (fields && typeof fields === "object") {
            const nextErrors: Record<string, string> = {};
            for (const [key, message] of Object.entries(fields)) {
              if (typeof message === "string") {
                nextErrors[key] = message;
              }
            }
            setFieldErrors(nextErrors);
          }
        }
        setServerError(apiError?.message ?? "Failed to save profile");
        return;
      }

      if ("profile" in payload && payload.profile) {
        setForm(toFormState(payload.profile));
        setHasProfile(true);
        setSuccessMessage(payload.profile.is_published ? "Profile published." : "Profile saved as draft.");
      }
    } catch {
      setServerError("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <ProfileAvatarUpload
        photoUrl={photoUrl}
        disabled={!hasProfile}
        onUploaded={(profile) => {
          setPhotoUrl(profile.profile_photo_url);
          setSuccessMessage("Profile photo updated.");
          setServerError(null);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="company_name"
          label="Company name"
          value={form.company_name}
          onChange={(value) => {
            updateField("company_name", value);
          }}
          placeholder="Your company name"
          error={fieldErrors.company_name}
          icon={<Building2 className="size-4" />}
        />
        <FormField
          id="city"
          label="City"
          value={form.city}
          onChange={(value) => {
            updateField("city", value);
          }}
          placeholder="Warsaw"
          error={fieldErrors.city}
          icon={<MapPin className="size-4" />}
        />
      </div>

      <FormField
        id="description"
        label="Description"
        value={form.description}
        onChange={(value) => {
          updateField("description", value);
        }}
        placeholder="Tell clients about your style and services"
        error={fieldErrors.description}
        icon={<User className="size-4" />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="contact_email"
          label="Contact email"
          type="email"
          value={form.contact_email}
          onChange={(value) => {
            updateField("contact_email", value);
          }}
          placeholder="you@company.com"
          error={fieldErrors.contact_email}
          icon={<Mail className="size-4" />}
        />
        <FormField
          id="contact_phone"
          label="Contact phone"
          value={form.contact_phone}
          onChange={(value) => {
            updateField("contact_phone", value);
          }}
          placeholder="+48 ..."
          error={fieldErrors.contact_phone}
          icon={<Phone className="size-4" />}
        />
      </div>

      <FormField
        id="instagram_url"
        label="Instagram URL"
        value={form.instagram_url}
        onChange={(value) => {
          updateField("instagram_url", value);
        }}
        placeholder="https://instagram.com/..."
        error={fieldErrors.instagram_url}
        icon={<Globe className="size-4" />}
      />

      <fieldset className="space-y-3">
        <legend className="text-sm text-blue-100/80">Event types</legend>
        <div className="flex flex-wrap gap-2">
          {eventTypeOptions.map((option) => (
            <label
              key={option}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors",
                form.event_types.includes(option)
                  ? "border-purple-400/60 bg-purple-500/20 text-white"
                  : "border-white/20 bg-white/5 text-blue-100/80 hover:bg-white/10",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={form.event_types.includes(option)}
                onChange={() => {
                  updateField("event_types", toggleValue(form.event_types, option));
                }}
              />
              {option}
            </label>
          ))}
        </div>
        {fieldErrors.event_types ? <p className="text-xs text-red-300">{fieldErrors.event_types}</p> : null}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm text-blue-100/80">Decoration styles</legend>
        <div className="flex flex-wrap gap-2">
          {decorationStyleOptions.map((option) => (
            <label
              key={option}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors",
                form.decoration_styles.includes(option)
                  ? "border-purple-400/60 bg-purple-500/20 text-white"
                  : "border-white/20 bg-white/5 text-blue-100/80 hover:bg-white/10",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={form.decoration_styles.includes(option)}
                onChange={() => {
                  updateField("decoration_styles", toggleValue(form.decoration_styles, option));
                }}
              />
              {option}
            </label>
          ))}
        </div>
        {fieldErrors.decoration_styles ? <p className="text-xs text-red-300">{fieldErrors.decoration_styles}</p> : null}
      </fieldset>

      <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <input
          type="checkbox"
          checked={form.is_published}
          onChange={(event) => {
            updateField("is_published", event.target.checked);
          }}
          className="mt-1 size-4 rounded border-white/20 bg-white/10"
        />
        <span>
          <span className="block text-sm font-medium text-white">Publish profile</span>
          <span className="mt-1 block text-sm text-blue-100/70">
            Requires company name, city, description, and contact email. Published profiles are visible to clients.
          </span>
        </span>
      </label>

      <ServerError message={serverError} />

      {successMessage ? (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {successMessage}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={isSaving}
        onClick={() => {
          void handleSave();
        }}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
      >
        {isSaving ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Saving...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Save className="size-4" />
            Save profile
          </span>
        )}
      </Button>
    </div>
  );
}
