// Idempotency cache backed by the idempotency_keys table.
// Build Guide §14.1: every mutation accepts an Idempotency-Key header; the
// middleware caches the response for 24h.
//
// Replay semantics:
//   - Same key + same request hash → return cached response
//   - Same key + different hash    → 409 conflict (key reuse)
//   - New key                       → execute, then cache
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CachedResponse {
  status: number;
  body: unknown;
}

/** SHA-256 hex digest of the request body bytes. Used to detect key reuse. */
export async function hashRequest(body: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes =
    typeof body === 'string'
      ? new TextEncoder().encode(body)
      : body instanceof Uint8Array
        ? body
        : new Uint8Array(body);
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type CacheLookup =
  | { kind: 'hit'; response: CachedResponse }
  | { kind: 'conflict' } // same key, different request hash
  | { kind: 'miss' };

/**
 * Look up a cached response for an idempotency key. Returns:
 *   - hit: caller should return the cached response unchanged
 *   - conflict: caller should return 409 conflict
 *   - miss: caller should execute the handler and call cacheResponse
 */
export async function getCachedResponse(
  supabase: SupabaseClient,
  key: string,
  requestHash: string,
): Promise<CacheLookup> {
  const { data, error } = await supabase
    .from('idempotency_keys')
    .select('request_hash, response_status, response_body, expires_at')
    .eq('key', key)
    .maybeSingle();

  if (error) throw new Error(`idempotency_lookup_failed: ${error.message}`);
  if (!data) return { kind: 'miss' };

  // Expired keys are treated as miss; the row will be overwritten on next write.
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { kind: 'miss' };
  }

  if (data.request_hash !== requestHash) return { kind: 'conflict' };
  if (data.response_status === null) return { kind: 'miss' }; // in-flight (rare)

  return {
    kind: 'hit',
    response: { status: data.response_status, body: data.response_body },
  };
}

/**
 * Persist the response under the idempotency key. Overwrites any expired row.
 */
export async function cacheResponse(
  supabase: SupabaseClient,
  key: string,
  organizationId: string | null,
  requestHash: string,
  status: number,
  body: unknown,
  ttlHours: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  const { error } = await supabase.from('idempotency_keys').upsert(
    {
      key,
      organization_id: organizationId,
      request_hash: requestHash,
      response_status: status,
      response_body: body,
      expires_at: expiresAt,
    },
    { onConflict: 'key' },
  );
  if (error) throw new Error(`idempotency_cache_failed: ${error.message}`);
}
