// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { BatchKey, PaymentBatchRow, PaymentBatchSummary, PaymentDocument } from '@/interfaces/payment'

const { mockAxiosGet, mockAxiosPost } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
}))

vi.mock('@/axiosConfig', () => ({
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
  },
}))

import { usePaymentsStore } from '@/stores/api/paymentsStore'

const buildKey = (overrides: Partial<BatchKey> = {}): BatchKey => ({
  generation_id: 1,
  campus: 'MERIDA',
  period_year: 2026,
  period_month: 9,
  ...overrides,
})

const buildRow = (overrides: Partial<PaymentBatchRow> = {}): PaymentBatchRow => ({
  refrend_id: 1,
  user_id: 1,
  snapshot_name: 'Ada Lovelace',
  enrollment: 'A0001',
  bank_name: 'BBVA',
  account_number: '012180001234567895',
  total_to_pay: '1000.00',
  is_payable: true,
  blocking_reasons: [],
  outcome: null,
  outcome_reason: null,
  has_incident: false,
  has_pending_from_previous: false,
  ...overrides,
})

const buildSummary = (overrides: Partial<PaymentBatchSummary> = {}): PaymentBatchSummary => ({
  total: 1,
  ready: 1,
  blocking: 0,
  total_amount: '1000.00',
  ...overrides,
})

const buildDocument = (overrides: Partial<PaymentDocument> = {}): PaymentDocument => ({
  refrend_id: 1,
  user_id: 1,
  enrollment: 'A0001',
  snapshot_name: 'Ada Lovelace',
  incidents: [],
  carryover_months_count: null,
  carryover_months_detail: null,
  carryover_percentage: null,
  atencion_observations: null,
  pedagogia_observations: null,
  resolution_notes: null,
  amount_breakdown: {
    base_amount: '1000.00',
    discount_percentage: '0.00',
    discount_amount: '0.00',
    amount_pending_from_previous: '0.00',
    refund_amount_from_previous: '0.00',
    final_amount: '1000.00',
    total_to_pay: '1000.00',
  },
  ...overrides,
})

describe('paymentsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
  })

  describe('fetchBatch', () => {
    it('GETs the batch with the key as query params and populates rows/summary on success', async () => {
      const key = buildKey()
      const row = buildRow()
      const summary = buildSummary()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data: { rows: [row], summary } } })

      const store = usePaymentsStore()
      const result = await store.fetchBatch(key)

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'api/admin/scholarship-payments',
        expect.objectContaining({ params: key }),
      )
      expect(result).toBe(true)
      expect(store.rows).toEqual([row])
      expect(store.summary).toEqual(summary)
    })

    it('returns false (not a thrown error) when the fetch fails', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = usePaymentsStore()
      const result = await store.fetchBatch(buildKey())

      expect(result).toBe(false)
    })
  })

  describe('fetchDocument', () => {
    it('GETs the document by refrend id and populates document on success', async () => {
      const document = buildDocument()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data: document } })

      const store = usePaymentsStore()
      const result = await store.fetchDocument(1)

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/scholarship-payments/1/document')
      expect(result).toBe(true)
      expect(store.document).toEqual(document)
    })

    it('returns false (not a thrown error) when the fetch fails', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = usePaymentsStore()
      const result = await store.fetchDocument(1)

      expect(result).toBe(false)
    })
  })

  describe('processBatch', () => {
    it('POSTs the key + expected_count/expected_total and returns a success result on 200', async () => {
      const key = buildKey()
      const paidRow = buildRow({ outcome: 'PAID' })
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: { batch_id: 42, rows: [paidRow] } } })

      const store = usePaymentsStore()
      const result = await store.processBatch(key, 1, '1000.00')

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/scholarship-payments/process', {
        ...key,
        expected_count: 1,
        expected_total: '1000.00',
      })
      expect(result).toEqual({ status: 'success', batchId: 42, rows: [paidRow] })
      expect(store.batchId).toBe(42)
      expect(store.rows).toEqual([paidRow])
    })

    // 422 = blocking rows — MUST be surfaced distinctly from a generic
    // error, per design's explicit requirement (defense-in-depth server gate).
    it('returns a distinct "blocking" result on 422, without throwing', async () => {
      const blockingRow = buildRow({
        is_payable: false,
        blocking_reasons: [{ code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' }],
      })
      mockAxiosPost.mockRejectedValueOnce({
        response: { status: 422, data: { res: false, msg: 'blocked', data: { blocking_rows: [blockingRow] } } },
      })

      const store = usePaymentsStore()
      const result = await store.processBatch(buildKey(), 1, '1000.00')

      expect(result).toEqual({ status: 'blocking', blockingRows: [blockingRow] })
    })

    // 409 = stale expected_count/expected_total — MUST be surfaced distinctly
    // as "reload", not as a generic network error.
    it('returns a distinct "stale" result on 409, without throwing', async () => {
      mockAxiosPost.mockRejectedValueOnce({
        response: {
          status: 409,
          data: { res: false, msg: 'stale', data: { count: 2, total_amount: '2000.00' } },
        },
      })

      const store = usePaymentsStore()
      const result = await store.processBatch(buildKey(), 1, '1000.00')

      expect(result).toEqual({ status: 'stale', count: 2, totalAmount: '2000.00' })
    })

    it('returns a generic "error" result on an unrelated failure (network/500)', async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error('network error'))

      const store = usePaymentsStore()
      const result = await store.processBatch(buildKey(), 1, '1000.00')

      expect(result).toEqual({ status: 'error' })
    })
  })
})
