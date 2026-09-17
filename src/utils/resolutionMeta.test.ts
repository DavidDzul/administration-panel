import { describe, expect, it } from 'vitest'
import { RESOLUTION_META, resolutionMeta } from '@/utils/resolutionMeta'

// sdd/resolution-status-visibility: the catalog behind the flags-column
// resolution chip. Mirrors psicol-panel's statusChip() icon/color choices
// for 7 of the 8 values (design D2) — REEMBOLSO_PARCIAL is the one
// invention, borrowed from SITUATION_MENU_ITEMS's PAGO_MESES entry.
describe('resolutionMeta', () => {
  it('RESOLUTION_META has exactly 8 keys', () => {
    expect(Object.keys(RESOLUTION_META)).toHaveLength(8)
  })

  it('does not include PAGO_MESES — it is a psicol-panel-only menu key, never a resolution_type value', () => {
    expect(RESOLUTION_META).not.toHaveProperty('PAGO_MESES')
  })

  it('includes all 8 real resolution_type values from ScholarshipRefrendController.php:334', () => {
    expect(Object.keys(RESOLUTION_META).sort()).toEqual(
      [
        'BECA_MES',
        'SIN_PAGO',
        'RETENIDA',
        'SUSPENDIDA',
        'BAJA_DEFINITIVA',
        'EGRESADO',
        'REEMBOLSO_PARCIAL',
        'DESCUENTO_DEFINITIVO',
      ].sort(),
    )
  })

  it('every entry has a non-empty icon, color, and label', () => {
    Object.values(RESOLUTION_META).forEach((entry) => {
      expect(entry.icon).toBeTruthy()
      expect(entry.color).toBeTruthy()
      expect(entry.label).toBeTruthy()
    })
  })

  it('resolutionMeta(null) returns null', () => {
    expect(resolutionMeta(null)).toBeNull()
  })

  it('resolutionMeta returns the matching catalog entry for a known value', () => {
    expect(resolutionMeta('RETENIDA')).toEqual(RESOLUTION_META.RETENIDA)
    expect(resolutionMeta('BECA_MES')).toEqual(RESOLUTION_META.BECA_MES)
  })

  it('resolutionMeta falls back to a grey chip carrying the raw value for an unknown value', () => {
    expect(resolutionMeta('SOME_FUTURE_VALUE')).toEqual({
      icon: 'mdi-help-circle-outline',
      color: 'grey',
      label: 'SOME_FUTURE_VALUE',
    })
  })
})
