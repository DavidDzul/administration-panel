// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type {
  BatchKey,
  ExportSummary,
  InvalidBankRow,
  PaymentBatchRow,
  PaymentBatchSummary,
  PaymentDocument,
} from '@/interfaces/payment'

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
  only_pending_from_previous: false,
  resolution_type: null,
  resolution_cause: null,
  advance_paid: false,
  advance_paid_amount: null,
  advance_paid_origin_year: null,
  advance_paid_origin_month: null,
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
  retentions: {
    ledger_applied: [],
    ledger_applied_total: '0.00',
    origin_withholding: null,
    attendance_discounts: [],
    definitive_discount: null,
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
      mockAxiosGet.mockResolvedValueOnce({
        data: { res: true, data: { rows: [row], summary, batch: { batch_id: null, is_paid: false } } },
      })

      const store = usePaymentsStore()
      const result = await store.fetchBatch(key)

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'api/admin/scholarship-payments',
        expect.objectContaining({ params: key }),
      )
      expect(result).toBe(true)
      expect(store.rows).toEqual([row])
      expect(store.summary).toEqual(summary)
      expect(store.batchId).toBeNull()
      expect(store.isPaid).toBe(false)
    })

    // D3 — this is what lets the SPA reach the export action after a page
    // reload: `index()`'s `data.batch` block, not the transient value
    // processBatch() sets.
    it('populates batchId/isPaid from data.batch when the batch key is already paid', async () => {
      const row = buildRow()
      const summary = buildSummary()
      mockAxiosGet.mockResolvedValueOnce({
        data: { res: true, data: { rows: [row], summary, batch: { batch_id: 42, is_paid: true } } },
      })

      const store = usePaymentsStore()
      await store.fetchBatch(buildKey())

      expect(store.batchId).toBe(42)
      expect(store.isPaid).toBe(true)
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

  describe('fetchExportSummary', () => {
    const buildExportSummary = (overrides: Partial<ExportSummary> = {}): ExportSummary => ({
      count: 4,
      total_amount: '2600.02',
      filename: 'PAGO_1_MERIDA_202609_42.TXT',
      ...overrides,
    })

    it('GETs the batch export summary and returns it on success', async () => {
      const exportSummary = buildExportSummary()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data: exportSummary } })

      const store = usePaymentsStore()
      const result = await store.fetchExportSummary(42)

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/scholarship-payments/batches/42/export/summary')
      expect(result).toEqual(exportSummary)
    })

    it('returns null (not a thrown error) when the fetch fails', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = usePaymentsStore()
      const result = await store.fetchExportSummary(42)

      expect(result).toBeNull()
    })
  })

  // D6 — first blob download in this codebase. Auth is a Bearer header set
  // on axios.defaults, so this MUST go through axios with
  // `responseType: 'blob'`, never window.open/<a href>.
  describe('downloadExportFile', () => {
    const stubUrlApi = (): { createObjectURL: ReturnType<typeof vi.fn>; revokeObjectURL: ReturnType<typeof vi.fn> } => {
      const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      const revokeObjectURL = vi.fn()
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
      return { createObjectURL, revokeObjectURL }
    }

    it('GETs the file with responseType blob and triggers a browser download, without leaking the object URL', async () => {
      const { createObjectURL, revokeObjectURL } = stubUrlApi()
      const blob = new Blob(['fake bank file content'], { type: 'text/plain' })
      mockAxiosGet.mockResolvedValueOnce({
        data: blob,
        headers: { 'content-disposition': 'attachment; filename=PAGO_1_MERIDA_202609_42.TXT' },
      })
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      const store = usePaymentsStore()
      const result = await store.downloadExportFile(42)

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'api/admin/scholarship-payments/batches/42/export',
        expect.objectContaining({ responseType: 'blob' }),
      )
      expect(result).toEqual({ status: 'success' })
      expect(createObjectURL).toHaveBeenCalledWith(blob)
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

      clickSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    // This is the genuinely-easy-to-get-wrong case: with `responseType:
    // 'blob'` set, axios hands a 422 error body back as a Blob too, NOT
    // parsed JSON — the store must .text() it, then JSON.parse it.
    it('unpacks a 422 blob error body into invalidRows instead of treating it as opaque binary', async () => {
      const invalidRows: InvalidBankRow[] = [
        {
          refrend_id: 3,
          snapshot_name: 'Grace Hopper',
          account_number: 'ABC123',
          rfc: null,
          reasons: [{ code: 'INVALID_ACCOUNT_NUMBER', message: 'Número de cuenta inválido: debe ser numérico de 9 o 10 dígitos' }],
        },
      ]
      const errorBody = JSON.stringify({
        res: false,
        msg: 'El lote tiene becarios con datos bancarios inválidos.',
        data: { invalid_rows: invalidRows },
      })
      const errorBlob = new Blob([errorBody], { type: 'application/json' })
      mockAxiosGet.mockRejectedValueOnce({ response: { status: 422, data: errorBlob } })

      const store = usePaymentsStore()
      const result = await store.downloadExportFile(42)

      expect(result).toEqual({ status: 'blocked', invalidRows })
    })

    it('returns a generic "error" result on an unrelated failure, without throwing', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = usePaymentsStore()
      const result = await store.downloadExportFile(42)

      expect(result).toEqual({ status: 'error' })
    })
  })
})
