import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Sync, env-based: safe to check before ever touching the (dynamically
// loaded) supabase-js module, so callers can no-op instantly with zero env.
export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (client) return Promise.resolve(client);
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) => {
      client = createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } });
      return client;
    });
  }
  return clientPromise;
}
