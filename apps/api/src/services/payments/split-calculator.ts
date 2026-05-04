// Three-way split — pure function. Build Guide §7.3.
// Integer cents only. Platform takes its cut first, barber takes commission
// off the gross, shop receives the remainder. Rounding pennies fall to the
// shop slice so the totals reconcile exactly.
import type { PixKeyType } from '@cadeirapro/shared';
import type { SplitRecipient } from '../../providers/payments/types';

export interface SplitInput {
  grossCents: number;
  platformFeePct: number; // 0.005 = 0.5%
  barberCommissionPct: number; // 0.50 = 50%
  shopPixKey: string;
  shopPixKeyType: PixKeyType;
  barberPixKey: string;
  barberPixKeyType: PixKeyType;
  platformPixKey: string;
  platformPixKeyType: PixKeyType;
}

export interface SplitOutput {
  primary: { pixKey: string; pixKeyType: PixKeyType; amountCents: number };
  splits: SplitRecipient[];
}

export function computeSplit(input: SplitInput): SplitOutput {
  if (!Number.isInteger(input.grossCents) || input.grossCents < 0) {
    throw new Error('split_invalid: grossCents must be a non-negative integer');
  }
  if (input.platformFeePct < 0 || input.platformFeePct > 1) {
    throw new Error('split_invalid: platformFeePct out of [0,1]');
  }
  if (input.barberCommissionPct < 0 || input.barberCommissionPct > 1) {
    throw new Error('split_invalid: barberCommissionPct out of [0,1]');
  }

  const platformCents = Math.round(input.grossCents * input.platformFeePct);
  const barberCents = Math.round(input.grossCents * input.barberCommissionPct);
  const shopCents = input.grossCents - platformCents - barberCents;

  if (shopCents < 0) {
    throw new Error('split_invalid: barber + platform exceed gross');
  }

  return {
    primary: {
      pixKey: input.shopPixKey,
      pixKeyType: input.shopPixKeyType,
      amountCents: shopCents,
    },
    splits: [
      {
        pixKey: input.barberPixKey,
        pixKeyType: input.barberPixKeyType,
        amountCents: barberCents,
        metadata: { kind: 'barber' },
      },
      {
        pixKey: input.platformPixKey,
        pixKeyType: input.platformPixKeyType,
        amountCents: platformCents,
        metadata: { kind: 'platform' },
      },
    ],
  };
}
