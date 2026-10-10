import { describe, expect, it } from 'vitest'
import { TELMEX_COVERAGE_META, telmexCoverageChip } from '@/utils/telmexCoverageMeta'

// sdd/telmex-cobertura-iu PR5 (design's "Lotes" section, task 5.4): the
// row-level "Adelanto Telmex" indicator catalog for PaymentBatchTable's
// flags column. Mirrors telmexExportMeta.ts's exact frozen-catalog + pure-
// lookup pattern. Coverage is derived SOLELY from `snapshot_telmex_coverage_id
// !== null` (NOT a separate `telmex_covered` boolean) — same verified
// decision as PR6's AprobacionRefrendTable chip (apply-progress #1923's PR6
// section): the amount column is populated for every TELMEX/TELMEX_IU row
// regardless of coverage, so the FK is the only reliable signal.
describe('telmexCoverageMeta', () => {
  it('TELMEX_COVERAGE_META has a non-empty icon, color, and label', () => {
    expect(TELMEX_COVERAGE_META.icon).toBeTruthy()
    expect(TELMEX_COVERAGE_META.color).toBeTruthy()
    expect(TELMEX_COVERAGE_META.label).toBeTruthy()
  })

  it('uses mdi-hand-coin-outline / teal per design', () => {
    expect(TELMEX_COVERAGE_META.icon).toBe('mdi-hand-coin-outline')
    expect(TELMEX_COVERAGE_META.color).toBe('teal')
    expect(TELMEX_COVERAGE_META.label).toBe('Adelanto Telmex')
  })

  it('telmexCoverageChip returns null when snapshot_telmex_coverage_id is null', () => {
    expect(
      telmexCoverageChip({ snapshot_telmex_coverage_id: null, snapshot_telmex_covered_amount: null }),
    ).toBeNull()
  })

  it('telmexCoverageChip returns null when snapshot_telmex_coverage_id is undefined (field absent)', () => {
    expect(telmexCoverageChip({})).toBeNull()
  })

  it('telmexCoverageChip returns the catalog icon/color/label when covered', () => {
    const chip = telmexCoverageChip({ snapshot_telmex_coverage_id: 7, snapshot_telmex_covered_amount: '1200.00' })

    expect(chip).not.toBeNull()
    expect(chip?.icon).toBe(TELMEX_COVERAGE_META.icon)
    expect(chip?.color).toBe(TELMEX_COVERAGE_META.color)
    expect(chip?.label).toBe(TELMEX_COVERAGE_META.label)
  })

  it('ariaLabel includes the formatted covered amount', () => {
    const chip = telmexCoverageChip({ snapshot_telmex_coverage_id: 7, snapshot_telmex_covered_amount: '1200.50' })

    expect(chip?.ariaLabel).toContain('Adelanto Telmex')
    expect(chip?.ariaLabel).toContain('$1,200.50')
  })

  it('ariaLabel falls back to a dash when the covered amount is null despite being covered', () => {
    const chip = telmexCoverageChip({ snapshot_telmex_coverage_id: 7, snapshot_telmex_covered_amount: null })

    expect(chip?.ariaLabel).toContain('—')
  })
})
