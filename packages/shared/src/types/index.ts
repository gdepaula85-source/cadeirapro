import type { z } from 'zod';
import type {
  OrganizationSchema,
  ProfileSchema,
  RoleSchema,
  SignUpInputSchema,
  MeSchema,
  PixKeyTypeSchema,
} from '../schemas';

export type Organization = z.infer<typeof OrganizationSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type SignUpInput = z.infer<typeof SignUpInputSchema>;
export type Me = z.infer<typeof MeSchema>;
export type PixKeyType = z.infer<typeof PixKeyTypeSchema>;
