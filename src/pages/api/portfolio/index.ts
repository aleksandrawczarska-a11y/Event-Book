import type { APIRoute } from "astro";

import { requireAuth, requireDecoratorProfile } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { parsePortfolioEntryBody } from "@/lib/portfolio-schema";
import type { PortfolioEntry } from "@/types";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireAuth(context);
  if ("error" in auth) {
    return auth.error;
  }

  const profile = await requireDecoratorProfile(auth.supabase, auth.user.id);
  if ("error" in profile) {
    return profile.error;
  }

  const { data, error } = await auth.supabase
    .from("portfolio_entries")
    .select("*")
    .eq("decorator_profile_id", profile.profileId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return jsonError("PORTFOLIO_FETCH_FAILED", "Failed to load portfolio entries", 500);
  }

  return Response.json({ entries: data as PortfolioEntry[] });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireAuth(context);
  if ("error" in auth) {
    return auth.error;
  }

  const profile = await requireDecoratorProfile(auth.supabase, auth.user.id);
  if ("error" in profile) {
    return profile.error;
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Request body must be valid JSON", 400);
  }

  const parsed = parsePortfolioEntryBody(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Invalid portfolio entry data", 400, {
      fields: Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message])),
    });
  }

  const storagePath = parsed.data.storage_path;
  const userPrefix = `${auth.user.id}/`;
  if (storagePath.startsWith("pending/") || !storagePath.startsWith(userPrefix)) {
    return jsonError(
      "VALIDATION_FAILED",
      "storage_path must be an uploaded object under your user folder; use POST /api/portfolio/upload for new entries",
      400,
      { fields: { storage_path: "Must start with your user id and must not use pending/ placeholders" } },
    );
  }

  const entryId = crypto.randomUUID();

  const insertResult = await auth.supabase
    .from("portfolio_entries")
    .insert({
      id: entryId,
      decorator_profile_id: profile.profileId,
      storage_path: storagePath,
      event_description: parsed.data.event_description,
      decoration_style: parsed.data.decoration_style,
      location: parsed.data.location,
      tags: parsed.data.tags,
    })
    .select("*")
    .single();

  if (insertResult.error) {
    return jsonError("PORTFOLIO_CREATE_FAILED", "Failed to create portfolio entry", 500);
  }

  return Response.json({ entry: insertResult.data as PortfolioEntry }, { status: 201 });
};
