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
// Beca / Apoyo / Pago IU / Aumento are NOT computed here any more
// (sdd/descuento-beca-apoyo): the API sends the net split and `netCell` only
// formats it. Cent conversion is kept solely for zero/inequality checks.

import type { NetBreakdown, NetComponentKey } from '@/interfaces/payment'

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
  advance_payment_amount: string
  // Cob. Telmex column (sdd/telmex-cobertura-iu PR5, task 5.5). Both fields
  // optional — additive PaymentBatchRow fields that may be absent on
  // fixtures/rows predating this change. Coverage is derived SOLELY from
  // `snapshot_telmex_coverage_id !== null`, NEVER from a separate boolean
  // field — same verified decision as telmexCoverageMeta.ts's chip and
  // PR6's AprobacionRefrendTable chip in this same change:
  // `snapshot_telmex_covered_amount` is populated for every TELMEX/
  // TELMEX_IU row regardless of whether a coverage is active, so the FK is
  // the only reliable "is this row actually covered" signal.
  snapshot_telmex_coverage_id?: number | null
  snapshot_telmex_covered_amount?: string | null
  // Server-computed net split (sdd/descuento-beca-apoyo); absent on payloads
  // predating that change.
  net_breakdown?: NetBreakdown
}

export interface NetCellDisplay {
  // Net amount (primary value), or a dash when zero/absent.
  net: string
  // Nominal amount (secondary note), only when it differs from the net.
  nominal: string | null
}

/**
 * Beca / Apoyo / Pago IU / Aumento cells — the SERVER's net amount is the
 * primary value (sdd/descuento-beca-apoyo); the nominal is a secondary note
 * shown only when a discount actually made it differ from the net. No math
 * here: both values come straight from `net_breakdown`.
 */
export function netCell(net: NetBreakdown | undefined, key: NetComponentKey): NetCellDisplay {
  if (!net) return { net: DASH, nominal: null }

  const nominalCents = toCents(net.nominal[key])
  const differs = nominalCents !== 0 && nominalCents !== toCents(net[key])

  return { net: amountOrDash(net[key]), nominal: differs ? formatAmount(nominalCents / 100) : null }
}

export interface NetTotalDisplay {
  // Formatted net total (primary value).
  value: string
  // Formatted nominal total, only when it differs from the net.
  nominal: string | null
}

/**
 * Summary-card totals: the server's net total is the primary value and the
 * nominal a secondary caption (only when it differs). A payload without the
 * net key (older server) degrades to the nominal total with no caption.
 */
export function netTotal(net: string | undefined, nominal: string): NetTotalDisplay {
  if (net === undefined) return { value: formatAmount(nominal), nominal: null }
  return {
    value: formatAmount(net),
    nominal: toCents(net) === toCents(nominal) ? null : formatAmount(nominal),
  }
}

/**
 * Ret./Adelanto column — released retentions plus advance of future months,
 * already summed by the server (never split, always >= 0).
 */
export function retentionAdvanceAmount(net: NetBreakdown | undefined): string {
  return amountOrDash(net?.pending_and_advance)
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
  label: 'ret.' | 'adelanto'
  amount: string
}

/**
 * Final column's extra lines — one per non-zero adjustment, ALWAYS shown
 * together in this fixed order (spec: "not else-if"): retención,
 * adelanto. The main `final_amount` line itself is formatted directly by
 * the caller via `formatAmount`.
 */
/**
 * Cob. Telmex column — the covered (Telmex) part of a payable row, shown
 * only for rows actually linked to an active coverage. "—" when
 * `snapshot_telmex_coverage_id` is null/undefined, OR when the amount
 * itself is null/zero despite being linked (defensive, shouldn't normally
 * happen).
 */
export function telmexCoverageAmount(row: PaymentBreakdownRowFields): string {
  if (row.snapshot_telmex_coverage_id == null) return DASH
  return amountOrDash(row.snapshot_telmex_covered_amount)
}

export function finalAdjustments(row: PaymentBreakdownRowFields): FinalAdjustment[] {
  const adjustments: FinalAdjustment[] = []

  if (Number(row.amount_pending_from_previous) > 0) {
    adjustments.push({ label: 'ret.', amount: formatAmount(row.amount_pending_from_previous) })
  }
  if (Number(row.advance_payment_amount) > 0) {
    adjustments.push({ label: 'adelanto', amount: formatAmount(row.advance_payment_amount) })
  }

  return adjustments
}

/**
 * UI label for a refrend's base_amount, by scholarship type: it is the
 * monthly Beca for IU and TELMEX, and the IU payment for TELMEX_IU. Falls
 * back to "Beca" when the type is missing or unknown.
 */
export function baseAmountLabel(scholarshipType: string | null | undefined): string {
  return scholarshipType === 'TELMEX_IU' ? 'Pago IU' : 'Beca'
}
