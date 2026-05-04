import { Hono } from 'hono';
import type { AppEnv } from '../app-env';

export const healthRouter = new Hono<AppEnv>();

healthRouter.get('/health', (c) =>
  c.json({
    ok: true,
    version: '0.0.0',
    ts: Date.now(),
  }),
);
