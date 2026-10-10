// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { TelmexCoverage, EligibleTelmexBecario, TelmexCoverageStatement } from '@/interfaces/telmexCoverage'

const { mockAxiosGet, mockAxiosPost, mockAxiosPatch } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
  mockAxiosPatch: vi.fn(),
}))

vi.mock('@/axiosConfig', () => ({
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
    patch: mockAxiosPatch,
  },
}))

import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'

const buildCoverage = (overrides: Partial<TelmexCoverage> = {}): TelmexCoverage => ({
  id: 1,
  user_id: 10,
  becario_name: 'Juan Pérez',
  campus: 'MERIDA',
  generation: 'Gen 2024',
  scholarship_type_at_activation: 'TELMEX',
  status: 'ACTIVA',
  start_period: '2026-01-01',
  end_period: null,
  notes: null,
  cancel_reason: null,
  advanced: 0,
  repaid: 0,
  balance: 0,
  has_paid_covered_month: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const buildEligible = (overrides: Partial<EligibleTelmexBecario> = {}): EligibleTelmexBecario => ({
  id: 10,
  name: 'Juan Pérez',
  campus: 'MERIDA',
  generation: 'Gen 2024',
  scholarship_type: 'TELMEX',
  ...overrides,
})

describe('telmexCoverageStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    mockAxiosPatch.mockReset()
  })

  describe('fetchCoverages', () => {
    it('fetches the coverage list (no filters) and maps it by id', async () => {
      const coverage = buildCoverage()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data: [coverage] } })

      const store = useTelmexCoverageStore()
      const result = await store.fetchCoverages()

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/telmex-coverages', { params: {} })
      expect(result).toBe(true)
      expect(store.allCoverages).toEqual(new Map([[coverage.id, coverage]]))
    })

    it('passes status and search filters as query params', async () => {
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data: [] } })

      const store = useTelmexCoverageStore()
      await store.fetchCoverages({ status: 'EN_COBRO', search: 'Juan' })

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/telmex-coverages', {
        params: { status: 'EN_COBRO', search: 'Juan' },
      })
    })

    it('returns false and leaves allCoverages untouched on failure', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = useTelmexCoverageStore()
      const result = await store.fetchCoverages()

      expect(result).toBe(false)
      expect(store.allCoverages.size).toBe(0)
    })
  })

  describe('fetchEligibleBecarios', () => {
    it('fetches the eligible becarios list', async () => {
      const eligible = buildEligible()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data: [eligible] } })

      const store = useTelmexCoverageStore()
      const result = await store.fetchEligibleBecarios()

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/telmex-coverages/eligible')
      expect(result).toBe(true)
      expect(store.eligibleBecarios).toEqual([eligible])
    })

    it('returns false on failure', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = useTelmexCoverageStore()
      const result = await store.fetchEligibleBecarios()

      expect(result).toBe(false)
      expect(store.eligibleBecarios).toEqual([])
    })
  })

  describe('fetchCoverageStatement', () => {
    it('returns the statement on 200', async () => {
      const statement: TelmexCoverageStatement = { coverage: buildCoverage(), months: [], payments: [] }
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data: statement } })

      const store = useTelmexCoverageStore()
      const result = await store.fetchCoverageStatement(1)

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/telmex-coverages/1')
      expect(result).toEqual(statement)
    })

    it('returns null (does not throw) when the backend responds 404', async () => {
      mockAxiosGet.mockRejectedValueOnce({
        response: { status: 404, data: { res: false, msg: 'Cobertura no encontrada.' } },
      })

      const store = useTelmexCoverageStore()
      const result = await store.fetchCoverageStatement(999)

      expect(result).toBeNull()
    })
  })

  describe('activateCoverage', () => {
    it('POSTs the payload and stores the created coverage', async () => {
      const created = buildCoverage({ id: 2, user_id: 20 })
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: created } })

      const store = useTelmexCoverageStore()
      const result = await store.activateCoverage({ user_id: 20, start_period: '2026-01-01' })

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/telmex-coverages', {
        user_id: 20,
        start_period: '2026-01-01',
      })
      expect(result).toEqual(created)
      expect(store.allCoverages.get(2)).toEqual(created)
    })

    it('propagates a 422 (becario is IU-only, or already has a coverage) error to the caller', async () => {
      const error = {
        response: { status: 422, data: { res: false, msg: 'El becario no es elegible para cobertura Telmex.' } },
      }
      mockAxiosPost.mockRejectedValueOnce(error)

      const store = useTelmexCoverageStore()

      await expect(store.activateCoverage({ user_id: 20, start_period: '2026-01-01' })).rejects.toEqual(error)
      expect(store.allCoverages.size).toBe(0)
    })

    it('propagates a 403 (unauthorized) error to the caller', async () => {
      const error = { response: { status: 403, data: { res: false, msg: 'No autorizado.' } } }
      mockAxiosPost.mockRejectedValueOnce(error)

      const store = useTelmexCoverageStore()

      await expect(store.activateCoverage({ user_id: 20, start_period: '2026-01-01' })).rejects.toEqual(error)
    })
  })

  describe('endCoverage', () => {
    it('POSTs telmex_start_period and stores the updated coverage', async () => {
      const updated = buildCoverage({ status: 'EN_COBRO', end_period: '2026-02-28' })
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: updated } })

      const store = useTelmexCoverageStore()
      const result = await store.endCoverage(1, { telmex_start_period: '2026-03-01' })

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/telmex-coverages/1/end', {
        telmex_start_period: '2026-03-01',
      })
      expect(result).toEqual(updated)
      expect(store.allCoverages.get(1)).toEqual(updated)
    })

    it('propagates a 422 (telmex_start_period before start_period or before last paid period) error', async () => {
      const error = { response: { status: 422, data: { res: false, msg: 'Periodo inválido.' } } }
      mockAxiosPost.mockRejectedValueOnce(error)

      const store = useTelmexCoverageStore()

      await expect(store.endCoverage(1, { telmex_start_period: '2025-01-01' })).rejects.toEqual(error)
    })
  })

  describe('cancelCoverage', () => {
    it('POSTs the mandatory reason and stores the cancelled coverage', async () => {
      const cancelled = buildCoverage({ status: 'CANCELADA', cancel_reason: 'Becario egresó de IU.' })
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: cancelled } })

      const store = useTelmexCoverageStore()
      const result = await store.cancelCoverage(1, { reason: 'Becario egresó de IU.' })

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/telmex-coverages/1/cancel', {
        reason: 'Becario egresó de IU.',
      })
      expect(result).toEqual(cancelled)
      expect(store.allCoverages.get(1)).toEqual(cancelled)
    })

    it('propagates a 422 (reason missing or too short) error to the caller', async () => {
      const error = { response: { status: 422, data: { res: false, errors: { reason: ['Campo requerido.'] } } } }
      mockAxiosPost.mockRejectedValueOnce(error)

      const store = useTelmexCoverageStore()

      await expect(store.cancelCoverage(1, { reason: '' })).rejects.toEqual(error)
    })
  })

  describe('reactivateCoverage', () => {
    it('POSTs to the reactivate endpoint and stores the reactivated coverage', async () => {
      const reactivated = buildCoverage({ status: 'ACTIVA', cancel_reason: null })
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: reactivated } })

      const store = useTelmexCoverageStore()
      const result = await store.reactivateCoverage(1)

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/telmex-coverages/1/reactivate')
      expect(result).toEqual(reactivated)
      expect(store.allCoverages.get(1)).toEqual(reactivated)
    })

    it('propagates a 422 (a covered month was already paid) error to the caller', async () => {
      const error = { response: { status: 422, data: { res: false, msg: 'No se puede reactivar: ya hubo meses pagados.' } } }
      mockAxiosPost.mockRejectedValueOnce(error)

      const store = useTelmexCoverageStore()

      await expect(store.reactivateCoverage(1)).rejects.toEqual(error)
    })
  })

  describe('registerPayment', () => {
    it('POSTs the payment payload', async () => {
      const payment = {
        id: 5,
        coverage_id: 1,
        amount: 500,
        paid_at: '2026-03-01',
        reference: 'TRX-1',
        notes: null,
        is_voided: false,
        voided_at: null,
        void_reason: null,
        created_at: '2026-03-01T00:00:00Z',
      }
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: payment } })

      const store = useTelmexCoverageStore()
      const result = await store.registerPayment(1, { amount: 500, paid_at: '2026-03-01', reference: 'TRX-1' })

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/telmex-coverages/1/payments', {
        amount: 500,
        paid_at: '2026-03-01',
        reference: 'TRX-1',
      })
      expect(result).toEqual(payment)
    })

    it('propagates a 422 (amount exceeds balance) error to the caller', async () => {
      const error = { response: { status: 422, data: { res: false, msg: 'El monto excede el saldo.' } } }
      mockAxiosPost.mockRejectedValueOnce(error)

      const store = useTelmexCoverageStore()

      await expect(store.registerPayment(1, { amount: 9999, paid_at: '2026-03-01' })).rejects.toEqual(error)
    })
  })

  describe('voidPayment', () => {
    it('PATCHes the void reason', async () => {
      const voided = {
        id: 5,
        coverage_id: 1,
        amount: 500,
        paid_at: '2026-03-01',
        reference: 'TRX-1',
        notes: null,
        is_voided: true,
        voided_at: '2026-03-05T00:00:00Z',
        void_reason: 'Registrado por error.',
        created_at: '2026-03-01T00:00:00Z',
      }
      mockAxiosPatch.mockResolvedValueOnce({ data: { res: true, data: voided } })

      const store = useTelmexCoverageStore()
      const result = await store.voidPayment(1, 5, { void_reason: 'Registrado por error.' })

      expect(mockAxiosPatch).toHaveBeenCalledWith('api/admin/telmex-coverages/1/payments/5/void', {
        void_reason: 'Registrado por error.',
      })
      expect(result).toEqual(voided)
    })

    it('propagates a 422 (void_reason missing) error to the caller', async () => {
      const error = { response: { status: 422, data: { res: false, errors: { void_reason: ['Campo requerido.'] } } } }
      mockAxiosPatch.mockRejectedValueOnce(error)

      const store = useTelmexCoverageStore()

      await expect(store.voidPayment(1, 5, { void_reason: '' })).rejects.toEqual(error)
    })
  })
})
