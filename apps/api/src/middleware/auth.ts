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
import type { AppEnv, AuthUser } from '../app-env';
import { Unauthorized, Forbidden } from '../lib/errors';
import { supabaseAnon } from '../lib/supabase';

interface JwtPayload {
  sub?: string;
  email?: string;
  organization_id?: string;
  role?: 'owner' | 'barber' | 'staff';
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

  const user: AuthUser = {
    id: data.user.id,
    email: data.user.email ?? '',
    organizationId: payload.organization_id,
    role: payload.role ?? null,
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
