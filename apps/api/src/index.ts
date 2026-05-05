// CadeiraPro API — Hono on Cloudflare Workers.
// Build Guide §6 (conventions), SPRINT_1 §4 (route inventory for S1).
import { Hono } from 'hono';
import type { AppEnv } from './app-env';
import { requestId } from './middleware/request-id';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './lib/errors';
import { healthRouter } from './routes/health';
import { meRouter } from './routes/me';
import { authRouter } from './routes/auth';
import { servicesRouter } from './routes/services';
import { clientsRouter } from './routes/clients';
import { staffRouter } from './routes/staff';
import { bookingsRouter } from './routes/bookings';
import { availabilityRouter } from './routes/availability';
import { organizationRouter } from './routes/organization';
import { scheduleBlocksRouter } from './routes/schedule-blocks';
import { dashboardRouter } from './routes/dashboard';
import { publicRouter } from './routes/public';

const app = new Hono<AppEnv>();

// CORS first — short-circuits OPTIONS preflight so it never reaches the
// rest of the middleware chain.
app.use('*', corsMiddleware);

// Global middleware — request id, logger, config parse.
app.use('*', requestId);

// Routes — composed from per-feature routers.
app.route('/', healthRouter);
app.route('/', meRouter);
app.route('/', authRouter);
app.route('/', servicesRouter);
app.route('/', clientsRouter);
app.route('/', staffRouter);
app.route('/', bookingsRouter);
app.route('/', availabilityRouter);
app.route('/', organizationRouter);
app.route('/', scheduleBlocksRouter);
app.route('/', dashboardRouter);
app.route('/', publicRouter);

// 404 fallback.
app.notFound((c) => c.json({ error: { code: 'not_found' } }, 404));

// Error handler — last, catches HttpError and unknowns.
app.onError(errorHandler);

export default app;
