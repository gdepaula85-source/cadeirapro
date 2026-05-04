// PaymentProvider abstraction. Build Guide §7.1 verbatim, with Worker-native
// `ArrayBuffer` substituted for Node's `Buffer` in webhook bodies. All
// PSP integration sits behind this interface — code outside providers/
// never references Transfeera (or whichever PSP is current) directly.
import type { PixKeyType } from '@cadeirapro/shared';

export interface SplitRecipient {
  pixKey: string;
  pixKeyType: PixKeyType;
  amountCents: number;
  metadata?: Record<string, string>;
}

export interface CreatePixChargeInput {
  organizationId: string;
  amountCents: number;
  expiresInSeconds: number; // e.g. 900 (15 min)
  primaryRecipient: { pixKey: string; pixKeyType: PixKeyType };
  splits: SplitRecipient[]; // barber + platform
  description: string; // "Corte de cabelo - João S - 03/06"
  externalId: string; // our payment id (UUID)
  payerInfo?: { name: string; document?: string };
}

export interface PixChargeResult {
  providerPaymentId: string;
  qrCode: string; // BR Code copy-and-paste string
  qrImageUrl: string; // PNG URL
  expiresAt: string; // ISO 8601
  raw: unknown; // full PSP response
}

export type WebhookEventType =
  | 'payment.paid'
  | 'payment.expired'
  | 'payment.refunded'
  | 'split.paid'
  | 'split.failed';

export interface WebhookEvent {
  type: WebhookEventType;
  providerPaymentId: string;
  externalId?: string; // our id, if PSP echoes
  amountCents?: number;
  paidAt?: string;
  raw: unknown;
}

export interface PaymentProvider {
  createPixCharge(input: CreatePixChargeInput): Promise<PixChargeResult>;
  cancelCharge(providerPaymentId: string): Promise<void>;
  refundCharge(providerPaymentId: string, amountCents: number): Promise<void>;
  validatePixKey(key: string, type: PixKeyType): Promise<boolean>;
  parseWebhook(rawBody: ArrayBuffer, headers: Record<string, string>): Promise<WebhookEvent>;
}
