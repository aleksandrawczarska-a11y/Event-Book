import type { APIRoute } from "astro";

import { jsonError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase";

export async function requireAuth(context: Parameters<APIRoute>[0]) {
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

export async function requireDecoratorProfile(supabase: NonNullable<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase.from("decorator_profiles").select("id").eq("user_id", userId).maybeSingle();

  if (error) {
    return { error: jsonError("PROFILE_FETCH_FAILED", "Failed to load profile", 500) } as const;
  }

  if (!data) {
    return {
      error: jsonError("PROFILE_REQUIRED", "Create a decorator profile before managing portfolio", 403),
    } as const;
  }

  return { profileId: data.id as string } as const;
}
