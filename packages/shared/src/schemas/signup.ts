import { z } from 'zod';
import { PixKeyTypeSchema } from './pix';
import { validatePixKeyFormat } from '../pix';

const CPF_OR_CNPJ_RE = /^(\d{11}|\d{14})$/;
const E164_RE = /^\+[1-9]\d{1,14}$/;

export const SignUpInputSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(10, 'password must be at least 10 characters'),
    shopName: z.string().trim().min(2).max(80),
    cpfOrCnpj: z.string().regex(CPF_OR_CNPJ_RE, 'cpfOrCnpj must be 11 or 14 digits, no separators'),
    primaryPixKey: z.string().min(1),
    primaryPixKeyType: PixKeyTypeSchema,
    whatsappPhone: z
      .string()
      .regex(E164_RE, 'whatsappPhone must be E.164 (e.g. +5511999998888)')
      .optional(),
  })
  .refine((d) => validatePixKeyFormat(d.primaryPixKey, d.primaryPixKeyType), {
    message: 'primaryPixKey does not match primaryPixKeyType format',
    path: ['primaryPixKey'],
  });
