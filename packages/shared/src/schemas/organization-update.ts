// Owner-side organization update + working-hours / branding sub-schemas.
// Fields mirror the columns the owner can edit in Configurações.
import { z } from 'zod';
import { PixKeyTypeSchema } from './pix';
import { validatePixKeyFormat } from '../pix';

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const E164_RE = /^\+[1-9]\d{1,14}$/;
const CNPJ_RE = /^\d{14}$/;
const CPF_RE = /^\d{11}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const HoursWindowSchema = z
  .object({
    open: z.string().regex(HHMM_RE, 'open must be HH:MM'),
    close: z.string().regex(HHMM_RE, 'close must be HH:MM'),
  })
  .refine((w) => w.open < w.close, { message: 'open must be before close' });

export const HoursMapSchema = z
  .object({
    sun: z.array(HoursWindowSchema).optional(),
    mon: z.array(HoursWindowSchema).optional(),
    tue: z.array(HoursWindowSchema).optional(),
    wed: z.array(HoursWindowSchema).optional(),
    thu: z.array(HoursWindowSchema).optional(),
    fri: z.array(HoursWindowSchema).optional(),
    sat: z.array(HoursWindowSchema).optional(),
  })
  .strict();

export const ThemeConfigSchema = z
  .object({
    primary: z.string().regex(HEX_COLOR_RE, 'primary must be #RRGGBB').optional(),
    accent: z.string().regex(HEX_COLOR_RE, 'accent must be #RRGGBB').optional(),
    logoUrl: z.string().url().nullable().optional(),
  })
  .strict();

export const AddressSchema = z
  .object({
    street: optionalText(120),
    number: optionalText(20),
    complement: optionalText(80),
    neighborhood: optionalText(80),
    city: optionalText(80),
    state: optionalText(2),
    zip: optionalText(12),
  })
  .strict();

export const UpdateOrganizationInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    legalName: optionalText(120),
    cnpj: z
      .string()
      .trim()
      .regex(CNPJ_RE, 'cnpj must be 14 digits, no separators')
      .nullable()
      .optional(),
    cpf: z
      .string()
      .trim()
      .regex(CPF_RE, 'cpf must be 11 digits, no separators')
      .nullable()
      .optional(),
    primaryPixKey: z.string().trim().min(1).optional(),
    primaryPixKeyType: PixKeyTypeSchema.optional(),
    whatsappPhone: z
      .string()
      .regex(E164_RE, 'whatsappPhone must be E.164 (e.g. +5511999998888)')
      .nullable()
      .optional(),
    address: AddressSchema.nullable().optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    logoUrl: z.string().url().nullable().optional(),
    coverUrl: z.string().url().nullable().optional(),
    hours: HoursMapSchema.optional(),
    themeId: z.string().trim().min(1).max(40).optional(),
    themeConfig: ThemeConfigSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'at least one field is required',
  })
  .refine(
    (d) => {
      // If pix fields are provided, both must be present and pair must validate.
      if (d.primaryPixKey === undefined && d.primaryPixKeyType === undefined) return true;
      if (!d.primaryPixKey || !d.primaryPixKeyType) return false;
      return validatePixKeyFormat(d.primaryPixKey, d.primaryPixKeyType);
    },
    {
      message: 'primaryPixKey does not match primaryPixKeyType format',
      path: ['primaryPixKey'],
    },
  );
