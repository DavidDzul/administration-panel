import { describe, expect, it } from 'vitest'
import {
  amountOrDash,
  baseAmount,
  baseDiscountNote,
  discountPercent,
  finalAdjustments,
  formatAmount,
  iuPaymentAmount,
  monthlyAmount,
  telmexCoverageAmount,
  type PaymentBreakdownRowFields,
} from '@/utils/paymentBreakdownMeta'

// sdd/lotes-pago-generacion-desglose PR2: pure per-column display helpers for
// Lotes de pago's breakdown columns (Monto mensual, Apoyo, Pago IU, Base,
// Desc.%, Final). Mirrors advancePaymentMeta.ts/temporaryIncreaseMeta.ts's
// "self-contained formatAmount, no shared formatter" convention — these
// functions are pure computations over a row's own fields, they never read
// is_payable/blocking_reasons.

const buildRow = (overrides: Partial<PaymentBreakdownRowFields> = {}): PaymentBreakdownRowFields => ({
  snapshot_scholarship_type: 'IU',
  snapshot_gross_amount: '2000.00',
  snapshot_monto_apoyo: '300.00',
  snapshot_temporary_increase_amount: null,
  base_amount: '2000.00',
  snapshot_discount_percentage: null,
  discount_percentage: '0',
  final_amount: '1700.00',
  amount_pending_from_previous: '0.00',
  refund_amount_from_previous: '0.00',
  advance_payment_amount: '0.00',
  ...overrides,
})

describe('formatAmount', () => {
  it('formats as es-MX MXN currency', () => {
    expect(formatAmount('1500')).toBe('$1,500.00')
    expect(formatAmount(1500)).toBe('$1,500.00')
  })
})

describe('amountOrDash', () => {
  it('returns a dash for null', () => {
    expect(amountOrDash(null)).toBe('—')
  })

  it('returns a dash for "0.00"', () => {
    expect(amountOrDash('0.00')).toBe('—')
  })

  it('returns a dash for "0"', () => {
    expect(amountOrDash('0')).toBe('—')
  })

  it('returns the formatted amount when positive', () => {
    expect(amountOrDash('300.00')).toBe('$300.00')
  })
})

describe('monthlyAmount (Monto mensual column)', () => {
  it('IU row: gross − apoyo − aumento temporal', () => {
    const row = buildRow({
      snapshot_scholarship_type: 'IU',
      snapshot_gross_amount: '2000.00',
      snapshot_monto_apoyo: '300.00',
      snapshot_temporary_increase_amount: '100.00',
    })

    expect(monthlyAmount(row)).toBe('$1,600.00')
  })

  it('IU row with null apoyo/aumento: gross alone', () => {
    const row = buildRow({
      snapshot_scholarship_type: 'IU',
      snapshot_gross_amount: '2000.00',
      snapshot_monto_apoyo: null,
      snapshot_temporary_increase_amount: null,
    })

    expect(monthlyAmount(row)).toBe('$2,000.00')
  })

  it('IU row with null gross: dash', () => {
    const row = buildRow({ snapshot_scholarship_type: 'IU', snapshot_gross_amount: null })

    expect(monthlyAmount(row)).toBe('—')
  })

  it('TELMEX_IU row: dash', () => {
    const row = buildRow({ snapshot_scholarship_type: 'TELMEX_IU' })

    expect(monthlyAmount(row)).toBe('—')
  })

  it('TELMEX row: dash', () => {
    const row = buildRow({ snapshot_scholarship_type: 'TELMEX' })

    expect(monthlyAmount(row)).toBe('—')
  })
})

describe('iuPaymentAmount (Pago IU column)', () => {
  it('TELMEX_IU row: gross − aumento temporal', () => {
    const row = buildRow({
      snapshot_scholarship_type: 'TELMEX_IU',
      snapshot_gross_amount: '2000.00',
      snapshot_temporary_increase_amount: '150.00',
    })

    expect(iuPaymentAmount(row)).toBe('$1,850.00')
  })

  it('TELMEX_IU row with null aumento: gross alone', () => {
    const row = buildRow({
      snapshot_scholarship_type: 'TELMEX_IU',
      snapshot_gross_amount: '2000.00',
      snapshot_temporary_increase_amount: null,
    })

    expect(iuPaymentAmount(row)).toBe('$2,000.00')
  })

  it('TELMEX_IU row with null gross: dash', () => {
    const row = buildRow({ snapshot_scholarship_type: 'TELMEX_IU', snapshot_gross_amount: null })

    expect(iuPaymentAmount(row)).toBe('—')
  })

  it('IU row: dash', () => {
    const row = buildRow({ snapshot_scholarship_type: 'IU' })

    expect(iuPaymentAmount(row)).toBe('—')
  })

  it('TELMEX row: dash', () => {
    const row = buildRow({ snapshot_scholarship_type: 'TELMEX' })

    expect(iuPaymentAmount(row)).toBe('—')
  })
})

describe('baseAmount (Base column, main line)', () => {
  it('uses snapshot_gross_amount when present', () => {
    const row = buildRow({ snapshot_gross_amount: '2000.00', base_amount: '1800.00' })

    expect(baseAmount(row)).toBe('$2,000.00')
  })

  it('falls back to base_amount when snapshot_gross_amount is null', () => {
    const row = buildRow({ snapshot_gross_amount: null, base_amount: '1800.00' })

    expect(baseAmount(row)).toBe('$1,800.00')
  })
})

describe('baseDiscountNote (Base column, second line)', () => {
  it('returns null when snapshot_discount_percentage is null', () => {
    expect(baseDiscountNote(buildRow({ snapshot_discount_percentage: null }))).toBeNull()
  })

  it('returns null when snapshot_discount_percentage is "0"', () => {
    expect(baseDiscountNote(buildRow({ snapshot_discount_percentage: '0' }))).toBeNull()
  })

  it('returns "−X%" when snapshot_discount_percentage is positive', () => {
    expect(baseDiscountNote(buildRow({ snapshot_discount_percentage: '10' }))).toBe('−10%')
  })
})

describe('discountPercent (Desc.% column)', () => {
  it('returns a dash and isPositive false at 0', () => {
    const result = discountPercent(buildRow({ discount_percentage: '0' }))

    expect(result).toEqual({ text: '—', isPositive: false })
  })

  it('returns the percentage text and isPositive true when > 0', () => {
    const result = discountPercent(buildRow({ discount_percentage: '10' }))

    expect(result).toEqual({ text: '10%', isPositive: true })
  })
})

// sdd/telmex-cobertura-iu PR5, task 5.5: the "Cob. Telmex" column. Coverage
// is derived SOLELY from `snapshot_telmex_coverage_id !== null` (NOT a
// separate boolean) — same verified decision as telmexCoverageMeta.ts's
// chip, because `snapshot_telmex_covered_amount` is populated for every
// TELMEX/TELMEX_IU row regardless of whether a coverage is active.
describe('telmexCoverageAmount (Cob. Telmex column)', () => {
  it('returns a dash when snapshot_telmex_coverage_id is null', () => {
    const row = buildRow({ snapshot_telmex_coverage_id: null, snapshot_telmex_covered_amount: '500.00' })

    expect(telmexCoverageAmount(row)).toBe('—')
  })

  it('returns a dash when snapshot_telmex_coverage_id is absent (field undefined)', () => {
    expect(telmexCoverageAmount(buildRow())).toBe('—')
  })

  it('returns the formatted covered amount when snapshot_telmex_coverage_id is set', () => {
    const row = buildRow({ snapshot_telmex_coverage_id: 3, snapshot_telmex_covered_amount: '850.00' })

    expect(telmexCoverageAmount(row)).toBe('$850.00')
  })

  it('returns a dash when covered but the amount itself is null', () => {
    const row = buildRow({ snapshot_telmex_coverage_id: 3, snapshot_telmex_covered_amount: null })

    expect(telmexCoverageAmount(row)).toBe('—')
  })

  it('returns a dash when covered but the amount is "0.00"', () => {
    const row = buildRow({ snapshot_telmex_coverage_id: 3, snapshot_telmex_covered_amount: '0.00' })

    expect(telmexCoverageAmount(row)).toBe('—')
  })
})

describe('finalAdjustments (Final column, extra lines)', () => {
  it('returns an empty array when there are no adjustments', () => {
    expect(finalAdjustments(buildRow())).toEqual([])
  })

  it('returns only "ret." when amount_pending_from_previous > 0', () => {
    const row = buildRow({ amount_pending_from_previous: '50.00' })

    expect(finalAdjustments(row)).toEqual([{ label: 'ret.', amount: '$50.00' }])
  })

  it('returns only "reemb." when refund_amount_from_previous > 0', () => {
    const row = buildRow({ refund_amount_from_previous: '75.00' })

    expect(finalAdjustments(row)).toEqual([{ label: 'reemb.', amount: '$75.00' }])
  })

  it('returns only "adelanto" when advance_payment_amount > 0', () => {
    const row = buildRow({ advance_payment_amount: '125.00' })

    expect(finalAdjustments(row)).toEqual([{ label: 'adelanto', amount: '$125.00' }])
  })

  it('returns all three together, in fixed order, when all are non-zero', () => {
    const row = buildRow({
      amount_pending_from_previous: '50.00',
      refund_amount_from_previous: '75.00',
      advance_payment_amount: '125.00',
    })

    expect(finalAdjustments(row)).toEqual([
      { label: 'ret.', amount: '$50.00' },
      { label: 'reemb.', amount: '$75.00' },
      { label: 'adelanto', amount: '$125.00' },
    ])
  })
})
