import { createServerClient, parseCookieHeader, type CookieMethodsServer } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";

export function isSupabaseConfigured(url: string | undefined, key: string | undefined): boolean {
  if (!url || !key || url === "###" || key === "###") {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  const url = SUPABASE_URL;
  const key = SUPABASE_KEY;
  if (!isSupabaseConfigured(url, key) || !url || !key) {
    return null;
  }

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return parseCookieHeader(requestHeaders.get("Cookie") ?? "").map(({ name, value }) => ({
        name,
        value: value ?? "",
      }));
    },
    setAll(cookiesToSet, _headers) {
      for (const { name, value, options } of cookiesToSet) {
        cookies.set(name, value, options);
      }
    },
  };

  return createServerClient(url, key, {
    cookies: cookieMethods,
  });
}
