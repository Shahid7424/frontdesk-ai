import "server-only";
import type { Database } from "@frontdesk/db";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Client acting as the signed-in user. Every query runs through RLS, so a
 * bug in our code still can't read another business's rows.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Fine: middleware refreshes the session on the next request.
        }
      },
    },
  });
}

/**
 * Service-role client that bypasses RLS. Only for trusted server paths that
 * have no user session (widget API, webhooks), and they must always filter
 * by an explicit business_id.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createAdminClient<Database>(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
