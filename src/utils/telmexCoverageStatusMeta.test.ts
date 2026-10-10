import { describe, expect, it } from 'vitest'
import { telmexCoverageStatusMeta } from '@/utils/telmexCoverageStatusMeta'

describe('telmexCoverageStatusMeta', () => {
  it('returns the "Activa" label and a distinct color for ACTIVA', () => {
    const meta = telmexCoverageStatusMeta('ACTIVA')

    expect(meta.label).toBe('Activa')
    expect(meta.color).toBe('info')
  })

  it('returns the "En cobro" label and a distinct color for EN_COBRO', () => {
    const meta = telmexCoverageStatusMeta('EN_COBRO')

    expect(meta.label).toBe('En cobro')
    expect(meta.color).toBe('warning')
  })

  it('returns the "Liquidada" label and a distinct color for LIQUIDADA', () => {
    const meta = telmexCoverageStatusMeta('LIQUIDADA')

    expect(meta.label).toBe('Liquidada')
    expect(meta.color).toBe('success')
  })

  it('returns the "Cancelada" label and a distinct color for CANCELADA', () => {
    const meta = telmexCoverageStatusMeta('CANCELADA')

    expect(meta.label).toBe('Cancelada')
    expect(meta.color).toBe('error')
  })

  it('gives every status a different color (so the chips are visually distinguishable)', () => {
    const colors = new Set(
      (['ACTIVA', 'EN_COBRO', 'LIQUIDADA', 'CANCELADA'] as const).map((s) => telmexCoverageStatusMeta(s).color),
    )

    expect(colors.size).toBe(4)
  })
})
