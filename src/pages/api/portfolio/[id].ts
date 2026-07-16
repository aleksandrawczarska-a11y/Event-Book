import type { APIRoute } from "astro";

import { requireAuth, requireDecoratorProfile } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";

export const prerender = false;

export const DELETE: APIRoute = async (context) => {
  const auth = await requireAuth(context);
  if ("error" in auth) {
    return auth.error;
  }

  const profile = await requireDecoratorProfile(auth.supabase, auth.user.id);
  if ("error" in profile) {
    return profile.error;
  }

  const id = context.params.id;
  if (!id) {
    return jsonError("VALIDATION_FAILED", "Portfolio entry id is required", 400);
  }

  const existing = await auth.supabase
    .from("portfolio_entries")
    .select("id, storage_path")
    .eq("id", id)
    .eq("decorator_profile_id", profile.profileId)
    .maybeSingle();

  if (existing.error) {
    return jsonError("PORTFOLIO_DELETE_FAILED", "Failed to delete portfolio entry", 500, {
      detail: existing.error.message,
    });
  }

  if (!existing.data) {
    return jsonError("PORTFOLIO_NOT_FOUND", "Portfolio entry not found", 404);
  }

  const storagePath = existing.data.storage_path as string;

  const { error } = await auth.supabase
    .from("portfolio_entries")
    .delete()
    .eq("id", id)
    .eq("decorator_profile_id", profile.profileId);

  if (error) {
    return jsonError("PORTFOLIO_DELETE_FAILED", "Failed to delete portfolio entry", 500, {
      detail: error.message,
    });
  }

  if (storagePath && !storagePath.startsWith("pending/")) {
    await auth.supabase.storage.from("portfolio").remove([storagePath]);
  }

  return Response.json({ ok: true });
};
