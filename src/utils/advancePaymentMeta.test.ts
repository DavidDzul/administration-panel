import { describe, expect, it } from 'vitest'
import { ADVANCE_PAYMENT_META, advancePaymentChip } from '@/utils/advancePaymentMeta'

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
