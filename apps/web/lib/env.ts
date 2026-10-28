/**
 * Supabase is optional while developing the UI: without keys the app runs
 * in demo mode (mock data, no login). With keys, auth and RLS are enforced.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
