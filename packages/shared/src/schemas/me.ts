import { z } from 'zod';
import { OrganizationSchema } from './organization';
import { ProfileSchema } from './profile';

// Shape of `data` in `GET /v1/me` response: { user, organization }.
// Used by the dashboard to bootstrap on mount.
export const MeSchema = z.object({
  user: ProfileSchema,
  organization: OrganizationSchema,
});
