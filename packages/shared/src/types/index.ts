import type { z } from 'zod';
import type {
  OrganizationSchema,
  ProfileSchema,
  RoleSchema,
  SignUpInputSchema,
  MeSchema,
  PixKeyTypeSchema,
  ServiceSchema,
  CreateServiceInputSchema,
  UpdateServiceInputSchema,
  ServiceListQuerySchema,
  ClientSchema,
  CreateClientInputSchema,
  UpdateClientInputSchema,
  ClientListQuerySchema,
  StaffSchema,
  StaffRoleSchema,
  CreateStaffInputSchema,
  UpdateStaffInputSchema,
  StaffListQuerySchema,
} from '../schemas';

export type Organization = z.infer<typeof OrganizationSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type SignUpInput = z.infer<typeof SignUpInputSchema>;
export type Me = z.infer<typeof MeSchema>;
export type PixKeyType = z.infer<typeof PixKeyTypeSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceInputSchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;
export type ServiceListQuery = z.infer<typeof ServiceListQuerySchema>;
export type Client = z.infer<typeof ClientSchema>;
export type CreateClientInput = z.infer<typeof CreateClientInputSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientInputSchema>;
export type ClientListQuery = z.infer<typeof ClientListQuerySchema>;
export type Staff = z.infer<typeof StaffSchema>;
export type StaffRole = z.infer<typeof StaffRoleSchema>;
export type CreateStaffInput = z.infer<typeof CreateStaffInputSchema>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffInputSchema>;
export type StaffListQuery = z.infer<typeof StaffListQuerySchema>;
