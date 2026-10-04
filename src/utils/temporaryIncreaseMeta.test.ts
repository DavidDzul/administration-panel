import { describe, expect, it } from 'vitest'
import { TEMPORARY_INCREASE_META, temporaryIncreaseChip } from '@/utils/temporaryIncreaseMeta'

// sdd/temporary-increase-visibility, design D6/D8: the row-level
// "temporary increase" indicator catalog for the Pagos flags column. Mirrors
// resolutionMeta.ts/advancePaymentMeta.ts/telmexExportMeta.ts's frozen-catalog
// + pure-lookup pattern exactly. Data source is `snapshot_temporary_increase_
// amount`/`_reason` ONLY — this function must never read `has_incident` or
// any incident-related field (locked by the regression test below and by
// PaymentBatchTable.test.ts's row-level non-regression test).
describe('temporaryIncreaseMeta', () => {
  it('TEMPORARY_INCREASE_META has a non-empty icon, color, and label', () => {
    expect(TEMPORARY_INCREASE_META.icon).toBeTruthy()
    expect(TEMPORARY_INCREASE_META.color).toBeTruthy()
    expect(TEMPORARY_INCREASE_META.label).toBeTruthy()
  })

  it('uses an icon and color distinct from the other flags-column chips', () => {
    expect(TEMPORARY_INCREASE_META.icon).not.toBe('mdi-cash-clock')
    expect(TEMPORARY_INCREASE_META.icon).not.toBe('mdi-cash-fast')
    expect(TEMPORARY_INCREASE_META.icon).not.toBe('mdi-cash-plus')
    expect(TEMPORARY_INCREASE_META.icon).not.toBe('mdi-alert-circle-outline')
    expect(TEMPORARY_INCREASE_META.icon).not.toBe('mdi-file-cancel-outline')
    expect(TEMPORARY_INCREASE_META.color).not.toBe('teal')
    expect(TEMPORARY_INCREASE_META.color).not.toBe('green')
  })

  it('temporaryIncreaseChip returns null when snapshot_temporary_increase_amount is null', () => {
    expect(
      temporaryIncreaseChip({
        snapshot_temporary_increase_amount: null,
        snapshot_temporary_increase_reason: null,
      }),
    ).toBeNull()
  })

  it('temporaryIncreaseChip returns null when snapshot_temporary_increase_amount is "0.00"', () => {
    expect(
      temporaryIncreaseChip({
        snapshot_temporary_increase_amount: '0.00',
        snapshot_temporary_increase_reason: null,
      }),
    ).toBeNull()
  })

  it('temporaryIncreaseChip returns null when snapshot_temporary_increase_amount is malformed', () => {
    expect(
      temporaryIncreaseChip({
        snapshot_temporary_increase_amount: 'not-a-number',
        snapshot_temporary_increase_reason: null,
      }),
    ).toBeNull()
  })

  it('temporaryIncreaseChip returns the catalog icon/color/label when the amount is positive', () => {
    const chip = temporaryIncreaseChip({
      snapshot_temporary_increase_amount: '500.00',
      snapshot_temporary_increase_reason: null,
    })

    expect(chip).not.toBeNull()
    expect(chip?.icon).toBe(TEMPORARY_INCREASE_META.icon)
    expect(chip?.color).toBe(TEMPORARY_INCREASE_META.color)
    expect(chip?.label).toBe(TEMPORARY_INCREASE_META.label)
  })

  it('ariaLabel is the label plus formatted amount alone when reason is null', () => {
    const chip = temporaryIncreaseChip({
      snapshot_temporary_increase_amount: '500.00',
      snapshot_temporary_increase_reason: null,
    })

    expect(chip?.ariaLabel).toBe('Aumento temporal · $500.00')
  })

  it('ariaLabel appends "· Motivo: {reason}" when a reason is present', () => {
    const chip = temporaryIncreaseChip({
      snapshot_temporary_increase_amount: '500.00',
      snapshot_temporary_increase_reason: 'Ajuste especial',
    })

    expect(chip?.ariaLabel).toBe('Aumento temporal · $500.00 · Motivo: Ajuste especial')
  })
})
