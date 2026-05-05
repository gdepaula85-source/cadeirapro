// Shared Hono context types. Imported by middleware, route handlers, and the
// app entrypoint so `c.get('logger')` etc. is fully typed.
import type { Env, Config } from './config';
import type { Logger } from './lib/logger';

export interface AuthUser {
  id: string;
  email: string;
  organizationId: string | null;
  role: 'owner' | 'barber' | 'staff' | null;
  accessToken: string;
}

/**
 * Authenticated customer (per migration 0004). The JWT carries `role='customer'`
 * but no `organization_id` claim — the middleware looks up the linked
 * `clients` row server-side and attaches the resolved IDs here.
 */
export interface AuthCustomer {
  authUserId: string;
  email: string;
  clientId: string;
  organizationId: string;
  accessToken: string;
}

export interface AppEnv {
  Bindings: Env;
  Variables: {
    requestId: string;
    logger: Logger;
    config: Config;
    user?: AuthUser;
    customer?: AuthCustomer;
  };
}
