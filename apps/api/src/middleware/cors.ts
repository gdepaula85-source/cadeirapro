// CORS allowlist. Browser dashboard at localhost:5173 (dev) and the
// Cloudflare Pages staging origin (and per-commit previews) talk to the
// Worker. No cookies — auth is via Authorization header — so credentials
// stay off and we don't have to wrestle with the wildcard restriction.
import { cors } from 'hono/cors';

const STAGING_PAGES = 'https://cadeirapro-dashboard.pages.dev';

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return null; // same-origin / curl
    if (origin === 'http://localhost:5173') return origin; // Vite dev
    if (origin === STAGING_PAGES) return origin; // Pages production
    if (origin.endsWith('.cadeirapro-dashboard.pages.dev')) return origin; // Pages branch previews
    return null;
  },
  allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['X-Request-Id'],
  credentials: false,
  maxAge: 600,
});
