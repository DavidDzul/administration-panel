// Catalog for the row-level "temporary increase" indicator
// (sdd/temporary-increase-visibility, design D6/D8's exact contract). Plain
// frozen record + pure lookup — mirrors resolutionMeta.ts/advancePaymentMeta.ts/
// telmexExportMeta.ts's exact precedent (no reactive state, lives in utils/
// not composables/).
//
// Data source is `snapshot_temporary_increase_amount`/`_reason` ONLY — these
// are frozen-at-processing-time snapshot columns exposed by
// PaymentBatchService::rows() (impulsou-api PR1, sdd/temporary-increase-
// visibility P2a). This function and its caller (PaymentBatchTable.vue) MUST
// NEVER read `has_incident` or any incident-related field — the two
// indicators are data-independent (locked by PaymentBatchTable.test.ts's
// regression test).
//
// Invariant: like every other chip in this column, this function and its
// caller MUST NEVER read or influence `is_payable`/`blocking_reasons`.
export interface TemporaryIncreaseMeta {
  icon: string
  color: string
  label: string
}

// mdi-trending-up + cyan-darken-2 are deliberately distinct from every other
// chip already in this column (mdi-alert-circle-outline/amber-darken-2,
// mdi-cash-clock/info, mdi-cash-fast/indigo, mdi-cash-plus/teal,
// mdi-file-cancel-outline/blue-grey) and from RESOLUTION_META's palette
// (green/red/amber-darken-2/deep-orange/red-darken-3/blue-grey/teal/
// purple-darken-2) — teal and green were rejected because they are already
// taken in this same column.
export const TEMPORARY_INCREASE_META: TemporaryIncreaseMeta = {
  icon: 'mdi-trending-up',
  color: 'cyan-darken-2',
  label: 'Aumento temporal',
}

export interface TemporaryIncreaseChip extends TemporaryIncreaseMeta {
  ariaLabel: string
}

// Declared narrowly (rather than importing the full PaymentBatchRow), same
// shape-narrowing style as AdvancePaidRowFields/TelmexExportRowFields.
export interface TemporaryIncreaseRowFields {
  snapshot_temporary_increase_amount: string | null
  snapshot_temporary_increase_reason: string | null
}

// Self-contained, matches advancePaymentMeta.ts's/telmexExportMeta.ts's
// convention of not sharing a formatter across meta files — keeps each diff
// minimal and each file independently readable.
const formatAmount = (amount: string): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))

/**
 * `null` -> no temporary increase was frozen on this refrend's snapshot (the
 * amount is null, "0.00", or malformed).
 */
export function temporaryIncreaseChip(row: TemporaryIncreaseRowFields): TemporaryIncreaseChip | null {
  const raw = Number(row.snapshot_temporary_increase_amount ?? 0)
  if (!Number.isFinite(raw) || raw <= 0) return null

  const amount = formatAmount(row.snapshot_temporary_increase_amount as string)
  const ariaLabel = row.snapshot_temporary_increase_reason
    ? `${TEMPORARY_INCREASE_META.label} · ${amount} · Motivo: ${row.snapshot_temporary_increase_reason}`
    : `${TEMPORARY_INCREASE_META.label} · ${amount}`

  return { ...TEMPORARY_INCREASE_META, ariaLabel }
}
