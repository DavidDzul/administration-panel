// Catalog for the row-level "Adelanto Telmex" indicator (sdd/telmex-
// cobertura-iu PR5, design's Lotes section, task 5.4). Mirrors
// telmexExportMeta.ts's/resolutionMeta.ts's exact frozen-catalog + pure-
// lookup pattern — plain frozen record, no reactive state, lives in
// utils/ not composables/.
//
// Coverage is derived SOLELY from `snapshot_telmex_coverage_id !== null`,
// NEVER from a separate boolean field. This mirrors the verified decision
// already made for PR6's AprobacionRefrendTable chip in this same change
// (apply-progress #1923's PR6 section): `snapshot_telmex_covered_amount`
// is a bookkeeping value populated by buildSnapshot for EVERY TELMEX/
// TELMEX_IU row regardless of whether a coverage is active, so the FK is
// the only reliable "is this row actually covered" signal.
//
// mdi-hand-coin-outline / teal (design's exact spec) is deliberately
// distinct from every other chip already in PaymentBatchTable's flags
// column (mdi-alert-circle-outline, mdi-cash-clock, mdi-cash-fast,
// mdi-cash-plus, mdi-file-cancel-outline, mdi-trending-up) so this chip is
// never visually confused with an incidencia, retained-month, advance-
// payment, or exclusion indicator.
export interface TelmexCoverageMeta {
  icon: string
  color: string
  label: string
}

export const TELMEX_COVERAGE_META: TelmexCoverageMeta = {
  icon: 'mdi-hand-coin-outline',
  color: 'teal',
  label: 'Adelanto Telmex',
}

export interface TelmexCoverageChip extends TelmexCoverageMeta {
  ariaLabel: string
}

// Self-contained, matches paymentBreakdownMeta.ts's/telmexExportMeta.ts's
// convention of not sharing a money formatter across files.
const formatAmount = (amount: string): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))

// Declared narrowly (rather than importing the full PaymentBatchRow), same
// shape-narrowing style as every other *Meta.ts RowFields interface in this
// folder. Both fields optional — `snapshot_telmex_coverage_id`/
// `snapshot_telmex_covered_amount` are additive PaymentBatchRow fields that
// may be absent on fixtures/rows predating this change.
export interface TelmexCoverageRowFields {
  snapshot_telmex_coverage_id?: number | null
  snapshot_telmex_covered_amount?: string | null
}

/**
 * `null` -> no indicator (the row has no active coverage linked to its
 * snapshot).
 */
export function telmexCoverageChip(row: TelmexCoverageRowFields): TelmexCoverageChip | null {
  if (row.snapshot_telmex_coverage_id == null) return null

  const amountText = row.snapshot_telmex_covered_amount ? formatAmount(row.snapshot_telmex_covered_amount) : '—'

  return {
    ...TELMEX_COVERAGE_META,
    ariaLabel: `Adelanto Telmex · Cobertura IU vigente · Monto cubierto: ${amountText}`,
  }
}
