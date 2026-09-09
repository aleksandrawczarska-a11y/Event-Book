import type { APIRoute } from "astro";

import { requireAdmin } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import type { ModerationStatus } from "@/types";

export const prerender = false;

const ALLOWED_STATUSES: ModerationStatus[] = ["approved", "rejected"];

export const PATCH: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ("error" in auth) {
    return auth.error;
  }

  const id = context.params.id;
  if (!id) {
    return jsonError("VALIDATION_FAILED", "Portfolio entry id is required", 400);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Request body must be valid JSON", 400);
  }

  const moderationStatus =
    typeof body === "object" && body !== null && "moderation_status" in body ? body.moderation_status : undefined;

  if (typeof moderationStatus !== "string" || !ALLOWED_STATUSES.includes(moderationStatus as ModerationStatus)) {
    return jsonError("VALIDATION_FAILED", "moderation_status must be approved or rejected", 400, {
      fields: { moderation_status: "Must be approved or rejected" },
    });
  }

  const status = moderationStatus as Exclude<ModerationStatus, "pending">;

  const existing = await auth.supabase.from("portfolio_entries").select("id").eq("id", id).maybeSingle();

  if (existing.error) {
    return jsonError("MODERATION_UPDATE_FAILED", "Failed to update moderation status", 500);
  }

  if (!existing.data) {
    return jsonError("PORTFOLIO_NOT_FOUND", "Portfolio entry not found", 404);
  }

  const updateResult = await auth.supabase.from("portfolio_entries").update({ moderation_status: status }).eq("id", id);

  if (updateResult.error) {
    return jsonError("MODERATION_UPDATE_FAILED", "Failed to update moderation status", 500);
  }

  return Response.json({ entry: { id, moderation_status: status } });
};
