import type { APIRoute } from "astro";

import { requireAuth, requireDecoratorProfile } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { getPortfolioImageUrl } from "@/lib/storage-url";
import type { PortfolioEntry } from "@/types";

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  } catch {
    // comma-separated fallback
  }

  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function optionalFormText(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export const POST: APIRoute = async (context) => {
  const auth = await requireAuth(context);
  if ("error" in auth) {
    return auth.error;
  }

  const profile = await requireDecoratorProfile(auth.supabase, auth.user.id);
  if ("error" in profile) {
    return profile.error;
  }

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return jsonError("VALIDATION_FAILED", "Expected multipart form data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("VALIDATION_FAILED", "Image file is required", 400, { field: "file" });
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return jsonError("VALIDATION_FAILED", "Image must be between 1 byte and 5 MB", 400, {
      field: "file",
      maxBytes: MAX_BYTES,
    });
  }

  const extension = ALLOWED_MIME.get(file.type);
  if (!extension) {
    return jsonError("VALIDATION_FAILED", "Only JPEG, PNG, and WebP images are allowed", 400, {
      field: "file",
      mimeType: file.type,
    });
  }

  const entryId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || `photo.${extension}`;
  const objectPath = `${auth.user.id}/${entryId}/${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await auth.supabase.storage.from("portfolio").upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return jsonError("PORTFOLIO_UPLOAD_FAILED", "Failed to upload portfolio photo", 500);
  }

  const insertResult = await auth.supabase
    .from("portfolio_entries")
    .insert({
      id: entryId,
      decorator_profile_id: profile.profileId,
      storage_path: objectPath,
      event_description: optionalFormText(form.get("event_description")),
      decoration_style: optionalFormText(form.get("decoration_style")),
      location: optionalFormText(form.get("location")),
      tags: parseTags(form.get("tags")),
    })
    .select("*")
    .single();

  if (insertResult.error) {
    await auth.supabase.storage.from("portfolio").remove([objectPath]);
    return jsonError("PORTFOLIO_CREATE_FAILED", "Failed to create portfolio entry", 500);
  }

  const entry = insertResult.data as PortfolioEntry;
  const imageUrl = await getPortfolioImageUrl(auth.supabase, entry.storage_path);

  return Response.json({ entry: { ...entry, image_url: imageUrl } }, { status: 201 });
};
