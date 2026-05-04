// Structured-JSON logger for Workers Logs. Emits one JSON line per call.
// Build Guide §14.2: redact authorization, api_key, access_token, password,
// pix_key, cpf, cnpj. We deep-redact via a recursive walk on logged context.
//
// This is the canonical sink for app output — direct console.* calls are
// banned elsewhere. Disable the rule here only.
/* eslint-disable no-console */

const REDACT_KEYS = new Set<string>([
  'authorization',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'password',
  'pix_key',
  'pixkey',
  'cpf',
  'cnpj',
  'cpf_or_cnpj',
  'service_role_key',
  'supabase_service_role_key',
]);

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof LEVELS;

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v);
  }
  return out;
}

class JsonLogger implements Logger {
  constructor(
    private readonly minLevel: LogLevel,
    private readonly bindings: Record<string, unknown>,
  ) {}

  private emit(level: LogLevel, msg: string, ctx?: Record<string, unknown>): void {
    if (LEVELS[level] < LEVELS[this.minLevel]) return;
    const line = {
      level,
      msg,
      ts: new Date().toISOString(),
      ...this.bindings,
      ...(ctx ? (redact(ctx) as Record<string, unknown>) : {}),
    };
    // Workers Logs picks up console.log/info/warn/error as structured events.
    // Use the matching console method so severity is preserved.
    const sink: (...args: unknown[]) => void =
      level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    sink(JSON.stringify(line));
  }

  debug(msg: string, ctx?: Record<string, unknown>): void {
    this.emit('debug', msg, ctx);
  }
  info(msg: string, ctx?: Record<string, unknown>): void {
    this.emit('info', msg, ctx);
  }
  warn(msg: string, ctx?: Record<string, unknown>): void {
    this.emit('warn', msg, ctx);
  }
  error(msg: string, ctx?: Record<string, unknown>): void {
    this.emit('error', msg, ctx);
  }

  child(bindings: Record<string, unknown>): Logger {
    return new JsonLogger(this.minLevel, { ...this.bindings, ...bindings });
  }
}

export function createLogger(level: LogLevel, bindings: Record<string, unknown> = {}): Logger {
  return new JsonLogger(level, bindings);
}
