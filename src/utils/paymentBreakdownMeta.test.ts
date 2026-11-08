import { describe, expect, it } from 'vitest'
import {
  amountOrDash,
  baseAmount,
  baseAmountLabel,
  baseDiscountNote,
  discountPercent,
  finalAdjustments,
  formatAmount,
  netCell,
  retentionAdvanceAmount,
  telmexCoverageAmount,
  type PaymentBreakdownRowFields,
} from '@/utils/paymentBreakdownMeta'
import type { NetBreakdown } from '@/interfaces/payment'

// sdd/lotes-pago-generacion-desglose PR2: pure per-column display helpers for
// Lotes de pago's breakdown columns (Beca, Apoyo, Pago IU, Base,
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

// sdd/descuento-beca-apoyo PR4: the API now sends the net split; the UI
// renders it and does NO Beca/Pago IU math of its own.
const buildNet = (overrides: Partial<NetBreakdown> = {}): NetBreakdown => ({
  beca: '1545.45',
  apoyo: '154.55',
  pago_iu: '0.00',
  temporary_increase: '0.00',
  telmex_coverage: '0.00',
  pending_and_advance: '0.00',
  total: '1700.00',
  nominal: { beca: '1800.00', apoyo: '200.00', pago_iu: '0.00', temporary_increase: '0.00' },
  ...overrides,
})

describe('netCell (net-first Beca/Apoyo/Pago IU/Aumento cells)', () => {
  it('returns the net as the main value and the nominal as the secondary note when they differ', () => {
    expect(netCell(buildNet(), 'beca')).toEqual({ net: '$1,545.45', nominal: '$1,800.00' })
    expect(netCell(buildNet(), 'apoyo')).toEqual({ net: '$154.55', nominal: '$200.00' })
  })

  it('has no nominal note when net equals nominal', () => {
    const net = buildNet({ beca: '1800.00', nominal: { beca: '1800.00', apoyo: '0.00', pago_iu: '0.00', temporary_increase: '0.00' } })

    expect(netCell(net, 'beca')).toEqual({ net: '$1,800.00', nominal: null })
  })

  it('is a dash with no note when both net and nominal are zero', () => {
    expect(netCell(buildNet(), 'pago_iu')).toEqual({ net: '—', nominal: null })
  })

  it('keeps the nominal note when the net is fully discounted to zero', () => {
    const net = buildNet({
      beca: '0.00',
      nominal: { beca: '1800.00', apoyo: '0.00', pago_iu: '0.00', temporary_increase: '0.00' },
    })

    expect(netCell(net, 'beca')).toEqual({ net: '—', nominal: '$1,800.00' })
  })

  it('is a dash when the payload carries no net_breakdown', () => {
    expect(netCell(undefined, 'beca')).toEqual({ net: '—', nominal: null })
  })
})

describe('retentionAdvanceAmount (Ret./Adelanto column)', () => {
  it('formats pending_and_advance, or a dash when zero or absent', () => {
    expect(retentionAdvanceAmount(buildNet({ pending_and_advance: '450.00' }))).toBe('$450.00')
    expect(retentionAdvanceAmount(buildNet())).toBe('—')
    expect(retentionAdvanceAmount(undefined)).toBe('—')
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

  it('ignores a legacy refund_amount_from_previous key and never produces NaN or "reemb."', () => {
    const row = { ...buildRow(), refund_amount_from_previous: '75.00' }

    expect(finalAdjustments(row)).toEqual([])
  })

  it('returns only "adelanto" when advance_payment_amount > 0', () => {
    const row = buildRow({ advance_payment_amount: '125.00' })

    expect(finalAdjustments(row)).toEqual([{ label: 'adelanto', amount: '$125.00' }])
  })

  it('returns both together, in fixed order, when all are non-zero', () => {
    const row = buildRow({
      amount_pending_from_previous: '50.00',
      advance_payment_amount: '125.00',
    })

    expect(finalAdjustments(row)).toEqual([
      { label: 'ret.', amount: '$50.00' },
      { label: 'adelanto', amount: '$125.00' },
    ])
  })
})

describe('baseAmountLabel', () => {
  it.each([
    ['IU', 'Beca'],
    ['TELMEX_IU', 'Pago IU'],
    ['TELMEX', 'Beca'],
  ])('labels %s base amount as %s', (type, label) => {
    expect(baseAmountLabel(type)).toBe(label)
  })

  it('falls back to Beca when the type is missing or unknown', () => {
    expect(baseAmountLabel(null)).toBe('Beca')
    expect(baseAmountLabel(undefined)).toBe('Beca')
    expect(baseAmountLabel('OTHER')).toBe('Beca')
  })
})
