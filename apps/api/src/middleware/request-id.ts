// Per-request setup: parse config, derive request id, attach scoped logger.
// Runs before every other middleware.
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app-env';
import { getConfig } from '../config';
import { createLogger } from '../lib/logger';

export const requestId: MiddlewareHandler<AppEnv> = async (c, next) => {
  const config = getConfig(c.env);
  const incoming = c.req.header('x-request-id');
  const id = incoming && incoming.length <= 64 ? incoming : crypto.randomUUID();

  const logger = createLogger(config.LOG_LEVEL, {
    request_id: id,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
  });

  c.set('requestId', id);
  c.set('config', config);
  c.set('logger', logger);
  c.header('x-request-id', id);

  const start = Date.now();
  await next();
  logger.info('request', { status: c.res.status, duration_ms: Date.now() - start });
};
