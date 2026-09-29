import { describe, expect, it } from 'vitest'
import { TELMEX_EXCLUDED_META, telmexExportExclusionChip } from '@/utils/telmexExportMeta'

// sdd/scholarship-telmex-iu-split, design D9: the row-level "excluded from
// bank file" indicator catalog. Mirrors resolutionMeta.ts/advancePaymentMeta.ts's
// frozen-catalog + pure-lookup pattern exactly. `excluded_from_bank_file` is
// server-computed by PaymentBatchService::rows() via the same
// TelmexPaymentPolicy predicate Filter B uses — this function is a pure,
// minimally-coupled lookup, it never re-derives the exclusion rule
// client-side (design's explicit rejection of that alternative).
describe('telmexExportMeta', () => {
  it('TELMEX_EXCLUDED_META has a non-empty icon, color, and label', () => {
    expect(TELMEX_EXCLUDED_META.icon).toBeTruthy()
    expect(TELMEX_EXCLUDED_META.color).toBeTruthy()
    expect(TELMEX_EXCLUDED_META.label).toBeTruthy()
  })

  it('uses an icon distinct from the other flags-column chips', () => {
    expect(TELMEX_EXCLUDED_META.icon).not.toBe('mdi-cash-clock')
    expect(TELMEX_EXCLUDED_META.icon).not.toBe('mdi-cash-fast')
    expect(TELMEX_EXCLUDED_META.icon).not.toBe('mdi-cash-plus')
    expect(TELMEX_EXCLUDED_META.icon).not.toBe('mdi-alert-circle-outline')
  })

  it('telmexExportExclusionChip returns null when excluded_from_bank_file is false', () => {
    expect(telmexExportExclusionChip({ excluded_from_bank_file: false })).toBeNull()
  })

  it('telmexExportExclusionChip returns the catalog icon/color/label when excluded_from_bank_file is true', () => {
    const chip = telmexExportExclusionChip({ excluded_from_bank_file: true })

    expect(chip).not.toBeNull()
    expect(chip?.icon).toBe(TELMEX_EXCLUDED_META.icon)
    expect(chip?.color).toBe(TELMEX_EXCLUDED_META.color)
    expect(chip?.label).toBe(TELMEX_EXCLUDED_META.label)
  })

  it('ariaLabel explains the row will not appear in the bank file', () => {
    const chip = telmexExportExclusionChip({ excluded_from_bank_file: true })

    expect(chip?.ariaLabel).toContain('Beca Telmex sin monto a depositar')
    expect(chip?.ariaLabel).toContain('No se incluirá en el archivo bancario')
  })
})
