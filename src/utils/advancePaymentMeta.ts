// Catalog for the row-level "advance-paid" indicator (sdd/pago-adelantado,
// design D-note "administration-panel/src/utils/advancePaymentMeta.ts").
// Plain frozen record + pure lookup — no reactive state, so this lives in
// utils/, not composables/ (mirrors resolutionMeta.ts's exact precedent,
// which itself mirrors maskAccountNumber.ts). Unlike resolutionMeta.ts,
// `advance_paid` is a boolean, not an 8-value union, so the "catalog" is a
// single frozen entry rather than a Record — the pattern being mirrored is
// "frozen constant + pure lookup function", not the multi-key shape.
//
// This is a SEPARATE catalog from RESOLUTION_META, not a 9th ResolutionType
// key (design's explicit note) — advance-paid history and resolution_type
// are orthogonal facts about a row and must never be merged into one union.
//
// Invariant: this function and its caller (PaymentBatchTable.vue) MUST NEVER
// read or influence `is_payable`/`blocking_reasons`. PaymentReadinessEvaluator
// is structurally unreachable from these 4 fields, same isolation already
// enforced for resolution_type/resolution_cause.
export interface AdvancePaymentMeta {
  icon: string
  color: string
  label: string
}

// mdi-cash-fast is deliberately distinct from mdi-cash-clock (already used
// for the has_pending_from_previous chip in the same column) — the two must
// never be visually confused when both render on the same row.
export const ADVANCE_PAYMENT_META: AdvancePaymentMeta = {
  icon: 'mdi-cash-fast',
  color: 'indigo',
  label: 'Pago adelantado',
}

export interface AdvancePaymentChip extends AdvancePaymentMeta {
  ariaLabel: string
}

// Matches the 4 fields PaymentBatchService::rows() adds to PaymentBatchRow
// (impulsou-api PR5, sdd/pago-adelantado design D6). Declared narrowly here
// (rather than importing the full PaymentBatchRow) so this function stays a
// pure, minimally-coupled lookup, same shape-narrowing style as
// resolutionMeta()'s `string | null` parameter.
export interface AdvancePaidRowFields {
  advance_paid: boolean
  advance_paid_amount: string | null
  advance_paid_origin_year: number | null
  advance_paid_origin_month: number | null
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const formatAmount = (amount: string): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))

const monthLabel = (year: number, month: number): string => `${MONTH_NAMES[month - 1] ?? month} ${year}`

/**
 * `null` -> no indicator (the row was never advance-paid). Mirrors
 * resolutionAriaLabel's exact string-building pattern in PaymentBatchTable.vue
 * (`${label} · ${detail}` when a detail is present, label alone otherwise) —
 * here the "detail" is the formatted amount plus the origin batch month/year
 * instead of a resolution_cause.
 */
export function advancePaymentChip(row: AdvancePaidRowFields): AdvancePaymentChip | null {
  if (!row.advance_paid) return null

  const detailParts = [
    row.advance_paid_amount ? formatAmount(row.advance_paid_amount) : null,
    row.advance_paid_origin_year !== null && row.advance_paid_origin_month !== null
      ? `Origen: ${monthLabel(row.advance_paid_origin_year, row.advance_paid_origin_month)}`
      : null,
  ].filter((part): part is string => part !== null)

  const ariaLabel = detailParts.length > 0
    ? `${ADVANCE_PAYMENT_META.label} · ${detailParts.join(' · ')}`
    : ADVANCE_PAYMENT_META.label

  return { ...ADVANCE_PAYMENT_META, ariaLabel }
}

// ── Origin-refrend "advance payment registered" indicator (sdd/pago-adelantado
// PR8) ───────────────────────────────────────────────────────────────────────
//
// OPPOSITE meaning from advance_paid/advancePaymentChip above: advance_paid
// means "this row IS one of the future months settled by an advance batch
// made from some OTHER refrend" (this row is a CHILD). advance_payment_amount
// means "this row itself HAS an advance-payment batch registered FROM it"
// (this row is the ORIGIN refrend) — its total_to_pay already includes this
// amount (design D6). Both can be true on different rows in the same batch at
// once; never conflate them. mdi-cash-plus is deliberately distinct from both
// mdi-cash-clock (has_pending_from_previous) and mdi-cash-fast (advance_paid)
// so none of the three money-related chips are ever visually confused.
export const ADVANCE_PAYMENT_REGISTERED_META: AdvancePaymentMeta = {
  icon: 'mdi-cash-plus',
  color: 'teal',
  label: 'Pago adelantado registrado',
}

export interface AdvancePaymentRegisteredChip extends AdvancePaymentMeta {
  ariaLabel: string
}

// Matches the field PaymentBatchService::rows() adds to PaymentBatchRow
// (impulsou-api PR8, sdd/pago-adelantado design D6). Declared narrowly here,
// same shape-narrowing style as AdvancePaidRowFields above.
export interface AdvancePaymentRegisteredRowFields {
  advance_payment_amount: string
}

/**
 * `null` -> no advance-payment batch registered from this refrend
 * (advance_payment_amount is "0.00"/zero). Mirrors advancePaymentChip's
 * pattern above.
 */
export function advancePaymentRegisteredChip(
  row: AdvancePaymentRegisteredRowFields,
): AdvancePaymentRegisteredChip | null {
  if (Number(row.advance_payment_amount) <= 0) return null

  const ariaLabel = `+${formatAmount(row.advance_payment_amount)} · Se sumará al monto de esta decisión`

  return { ...ADVANCE_PAYMENT_REGISTERED_META, ariaLabel }
}
