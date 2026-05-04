// POST /v1/auth/sign-up — SPRINT_1 §6.
// Demo critical path: sign-up → email verify → land on dashboard.
import { Hono } from 'hono';
import { SignUpInputSchema } from '@cadeirapro/shared';
import type { AppEnv } from '../app-env';
import { idempotency } from '../middleware/idempotency';
import { validate } from '../middleware/validate';
import { supabaseAdmin } from '../lib/supabase';
import { signUp } from '../services/auth/sign-up';

export const authRouter = new Hono<AppEnv>();

authRouter.post('/v1/auth/sign-up', idempotency, validate('json', SignUpInputSchema), async (c) => {
  const input = c.req.valid('json');
  const config = c.get('config');
  const logger = c.get('logger');

  const result = await signUp(input, {
    supabaseAdmin: supabaseAdmin(config),
    platformFeeDefaultPct: config.PLATFORM_FEE_DEFAULT_PCT,
    logger,
  });

  return c.json({ data: result }, 201);
});
