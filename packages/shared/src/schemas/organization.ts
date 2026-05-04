import { z } from 'zod';
import { PixKeyTypeSchema } from './pix';

// API-shape (camelCase). DB is snake_case; conversion happens at the API
// boundary (Build Guide §6.1).
export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(80),
  name: z.string().min(2).max(80),
  legalName: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  cpf: z.string().nullable().optional(),
  address: z
    .object({
      street: z.string(),
      number: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
    })
    .partial()
    .nullable()
    .optional(),
  timezone: z.string().default('America/Sao_Paulo'),
  currency: z.string().default('BRL'),
  primaryPixKey: z.string().min(1),
  primaryPixKeyType: PixKeyTypeSchema,
  whatsappPhone: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  themeId: z.string().default('classico'),
  themeConfig: z.record(z.unknown()).default({}),
  hours: z.record(z.unknown()).default({}),
  plan: z.enum(['trial', 'solo', 'pro', 'pro_plus']).default('trial'),
  trialEndsAt: z.string().datetime().nullable().optional(),
  platformFeePct: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
