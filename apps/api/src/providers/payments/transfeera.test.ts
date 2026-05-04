import { describe, it, expect } from 'vitest';
import { paymentProvider } from './index';
import { TransfeeraProvider } from './transfeera';
import { HttpError } from '../../lib/errors';

describe('paymentProvider singleton', () => {
  it('is a TransfeeraProvider instance', () => {
    expect(paymentProvider).toBeInstanceOf(TransfeeraProvider);
  });
});

describe('TransfeeraProvider — every method throws 501 in S1', () => {
  const dummyInput = {
    organizationId: '00000000-0000-4000-8000-000000000001',
    amountCents: 10_000,
    expiresInSeconds: 900,
    primaryRecipient: { pixKey: 'shop@example.com', pixKeyType: 'email' as const },
    splits: [],
    description: 'Corte',
    externalId: '00000000-0000-4000-8000-000000000002',
  };

  it('createPixCharge → 501 not_implemented', async () => {
    await expect(paymentProvider.createPixCharge(dummyInput)).rejects.toMatchObject({
      status: 501,
      code: 'not_implemented',
    });
  });

  it('cancelCharge → 501', async () => {
    await expect(paymentProvider.cancelCharge('p-123')).rejects.toBeInstanceOf(HttpError);
  });

  it('refundCharge → 501', async () => {
    await expect(paymentProvider.refundCharge('p-123', 1000)).rejects.toBeInstanceOf(HttpError);
  });

  it('validatePixKey → 501', async () => {
    await expect(paymentProvider.validatePixKey('12345678901', 'cpf')).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  it('parseWebhook → 501', async () => {
    const body = new ArrayBuffer(2);
    new Uint8Array(body).set([0x7b, 0x7d]); // "{}"
    await expect(paymentProvider.parseWebhook(body, {})).rejects.toBeInstanceOf(HttpError);
  });
});
