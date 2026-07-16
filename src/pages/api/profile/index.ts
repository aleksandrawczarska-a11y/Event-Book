import type { APIRoute } from "astro";

import { requireAuth } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-error";
import { parseProfileBody } from "@/lib/profile-schema";
import type { DecoratorProfile } from "@/types";

export const prerender = false;

function validationFailed(issues: { path: (string | number)[]; message: string }[]) {
  return jsonError("VALIDATION_FAILED", "Invalid profile data", 400, {
    fields: Object.fromEntries(issues.map((issue) => [issue.path.join("."), issue.message])),
  });
}

export const GET: APIRoute = async (context) => {
  const auth = await requireAuth(context);
  if ("error" in auth) {
    return auth.error;
  }

  const profileResult = await auth.supabase
    .from("decorator_profiles")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (profileResult.error) {
    return jsonError("PROFILE_FETCH_FAILED", "Failed to load profile", 500);
  }

  const profile = profileResult.data as DecoratorProfile | null;
  if (!profile) {
    return jsonError("PROFILE_NOT_FOUND", "Profile not found", 404);
  }

  return Response.json({ profile });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireAuth(context);
  if ("error" in auth) {
    return auth.error;
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Request body must be valid JSON", 400);
  }

  const parsed = parseProfileBody(body);
  if (!parsed.success) {
    return validationFailed(parsed.error.issues);
  }

  const existingResult = await auth.supabase
    .from("decorator_profiles")
    .select("id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existingResult.data) {
    return jsonError("PROFILE_ALREADY_EXISTS", "Profile already exists; use PUT to update", 409);
  }

  const insertResult = await auth.supabase
    .from("decorator_profiles")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("*")
    .single();

  if (insertResult.error) {
    return jsonError("PROFILE_CREATE_FAILED", "Failed to create profile", 500);
  }

  return Response.json({ profile: insertResult.data as DecoratorProfile }, { status: 201 });
};

export const PUT: APIRoute = async (context) => {
  const auth = await requireAuth(context);
  if ("error" in auth) {
    return auth.error;
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Request body must be valid JSON", 400);
  }

  const parsed = parseProfileBody(body);
  if (!parsed.success) {
    return validationFailed(parsed.error.issues);
  }

  const updateResult = await auth.supabase
    .from("decorator_profiles")
    .update(parsed.data)
    .eq("user_id", auth.user.id)
    .select("*")
    .maybeSingle();

  if (updateResult.error) {
    return jsonError("PROFILE_UPDATE_FAILED", "Failed to update profile", 500);
  }

  const profile = updateResult.data as DecoratorProfile | null;
  if (!profile) {
    return jsonError("PROFILE_NOT_FOUND", "Profile not found", 404);
  }

  return Response.json({ profile });
};
