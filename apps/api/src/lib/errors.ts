// Error taxonomy. Build Guide §6.3.
// Hono's app.onError catches async errors automatically — handlers throw,
// the error middleware shapes the wire response.
import type { Context } from 'hono';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly detail?: unknown,
  ) {
    super(code);
    this.name = 'HttpError';
  }
}

export class BadRequest extends HttpError {
  constructor(code = 'bad_request', detail?: unknown) {
    super(400, code, detail);
  }
}
export class Unauthorized extends HttpError {
  constructor(code = 'unauthorized', detail?: unknown) {
    super(401, code, detail);
  }
}
export class Forbidden extends HttpError {
  constructor(code = 'forbidden', detail?: unknown) {
    super(403, code, detail);
  }
}
export class NotFound extends HttpError {
  constructor(code = 'not_found', detail?: unknown) {
    super(404, code, detail);
  }
}
export class Conflict extends HttpError {
  constructor(code = 'conflict', detail?: unknown) {
    super(409, code, detail);
  }
}
export class NotImplemented extends HttpError {
  constructor(code = 'not_implemented', detail?: unknown) {
    super(501, code, detail);
  }
}

interface ErrorResponseBody {
  error: { code: string; detail?: unknown };
}

/**
 * Hono error handler — registered via app.onError. Returns the standard
 * Build Guide §6.5 error shape: { error: { code, detail? } }.
 */
export function errorHandler(err: Error, c: Context): Response {
  const requestId = c.get('requestId') as string | undefined;

  if (err instanceof HttpError) {
    const body: ErrorResponseBody = {
      error: err.detail !== undefined ? { code: err.code, detail: err.detail } : { code: err.code },
    };
    if (requestId) c.header('x-request-id', requestId);
    return c.json(body, err.status as 400 | 401 | 403 | 404 | 409 | 501);
  }

  // Unknown errors: log structured, return generic 500.
  const logger = c.get('logger') as { error: (msg: string, ctx?: unknown) => void } | undefined;
  if (logger) {
    logger.error('unhandled_error', {
      message: err.message,
      stack: err.stack,
    });
  } else {
    console.error('unhandled_error', err);
  }
  if (requestId) c.header('x-request-id', requestId);
  return c.json<ErrorResponseBody>({ error: { code: 'internal_error' } }, 500);
}
