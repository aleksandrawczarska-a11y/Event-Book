import type { APIRoute } from "astro";

import { requireAuth } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { resolveProfilePhotoUrl } from "@/lib/profile-photo";
import type { DecoratorProfile } from "@/types";

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export const POST: APIRoute = async (context) => {
  const auth = await requireAuth(context);
  if ("error" in auth) {
    return auth.error;
  }

  const { data: existingProfile, error: profileLookupError } = await auth.supabase
    .from("decorator_profiles")
    .select("id")
    .eq("user_id", auth.user.id)
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

  const objectPath = `${auth.user.id}/avatar.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await auth.supabase.storage.from("profiles").upload(objectPath, bytes, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return jsonError("AVATAR_UPLOAD_FAILED", "Failed to upload avatar", 500);
  }

  const updateResult = await auth.supabase
    .from("decorator_profiles")
    .update({ profile_photo_url: objectPath })
    .eq("user_id", auth.user.id)
    .select("*")
    .maybeSingle();

  if (updateResult.error) {
    await auth.supabase.storage.from("profiles").remove([objectPath]);
    return jsonError("PROFILE_UPDATE_FAILED", "Failed to update profile photo URL", 500);
  }

  const profile = updateResult.data as DecoratorProfile | null;

  if (!profile) {
    await auth.supabase.storage.from("profiles").remove([objectPath]);
    return jsonError("PROFILE_NOT_FOUND", "Profile not found", 404);
  }

  const { data: siblings } = await auth.supabase.storage.from("profiles").list(auth.user.id, {
    search: "avatar.",
  });
  const stalePaths = (siblings ?? [])
    .map((item) => item.name)
    .filter((name) => name.startsWith("avatar.") && name !== `avatar.${extension}`)
    .map((name) => `${auth.user.id}/${name}`);
  if (stalePaths.length > 0) {
    await auth.supabase.storage.from("profiles").remove(stalePaths);
  }

  const displayUrl = await resolveProfilePhotoUrl(auth.supabase, profile.profile_photo_url);

  return Response.json({
    profile: {
      ...profile,
      profile_photo_url: displayUrl,
    },
  });
};
