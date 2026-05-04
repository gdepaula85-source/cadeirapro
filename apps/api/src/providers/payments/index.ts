// PaymentProvider singleton. Future swap to OpenPix (or any other PSP) is a
// one-line change here — callers depend only on the interface in types.ts.
import { TransfeeraProvider } from './transfeera';
import type { PaymentProvider } from './types';

export const paymentProvider: PaymentProvider = new TransfeeraProvider();

export type {
  PaymentProvider,
  SplitRecipient,
  CreatePixChargeInput,
  PixChargeResult,
  WebhookEvent,
  WebhookEventType,
} from './types';
