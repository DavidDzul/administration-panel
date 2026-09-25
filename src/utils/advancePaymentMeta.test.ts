import { describe, expect, it } from 'vitest'
import {
  ADVANCE_PAYMENT_META,
  ADVANCE_PAYMENT_REGISTERED_META,
  advancePaymentChip,
  advancePaymentRegisteredChip,
} from '@/utils/advancePaymentMeta'

// sdd/pago-adelantado PR7b: the row-level "advance-paid" indicator catalog.
// Mirrors resolutionMeta.ts's frozen-catalog + pure-lookup pattern (design
// D-note in sdd/pago-adelantado/design), but this indicator is boolean-only
// (advance_paid), so the "catalog" is a single frozen entry instead of a
// union map. advancePaymentChip() is a pure function of the row's own 4
// fields — it never reads is_payable/blocking_reasons and has no side
// effects, same invariant as resolutionMeta().
describe('advancePaymentMeta', () => {
  it('ADVANCE_PAYMENT_META has a non-empty icon, color, and label', () => {
    expect(ADVANCE_PAYMENT_META.icon).toBeTruthy()
    expect(ADVANCE_PAYMENT_META.color).toBeTruthy()
    expect(ADVANCE_PAYMENT_META.label).toBeTruthy()
  })

  it('uses an icon distinct from mdi-cash-clock (already used for has_pending_from_previous)', () => {
    expect(ADVANCE_PAYMENT_META.icon).not.toBe('mdi-cash-clock')
  })

  it('advancePaymentChip returns null when advance_paid is false', () => {
    expect(
      advancePaymentChip({
        advance_paid: false,
        advance_paid_amount: null,
        advance_paid_origin_year: null,
        advance_paid_origin_month: null,
      }),
    ).toBeNull()
  })

  it('advancePaymentChip returns the catalog icon/color/label when advance_paid is true', () => {
    const chip = advancePaymentChip({
      advance_paid: true,
      advance_paid_amount: '1500.00',
      advance_paid_origin_year: 2027,
      advance_paid_origin_month: 6,
    })

    expect(chip).not.toBeNull()
    expect(chip?.icon).toBe(ADVANCE_PAYMENT_META.icon)
    expect(chip?.color).toBe(ADVANCE_PAYMENT_META.color)
    expect(chip?.label).toBe(ADVANCE_PAYMENT_META.label)
  })

  it('ariaLabel includes the formatted amount and the origin month/year', () => {
    const chip = advancePaymentChip({
      advance_paid: true,
      advance_paid_amount: '1500.00',
      advance_paid_origin_year: 2027,
      advance_paid_origin_month: 6,
    })

    expect(chip?.ariaLabel).toContain('Pago adelantado')
    expect(chip?.ariaLabel).toContain('junio 2027')
    expect(chip?.ariaLabel).toContain('$1,500.00')
  })

  it('ariaLabel falls back to the label alone when amount/origin are null', () => {
    const chip = advancePaymentChip({
      advance_paid: true,
      advance_paid_amount: null,
      advance_paid_origin_year: null,
      advance_paid_origin_month: null,
    })

    expect(chip?.ariaLabel).toBe('Pago adelantado')
  })
})

// ── Origin-refrend "advance payment registered" indicator (sdd/pago-adelantado
// PR8) ───────────────────────────────────────────────────────────────────────
//
// OPPOSITE meaning from advance_paid/advancePaymentChip above: advance_paid
// means "this row IS one of the future months settled by an advance batch
// made from some OTHER refrend". advance_payment_amount (this section) means
// "this row itself HAS an advance-payment batch registered FROM it" — it is
// the origin refrend, and its total_to_pay already includes the advanced
// money (design D6). Both can be true on different rows in the same batch;
// they must never be conflated.
describe('advancePaymentRegisteredChip (origin-refrend indicator, PR8)', () => {
  it('ADVANCE_PAYMENT_REGISTERED_META has a non-empty icon, color, and label', () => {
    expect(ADVANCE_PAYMENT_REGISTERED_META.icon).toBeTruthy()
    expect(ADVANCE_PAYMENT_REGISTERED_META.color).toBeTruthy()
    expect(ADVANCE_PAYMENT_REGISTERED_META.label).toBeTruthy()
  })

  it('uses an icon distinct from mdi-cash-clock and mdi-cash-fast (the other two money chips)', () => {
    expect(ADVANCE_PAYMENT_REGISTERED_META.icon).not.toBe('mdi-cash-clock')
    expect(ADVANCE_PAYMENT_REGISTERED_META.icon).not.toBe(ADVANCE_PAYMENT_META.icon)
  })

  it('advancePaymentRegisteredChip returns null when advance_payment_amount is "0.00"', () => {
    expect(advancePaymentRegisteredChip({ advance_payment_amount: '0.00' })).toBeNull()
  })

  it('advancePaymentRegisteredChip returns null when advance_payment_amount is "0"', () => {
    expect(advancePaymentRegisteredChip({ advance_payment_amount: '0' })).toBeNull()
  })

  it('advancePaymentRegisteredChip returns the catalog icon/color/label when advance_payment_amount is positive', () => {
    const chip = advancePaymentRegisteredChip({ advance_payment_amount: '750.50' })

    expect(chip).not.toBeNull()
    expect(chip?.icon).toBe(ADVANCE_PAYMENT_REGISTERED_META.icon)
    expect(chip?.color).toBe(ADVANCE_PAYMENT_REGISTERED_META.color)
    expect(chip?.label).toBe(ADVANCE_PAYMENT_REGISTERED_META.label)
  })

  it('ariaLabel/tooltip includes the formatted amount', () => {
    const chip = advancePaymentRegisteredChip({ advance_payment_amount: '750.50' })

    expect(chip?.ariaLabel).toContain('$750.50')
    expect(chip?.ariaLabel).toContain('Se sumará al monto de esta decisión')
  })
})
