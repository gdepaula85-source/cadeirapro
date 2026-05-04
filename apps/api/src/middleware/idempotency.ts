// Opt-in idempotency middleware for mutation routes. Reads Idempotency-Key
// header, looks up cached response in idempotency_keys, and either:
//   - returns the cached response (replay)
//   - returns 409 conflict (key reused with different body)
//   - lets the handler run, then caches the response
//
// Only attach to routes where replay safety matters — sign-up, bookings,
// payments. Cheap reads don't need it.
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app-env';
import { Conflict } from '../lib/errors';
import { supabaseAdmin } from '../lib/supabase';
import { getCachedResponse, cacheResponse, hashRequest } from '../lib/idempotency';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const idempotency: MiddlewareHandler<AppEnv> = async (c, next) => {
  const key = c.req.header('idempotency-key');
  if (!key) {
    // Header is optional on routes that opt in; if absent, just run the handler.
    await next();
    return;
  }
  if (!UUID_RE.test(key)) {
    throw new Conflict('invalid_idempotency_key', { hint: 'must be a UUID' });
  }

  const config = c.get('config');
  const supabase = supabaseAdmin(config);
  const rawBody = await c.req.raw.clone().arrayBuffer();
  const requestHash = await hashRequest(rawBody);

  const lookup = await getCachedResponse(supabase, key, requestHash);
  if (lookup.kind === 'hit') {
    return c.json(lookup.response.body, lookup.response.status as 200);
  }
  if (lookup.kind === 'conflict') {
    throw new Conflict('idempotency_key_reuse');
  }

  await next();

  // Cache only successful 2xx responses. Errors propagate without caching.
  const status = c.res.status;
  if (status >= 200 && status < 300) {
    const body = await c.res
      .clone()
      .json()
      .catch(() => null);
    if (body !== null) {
      const orgId = c.get('user')?.organizationId ?? null;
      await cacheResponse(
        supabase,
        key,
        orgId,
        requestHash,
        status,
        body,
        config.IDEMPOTENCY_TTL_HOURS,
      );
    }
  }
};
