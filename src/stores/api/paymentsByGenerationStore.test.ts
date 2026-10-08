// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { GenerationSummaryGeneration, GenerationSummaryKey, PaymentBatchSummary } from '@/interfaces/payment'

const { mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
}))

vi.mock('@/axiosConfig', () => ({
  default: {
    get: mockAxiosGet,
  },
}))

import { usePaymentsByGenerationStore } from '@/stores/api/paymentsByGenerationStore'

const buildKey = (overrides: Partial<GenerationSummaryKey> = {}): GenerationSummaryKey => ({
  generation_id: 7,
  period_year: 2026,
  period_month: 9,
  ...overrides,
})

const buildSummary = (overrides: Partial<PaymentBatchSummary> = {}): PaymentBatchSummary => ({
  total: 1,
  ready: 1,
  blocking: 0,
  beca_amount: '1000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  total_amount: '1000.00',
  difference_amount: '0.00',
  ...overrides,
})

const buildGeneration = (overrides: Partial<GenerationSummaryGeneration> = {}): GenerationSummaryGeneration => ({
  id: 7,
  generation_name: 'Generación 2026-A',
  campus: 'MERIDA',
  ...overrides,
})

describe('paymentsByGenerationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
  })

  describe('fetchSummary', () => {
    it('GETs by-generation with the key as query params and populates summary/generation on success', async () => {
      const key = buildKey()
      const summary = buildSummary()
      const generation = buildGeneration()
      mockAxiosGet.mockResolvedValueOnce({
        data: { res: true, data: { summary, generation } },
      })

      const store = usePaymentsByGenerationStore()
      const result = await store.fetchSummary(key)

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'api/admin/scholarship-payments/by-generation',
        expect.objectContaining({ params: key }),
      )
      expect(result).toBe(true)
      expect(store.summary).toEqual(summary)
      expect(store.generation).toEqual(generation)
    })

    it('returns false (not a thrown error) when the fetch fails, without mutating prior state', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = usePaymentsByGenerationStore()
      const result = await store.fetchSummary(buildKey())

      expect(result).toBe(false)
      expect(store.summary).toBeNull()
      expect(store.generation).toBeNull()
    })
  })
})
