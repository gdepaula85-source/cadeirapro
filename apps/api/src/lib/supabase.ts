// Supabase client factories. Workers don't have process.env, so each factory
// takes the parsed Config at call time.
//
// Three flavours:
//   supabaseAdmin(c)   — service-role; bypasses RLS. Use for trusted writes.
//   supabaseAnon(c)    — anon; for unauthenticated reads & auth.getUser().
//   supabaseAsUser(c, accessToken) — anon key + user's Bearer token; RLS
//                        applies as the user. Use for /v1/me and other
//                        read-on-behalf-of-user paths.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from '../config';

const ADMIN_OPTS = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

export function supabaseAdmin(config: Config): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, ADMIN_OPTS);
}

export function supabaseAnon(config: Config): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, ADMIN_OPTS);
}

export function supabaseAsUser(config: Config, accessToken: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    ...ADMIN_OPTS,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
