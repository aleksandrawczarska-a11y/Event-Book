import type { APIRoute } from "astro";

import { jsonError } from "@/lib/api-error";
import { parseProfileBody } from "@/lib/profile-schema";
import { createClient } from "@/lib/supabase";
import type { DecoratorProfile } from "@/types";

export const prerender = false;

async function getAuthenticatedClient(context: Parameters<APIRoute>[0]) {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return { error: jsonError("SUPABASE_NOT_CONFIGURED", "Supabase is not configured", 503) } as const;
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: jsonError("AUTH_REQUIRED", "Authentication required", 401) } as const;
  }

  return { supabase, user } as const;
}

function validationFailed(issues: { path: (string | number)[]; message: string }[]) {
  return jsonError("VALIDATION_FAILED", "Invalid profile data", 400, {
    fields: Object.fromEntries(issues.map((issue) => [issue.path.join("."), issue.message])),
  });
}

export const GET: APIRoute = async (context) => {
  const auth = await getAuthenticatedClient(context);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("decorator_profiles")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return jsonError("PROFILE_FETCH_FAILED", "Failed to load profile", 500);
  }

  if (!data) {
    return jsonError("PROFILE_NOT_FOUND", "Profile not found", 404);
  }

  return Response.json({ profile: data as DecoratorProfile });
};

export const POST: APIRoute = async (context) => {
  const auth = await getAuthenticatedClient(context);
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

  const { data: existing } = await auth.supabase
    .from("decorator_profiles")
    .select("id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existing) {
    return jsonError("PROFILE_ALREADY_EXISTS", "Profile already exists; use PUT to update", 409);
  }

  const { data, error } = await auth.supabase
    .from("decorator_profiles")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("*")
    .single();

  if (error) {
    return jsonError("PROFILE_CREATE_FAILED", "Failed to create profile", 500, { detail: error.message });
  }

  return Response.json({ profile: data as DecoratorProfile }, { status: 201 });
};

export const PUT: APIRoute = async (context) => {
  const auth = await getAuthenticatedClient(context);
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

  const { data, error } = await auth.supabase
    .from("decorator_profiles")
    .update(parsed.data)
    .eq("user_id", auth.user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return jsonError("PROFILE_UPDATE_FAILED", "Failed to update profile", 500, { detail: error.message });
  }

  if (!data) {
    return jsonError("PROFILE_NOT_FOUND", "Profile not found", 404);
  }

  return Response.json({ profile: data as DecoratorProfile });
};
