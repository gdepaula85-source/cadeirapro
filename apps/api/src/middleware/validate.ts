// Wrap @hono/zod-validator so validation failures return our standard error
// shape (Build Guide §6.5) instead of zod-validator's default.
import { zValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';
import { BadRequest } from '../lib/errors';

type Target = 'json' | 'query' | 'param' | 'header' | 'form';

export function validate<S extends ZodSchema>(target: Target, schema: S) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new BadRequest('validation_failed', result.error.flatten());
    }
  });
}
