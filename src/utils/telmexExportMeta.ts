// Catalog for the row-level "excluded from bank file" indicator
// (sdd/scholarship-telmex-iu-split, design D9's exact contract). Plain frozen
// record + pure lookup — mirrors resolutionMeta.ts/advancePaymentMeta.ts's
// exact precedent (no reactive state, lives in utils/ not composables/).
//
// `excluded_from_bank_file` is server-computed by PaymentBatchService::rows()
// via TelmexPaymentPolicy::isExcludedFromBankFile() — the SAME predicate
// Filter B uses inside paidRows(). This function deliberately does NOT
// re-derive the exclusion rule from scholarship_type/total_to_pay client-side
// (design's explicit rejection of that alternative — one predicate, both call
// sites, in one language).
//
// Meaning: true only for a TELMEX row whose total_to_pay is exactly $0 — the
// row still counts toward the batch/Pagos table, but PaymentBatchService's
// Filter B will silently omit it from the exported bank file. This chip's
// entire job is to let staff predict that outcome BEFORE running the export.
//
// Invariant: like every other chip in this column, this function and its
// caller (PaymentBatchTable.vue) MUST NEVER read or influence
// `is_payable`/`blocking_reasons`.
export interface TelmexExportMeta {
  icon: string
  color: string
  label: string
}

// mdi-file-cancel-outline is deliberately distinct from every other chip
// already in this column (mdi-alert-circle-outline, mdi-cash-clock,
// mdi-cash-fast, mdi-cash-plus) so this chip is never visually confused with
// an incidencia, retained-month, or advance-payment indicator.
export const TELMEX_EXCLUDED_META: TelmexExportMeta = {
  icon: 'mdi-file-cancel-outline',
  color: 'blue-grey',
  label: 'No entra al archivo',
}

export interface TelmexExportChip extends TelmexExportMeta {
  ariaLabel: string
}

// Declared narrowly (rather than importing the full PaymentBatchRow), same
// shape-narrowing style as AdvancePaidRowFields/resolutionMeta()'s parameter.
export interface TelmexExportRowFields {
  excluded_from_bank_file: boolean
}

/**
 * `null` -> no indicator (the row will appear in the exported bank file, or
 * is not a TELMEX row at all).
 */
export function telmexExportExclusionChip(row: TelmexExportRowFields): TelmexExportChip | null {
  if (!row.excluded_from_bank_file) return null

  return {
    ...TELMEX_EXCLUDED_META,
    ariaLabel: 'Beca Telmex sin monto a depositar · No se incluirá en el archivo bancario',
  }
}
