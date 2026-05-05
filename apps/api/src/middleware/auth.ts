// Authentication middleware. Build Guide §5.4 ported to Hono.
//
// requireAuth:
//   - reads Authorization: Bearer <token>
//   - validates the token via supabaseAnon.auth.getUser (signature + expiry)
//   - decodes the JWT payload for organization_id and role custom claims
//   - attaches AuthUser to c.set('user', ...)
//
// JWT-claims race: the dashboard MUST call supabase.auth.refreshSession()
// after sign-up + email verification. A JWT minted before the profile row
// existed will lack organization_id; we surface that as 401 with a specific
// detail so the client can refresh-and-retry.
import type { MiddlewareHandler } from 'hono';
import type { AppEnv, AuthUser, AuthCustomer } from '../app-env';
import { Unauthorized, Forbidden } from '../lib/errors';
import { supabaseAnon, supabaseAdmin } from '../lib/supabase';

interface JwtPayload {
  sub?: string;
  email?: string;
  organization_id?: string;
  role?: 'owner' | 'barber' | 'staff' | 'customer';
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload {
  const segments = token.split('.');
  if (segments.length !== 3) throw new Unauthorized('invalid_token');
  const [, payloadB64] = segments;
  if (!payloadB64) throw new Unauthorized('invalid_token');
  // URL-safe base64 → standard base64 → atob.
  const padded = payloadB64
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), '=');
  try {
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    throw new Unauthorized('invalid_token');
  }
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new Unauthorized('unauthorized');
  }
  const token = header.slice(7).trim();
  if (!token) throw new Unauthorized('unauthorized');

  const config = c.get('config');
  const { data, error } = await supabaseAnon(config).auth.getUser(token);
  if (error || !data.user) throw new Unauthorized('unauthorized');

  const payload = decodeJwtPayload(token);

  // The custom-claims hook runs in Supabase Auth; if the user just signed up
  // and hasn't refreshed, organization_id may be missing. Specific code so
  // the dashboard knows to refreshSession() and retry once.
  if (!payload.organization_id) {
    throw new Unauthorized('claims_missing', {
      hint: 'JWT lacks organization_id; call supabase.auth.refreshSession() and retry',
    });
  }

  // requireAuth is for owner/staff/barber. Customer JWTs (role='customer')
  // would have failed the organization_id check above, so payload.role here
  // should never be 'customer' — the filter is belt-and-braces.
  const ownerRole =
    payload.role && payload.role !== 'customer' ? payload.role : null;
  const user: AuthUser = {
    id: data.user.id,
    email: data.user.email ?? '',
    organizationId: payload.organization_id,
    role: ownerRole,
    accessToken: token,
  };
  c.set('user', user);

  await next();
};

export function requireRole(
  ...roles: Array<'owner' | 'barber' | 'staff'>
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) throw new Unauthorized();
    if (!user.role || !roles.includes(user.role)) {
      throw new Forbidden('forbidden', { required: roles, got: user.role });
    }
    await next();
  };
}

/**
 * Customer-side auth — gates /v1/customer/* endpoints. Per migration 0004,
 * customer JWTs carry role='customer' but no organization_id. We look up
 * the linked clients row server-side to resolve the org and client id.
 */
export const requireCustomerAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new Unauthorized('unauthorized');
  }
  const token = header.slice(7).trim();
  if (!token) throw new Unauthorized('unauthorized');

  const config = c.get('config');
  const { data: authData, error: authErr } = await supabaseAnon(config).auth.getUser(token);
  if (authErr || !authData.user) throw new Unauthorized('unauthorized');

  const payload = decodeJwtPayload(token);
  if (payload.role !== 'customer') {
    throw new Forbidden('not_a_customer', { hint: 'this endpoint is for customer accounts only' });
  }

  // Resolve the clients row. service_role used here because clients RLS
  // requires either current_org_id() (which customers don't have) or the
  // self-policy (which we'd add in a follow-up RLS lockdown commit).
  const admin = supabaseAdmin(config);
  const { data, error } = await admin
    .from('clients')
    .select('id, organization_id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();
  if (error) throw new Error(`customer_lookup_failed: ${error.message}`);
  if (!data) {
    // The hook gave them a customer claim but the clients row vanished —
    // this can only happen if a shop owner deleted the clients row after
    // the user signed up. Treat as session-invalid.
    throw new Unauthorized('customer_unlinked', { hint: 'sign in again to relink' });
  }

  const customer: AuthCustomer = {
    authUserId: authData.user.id,
    email: authData.user.email ?? '',
    clientId: data.id as string,
    organizationId: data.organization_id as string,
    accessToken: token,
  };
  c.set('customer', customer);

  await next();
};
