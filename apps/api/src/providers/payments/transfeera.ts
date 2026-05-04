// Transfeera provider — STUB for S1. Every method throws 501.
// Real implementation lands in S3 against docs.transfeera.dev.
// HMAC verification will use the verifyHmacSha256 helper in lib/crypto.ts
// (Web Crypto, constant-time by spec).
import { NotImplemented } from '../../lib/errors';
import type { PaymentProvider, CreatePixChargeInput, PixChargeResult, WebhookEvent } from './types';
import type { PixKeyType } from '@cadeirapro/shared';

const S3_DETAIL = { sprint: 's3', upstream: 'https://docs.transfeera.dev' };

export class TransfeeraProvider implements PaymentProvider {
  async createPixCharge(_input: CreatePixChargeInput): Promise<PixChargeResult> {
    throw new NotImplemented('not_implemented', S3_DETAIL);
  }

  async cancelCharge(_providerPaymentId: string): Promise<void> {
    throw new NotImplemented('not_implemented', S3_DETAIL);
  }

  async refundCharge(_providerPaymentId: string, _amountCents: number): Promise<void> {
    throw new NotImplemented('not_implemented', S3_DETAIL);
  }

  async validatePixKey(_key: string, _type: PixKeyType): Promise<boolean> {
    // Format-only check is in @cadeirapro/shared.validatePixKeyFormat. Real
    // DICT lookup via Transfeera lands in S3.
    throw new NotImplemented('not_implemented', S3_DETAIL);
  }

  async parseWebhook(
    _rawBody: ArrayBuffer,
    _headers: Record<string, string>,
  ): Promise<WebhookEvent> {
    throw new NotImplemented('not_implemented', S3_DETAIL);
  }
}
