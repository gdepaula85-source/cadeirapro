// Zod-validated env. Workers don't have a "boot" phase — we validate on the
// first request and cache the parsed result per isolate. Throws cleanly via
// the error middleware on any missing/malformed value.
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().min(1).default(24),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  PLATFORM_FEE_DEFAULT_PCT: z.coerce.number().min(0).max(0.1).default(0.005),
  PLATFORM_PIX_KEY: z.string().min(1),
  PLATFORM_PIX_KEY_TYPE: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']),
});

export type Env = z.input<typeof ConfigSchema>;
export type Config = z.output<typeof ConfigSchema>;

let cached: Config | null = null;

/**
 * Parse and cache config per Worker isolate. Subsequent calls in the same
 * isolate skip validation. Throws on malformed input — Hono's onError
 * surfaces it as 500 internal_error.
 */
export function getConfig(env: unknown): Config {
  if (cached) return cached;
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.flatten().fieldErrors;
    throw new Error(`config_invalid: ${JSON.stringify(detail)}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test-only: clear the cached config. */
export function _resetConfigForTests(): void {
  cached = null;
}
