// Pure per-column display helpers for Lotes de pago's breakdown columns
// (sdd/lotes-pago-generacion-desglose, spec "Breakdown columns rendered per
// scholarship type", design D5/D6). These are display computations over a
// row's own money/percentage fields, not an icon/color/label catalog, so
// the shape here is "pure formatting function" rather than
// resolutionMeta.ts's frozen-catalog pattern — but `formatAmount` stays
// self-contained (not imported from another *Meta.ts file), same
// deliberate-duplication convention as advancePaymentMeta.ts/
// temporaryIncreaseMeta.ts.
//
// Invariant: like every other helper in this folder, these functions MUST
// NEVER read or influence `is_payable`/`blocking_reasons`.
//
// Money subtraction (monthlyAmount/iuPaymentAmount) is done in integer
// cents (design D6) — `gross − apoyo − aumento temporal` as a float
// subtraction can drift by a cent; `Math.round(Number(x) * 100)` avoids it.

const DASH = '—'

export const formatAmount = (amount: string | number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))

const toCents = (amount: string | null | undefined): number => {
  const value = Number(amount ?? 0)
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

/**
 * Generic "formatted amount, or a dash when null/zero" helper — used
 * directly for the Apoyo column (spec: "—" when 0 or null).
 */
export function amountOrDash(amount: string | null | undefined): string {
  const cents = toCents(amount)
  return cents === 0 ? DASH : formatAmount(cents / 100)
}

// Narrow row-fields interface (rather than importing the full
// PaymentBatchRow) — same shape-narrowing style as every other *Meta.ts
// RowFields interface in this folder (AdvancePaidRowFields,
// TemporaryIncreaseRowFields, etc.).
export interface PaymentBreakdownRowFields {
  snapshot_scholarship_type: string
  snapshot_gross_amount: string | null
  snapshot_monto_apoyo: string | null
  snapshot_temporary_increase_amount: string | null
  base_amount: string
  snapshot_discount_percentage: string | null
  discount_percentage: string
  final_amount: string
  amount_pending_from_previous: string
  refund_amount_from_previous: string
  advance_payment_amount: string
}

/**
 * Monto mensual column. IU rows only (spec) — gross − apoyo − aumento
 * temporal. "—" for every other scholarship type, and when the gross
 * snapshot itself is null.
 */
export function monthlyAmount(row: PaymentBreakdownRowFields): string {
  if (row.snapshot_scholarship_type !== 'IU') return DASH
  if (row.snapshot_gross_amount === null) return DASH

  const cents =
    toCents(row.snapshot_gross_amount) -
    toCents(row.snapshot_monto_apoyo) -
    toCents(row.snapshot_temporary_increase_amount)

  return formatAmount(cents / 100)
}

/**
 * Pago IU column. TELMEX_IU rows only (spec) — gross − aumento temporal.
 * "—" for every other scholarship type, and when the gross snapshot itself
 * is null.
 */
export function iuPaymentAmount(row: PaymentBreakdownRowFields): string {
  if (row.snapshot_scholarship_type !== 'TELMEX_IU') return DASH
  if (row.snapshot_gross_amount === null) return DASH

  const cents = toCents(row.snapshot_gross_amount) - toCents(row.snapshot_temporary_increase_amount)

  return formatAmount(cents / 100)
}

/**
 * Base column's main line — snapshot_gross_amount, falling back to
 * base_amount (spec).
 */
export function baseAmount(row: PaymentBreakdownRowFields): string {
  return formatAmount(row.snapshot_gross_amount ?? row.base_amount)
}

/**
 * Base column's second line — "−X%" when snapshot_discount_percentage > 0,
 * null (no second line rendered) otherwise.
 */
export function baseDiscountNote(row: PaymentBreakdownRowFields): string | null {
  const pct = Number(row.snapshot_discount_percentage ?? 0)
  return pct > 0 ? `−${pct}%` : null
}

export interface DiscountPercentDisplay {
  text: string
  isPositive: boolean
}

/**
 * Desc.% column — discount_percentage, flagged `isPositive` (rendered red
 * by the caller) when > 0; "—" / isPositive:false at 0 (spec).
 */
export function discountPercent(row: PaymentBreakdownRowFields): DiscountPercentDisplay {
  const pct = Number(row.discount_percentage ?? 0)
  if (!(pct > 0)) return { text: DASH, isPositive: false }
  return { text: `${pct}%`, isPositive: true }
}

export interface FinalAdjustment {
  label: 'ret.' | 'reemb.' | 'adelanto'
  amount: string
}

/**
 * Final column's extra lines — one per non-zero adjustment, ALWAYS shown
 * together in this fixed order (spec: "not else-if"): retención, reembolso,
 * adelanto. The main `final_amount` line itself is formatted directly by
 * the caller via `formatAmount`.
 */
export function finalAdjustments(row: PaymentBreakdownRowFields): FinalAdjustment[] {
  const adjustments: FinalAdjustment[] = []

  if (Number(row.amount_pending_from_previous) > 0) {
    adjustments.push({ label: 'ret.', amount: formatAmount(row.amount_pending_from_previous) })
  }
  if (Number(row.refund_amount_from_previous) > 0) {
    adjustments.push({ label: 'reemb.', amount: formatAmount(row.refund_amount_from_previous) })
  }
  if (Number(row.advance_payment_amount) > 0) {
    adjustments.push({ label: 'adelanto', amount: formatAmount(row.advance_payment_amount) })
  }

  return adjustments
}
