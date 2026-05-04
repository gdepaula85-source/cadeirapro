// Typed HTTP client for the CadeiraPro API. Build Guide §9.3.
// Adds Authorization (when a session is present), per-mutation Idempotency-Key,
// and the §6 JWT-claims-race retry-once-after-refreshSession defence.
import { v4 as uuid } from 'uuid';
import { supabase } from './supabase';
import type {
  Client,
  CreateClientInput,
  CreateServiceInput,
  CreateStaffInput,
  Me,
  Service,
  SignUpInput,
  Staff,
  UpdateClientInput,
  UpdateServiceInput,
  UpdateStaffInput,
} from '@cadeirapro/shared';

const BASE = import.meta.env.VITE_API_BASE;
if (!BASE) throw new Error('VITE_API_BASE must be set');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly detail?: unknown,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

interface RequestOpts {
  /** Auto-attach a fresh UUID Idempotency-Key for mutation routes. */
  idempotent?: boolean;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOpts = {},
  isRetry = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  };
  if (opts.idempotent) headers['Idempotency-Key'] = uuid();

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json: { data?: unknown; error?: { code: string; detail?: unknown } } = {};
  try {
    json = await res.json();
  } catch {
    /* tolerate empty body */
  }

  if (res.ok) return json.data as T;

  const code = json.error?.code ?? 'unknown';

  // §6 JWT-claims-race defence-in-depth: if the API rejects with
  // claims_missing, refresh the session once and retry the same request.
  if (!isRetry && res.status === 401 && code === 'claims_missing') {
    await supabase.auth.refreshSession();
    return request<T>(method, path, body, opts, true);
  }

  throw new ApiError(res.status, code, json.error?.detail);
}

export const api = {
  me: () => request<Me>('GET', '/v1/me'),
  signUp: (input: SignUpInput) =>
    request<{ userId: string; organizationId: string; slug: string }>(
      'POST',
      '/v1/auth/sign-up',
      input,
      { idempotent: true },
    ),
  services: {
    list: (includeInactive = false) =>
      request<Service[]>('GET', `/v1/services${includeInactive ? '?includeInactive=true' : ''}`),
    create: (input: CreateServiceInput) =>
      request<Service>('POST', '/v1/services', input, { idempotent: true }),
    update: (id: string, input: UpdateServiceInput) =>
      request<Service>('PATCH', `/v1/services/${id}`, input, { idempotent: true }),
    archive: (id: string) =>
      request<Service>('DELETE', `/v1/services/${id}`, undefined, { idempotent: true }),
  },
  clients: {
    list: (q = '') =>
      request<Client[]>('GET', `/v1/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    create: (input: CreateClientInput) =>
      request<Client>('POST', '/v1/clients', input, { idempotent: true }),
    update: (id: string, input: UpdateClientInput) =>
      request<Client>('PATCH', `/v1/clients/${id}`, input, { idempotent: true }),
    archive: (id: string) =>
      request<{ id: string; anonymizedAt: string }>('DELETE', `/v1/clients/${id}`, undefined, {
        idempotent: true,
      }),
  },
  staff: {
    list: (includeInactive = false) =>
      request<Staff[]>('GET', `/v1/staff${includeInactive ? '?includeInactive=true' : ''}`),
    create: (input: CreateStaffInput) =>
      request<Staff>('POST', '/v1/staff', input, { idempotent: true }),
    update: (id: string, input: UpdateStaffInput) =>
      request<Staff>('PATCH', `/v1/staff/${id}`, input, { idempotent: true }),
    archive: (id: string) =>
      request<Staff>('DELETE', `/v1/staff/${id}`, undefined, { idempotent: true }),
  },
};
