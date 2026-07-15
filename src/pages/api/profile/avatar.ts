import type { APIRoute } from "astro";

import { jsonError } from "@/lib/api-error";
import { resolveProfilePhotoUrl } from "@/lib/profile-photo";
import { createClient } from "@/lib/supabase";
import type { DecoratorProfile } from "@/types";

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase is not configured", 503);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("AUTH_REQUIRED", "Authentication required", 401);
  }

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("decorator_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileLookupError) {
    return jsonError("PROFILE_FETCH_FAILED", "Failed to load profile", 500);
  }

  if (!existingProfile) {
    return jsonError("PROFILE_NOT_FOUND", "Create a profile before uploading an avatar", 404);
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

  const objectPath = `${user.id}/avatar.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from("profiles").upload(objectPath, bytes, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return jsonError("AVATAR_UPLOAD_FAILED", "Failed to upload avatar", 500, {
      detail: uploadError.message,
    });
  }

  const updateResult = await supabase
    .from("decorator_profiles")
    .update({ profile_photo_url: objectPath })
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (updateResult.error) {
    return jsonError("PROFILE_UPDATE_FAILED", "Failed to update profile photo URL", 500, {
      detail: updateResult.error.message,
    });
  }

  const profile = updateResult.data as DecoratorProfile | null;

  if (!profile) {
    return jsonError("PROFILE_NOT_FOUND", "Profile not found", 404);
  }

  const displayUrl = await resolveProfilePhotoUrl(supabase, profile.profile_photo_url);

  return Response.json({
    profile: {
      ...profile,
      profile_photo_url: displayUrl,
    },
  });
};
