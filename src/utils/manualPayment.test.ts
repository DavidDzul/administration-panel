import { describe, expect, it } from 'vitest'
import { manualPaymentInfo, manualPaymentNotes } from '@/utils/manualPayment'
import type { ManualPayment } from '@/interfaces/payment'

const payment = (overrides: Partial<ManualPayment>): ManualPayment => ({
  concept: 'beca',
  method: 'CHEQUE',
  reference: 'CH-1',
  amount: '800.00',
  paid_at: '2026-10-05',
  notes: null,
  ...overrides,
})

describe('manualPaymentInfo', () => {
  it('lists Beca then Apoyo references with the DD/MM/YYYY date once', () => {
    const info = manualPaymentInfo([
      payment({ concept: 'beca', reference: 'CH-77' }),
      payment({ concept: 'apoyo', reference: 'CH-78' }),
    ])
    expect(info).toBe('Beca: CH-77 · Apoyo: CH-78 · 05/10/2026')
  })

  it('handles a single concept', () => {
    expect(manualPaymentInfo([payment({ concept: 'apoyo', reference: 'X-9' })])).toBe('Apoyo: X-9 · 05/10/2026')
  })

  it('returns an empty string without payments', () => {
    expect(manualPaymentInfo([])).toBe('')
    expect(manualPaymentInfo(undefined)).toBe('')
  })
})

describe('manualPaymentNotes', () => {
  it('returns the first non-empty note, or null', () => {
    expect(manualPaymentNotes([payment({ notes: null }), payment({ notes: 'Entregado' })])).toBe('Entregado')
    expect(manualPaymentNotes([payment({ notes: null })])).toBeNull()
    expect(manualPaymentNotes(undefined)).toBeNull()
  })
})
