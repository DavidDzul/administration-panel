import { describe, expect, it } from 'vitest'
import { RESOLUTION_META, resolutionMeta } from '@/utils/resolutionMeta'

// sdd/resolution-status-visibility: the catalog behind the flags-column
// resolution chip. Mirrors psicol-panel's statusChip() icon/color choices
// for the 6 staff-selectable values (design D2).
describe('resolutionMeta', () => {
  it('RESOLUTION_META has exactly 7 keys (6 staff-selectable + 1 server-only)', () => {
    expect(Object.keys(RESOLUTION_META)).toHaveLength(7)
  })

  it('does not include PAGO_MESES — it is a psicol-panel-only menu key, never a resolution_type value', () => {
    expect(RESOLUTION_META).not.toHaveProperty('PAGO_MESES')
  })

  it('includes all 6 live resolution_type values from ScholarshipRefrendController, plus the server-only EGRESO_RETICULA', () => {
    expect(Object.keys(RESOLUTION_META).sort()).toEqual(
      [
        'BECA_MES',
        'SIN_PAGO',
        'RETENIDA',
        'BAJA_DEFINITIVA',
        'EGRESADO',
        'DESCUENTO_DEFINITIVO',
        'EGRESO_RETICULA',
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

  it.each(['SUSPENDIDA', 'REEMBOLSO_PARCIAL'])('retired value %s falls back to the generic grey chip', (value) => {
    expect(RESOLUTION_META).not.toHaveProperty(value)
    expect(resolutionMeta(value)).toEqual({ icon: 'mdi-help-circle-outline', color: 'grey', label: value })
  })

  it('resolutionMeta falls back to a grey chip carrying the raw value for an unknown value', () => {
    expect(resolutionMeta('SOME_FUTURE_VALUE')).toEqual({
      icon: 'mdi-help-circle-outline',
      color: 'grey',
      label: 'SOME_FUTURE_VALUE',
    })
  })

  it('EGRESO_RETICULA renders with the correct label, icon, and color', () => {
    expect(resolutionMeta('EGRESO_RETICULA')).toEqual({
      icon: 'mdi-account-clock-outline',
      color: 'indigo',
      label: 'Egresado (retícula)',
    })
  })

  it('EGRESO_RETICULA is visually and data-distinct from the manual EGRESADO entry (different icon and color)', () => {
    expect(RESOLUTION_META.EGRESO_RETICULA.icon).not.toBe(RESOLUTION_META.EGRESADO.icon)
    expect(RESOLUTION_META.EGRESO_RETICULA.color).not.toBe(RESOLUTION_META.EGRESADO.color)
  })
})
