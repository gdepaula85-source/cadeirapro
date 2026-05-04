import { z } from 'zod';
import { PIX_KEY_TYPES } from '../pix';

export const PixKeyTypeSchema = z.enum(PIX_KEY_TYPES);
