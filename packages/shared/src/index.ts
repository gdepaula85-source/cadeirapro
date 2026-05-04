// @cadeirapro/shared — public surface.

export { toCents, formatBRL, splitProportional } from './money';
export { nowSP, toUtc, formatPtBR, SAO_PAULO_TZ } from './time';
export { validatePixKeyFormat, isPixKeyType, PIX_KEY_TYPES } from './pix';
export { slugify, randomSlugSuffix } from './slug';
export type { SlugifyOptions } from './slug';

export {
  PixKeyTypeSchema,
  OrganizationSchema,
  ProfileSchema,
  RoleSchema,
  SignUpInputSchema,
  MeSchema,
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
  BookingSchema,
  BookingStatusSchema,
  BookingSourceSchema,
  CreateBookingInputSchema,
  UpdateBookingInputSchema,
  BookingListQuerySchema,
  AvailabilityQuerySchema,
  AvailabilitySlotSchema,
} from './schemas';

export type {
  PixKeyType,
  Organization,
  Profile,
  Role,
  SignUpInput,
  Me,
  Service,
  CreateServiceInput,
  UpdateServiceInput,
  ServiceListQuery,
  Client,
  CreateClientInput,
  UpdateClientInput,
  ClientListQuery,
  Staff,
  StaffRole,
  CreateStaffInput,
  UpdateStaffInput,
  StaffListQuery,
  Booking,
  BookingStatus,
  BookingSource,
  CreateBookingInput,
  UpdateBookingInput,
  BookingListQuery,
  AvailabilityQuery,
  AvailabilitySlot,
} from './types';
