// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type {
  BatchKey,
  ChequePaymentData,
  ChequeRowFields,
  ChequeSummary,
  ExportSummary,
  InvalidBankRow,
  ManualTransferPaymentData,
  ManualTransferRowFields,
  ManualTransferSummary,
  MarkChequePayload,
  MarkManualTransferPayload,
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
  campus: 'MERIDA',
  period_year: 2026,
  period_month: 9,
  batch_type: 'NORMAL',
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
  advance_payment_amount: '0.00',
  advance_paid_divergence_reason: null,
  excluded_from_bank_file: false,
  snapshot_temporary_increase_amount: null,
  snapshot_temporary_increase_reason: null,
  snapshot_scholarship_type: 'IU',
  base_amount: '1000.00',
  snapshot_monto_apoyo: null,
  payment_batch_id: null,
  status: 'DRAFT',
  snapshot_generation: 'Generación 9',
  snapshot_generation_id: 9,
  snapshot_gross_amount: '1000.00',
  discount_percentage: '0',
  snapshot_discount_percentage: null,
  final_amount: '1000.00',
  amount_pending_from_previous: '0.00',
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

const buildChequeFields = (overrides: Partial<ChequeRowFields> = {}): ChequeRowFields => ({
  payment_method: 'CHEQUE',
  paid_payment_method: null,
  manual_payments: [],
  cheque_beneficiary: null,
  ...overrides,
})

const buildChequeSummary = (overrides: Partial<ChequeSummary> = {}): ChequeSummary => ({
  total: 1,
  ready: 1,
  paid: 0,
  blocking: 0,
  ready_amount: '1000.00',
  paid_amount: '0.00',
  ready_beca_amount: '0.00',
  ready_apoyo_amount: '0.00',
  paid_beca_amount: '0.00',
  paid_apoyo_amount: '0.00',
  ...overrides,
})

const buildChequePaymentData = (overrides: Partial<ChequePaymentData> = {}): ChequePaymentData => ({
  refrend_id: 7,
  status: 'PAID',
  workflow_status: 'CLOSED',
  paid_payment_method: 'CHEQUE',
  manual_payments: [
    { concept: 'beca', method: 'CHEQUE', reference: '000123', amount: '800.00', paid_at: '2026-10-20', notes: null },
    { concept: 'apoyo', method: 'CHEQUE', reference: '000124', amount: '200.00', paid_at: '2026-10-20', notes: null },
  ],
  locked_at: '2026-10-20T10:00:00Z',
  ...overrides,
})

const buildMarkPayload = (): MarkChequePayload => ({
  references: { beca: '000123', apoyo: '000124' },
  expected_amounts: { beca: '800.00', apoyo: '200.00' },
  paid_at: '2026-10-20',
  notes: 'Entregado en sede',
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
    scholarship_type: 'IU',
    base_amount: '1000.00',
    monto_apoyo: null,
    temporary_increase_amount: null,
    temporary_increase_reason: null,
    gross_amount: '1000.00',
    academic_discount_percentage: null,
    academic_discount_reason: null,
    academic_discount_amount: null,
    discount_percentage: '0.00',
    discount_amount: '0.00',
    discount_label: 'Descuentos por penalizaciones',
    telmex_covered_amount: '0.00',
    manual_adjustment: null,
    amount_pending_from_previous: '0.00',
    advance_payment_amount: null,
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
  advance_payment: {
    settled_as_advance: false,
    origin_period_year: null,
    origin_period_month: null,
    settled_amount: null,
    settled_status: null,
    settled_resolution_type: null,
    divergence_reason: null,
    reached_at: null,
    has_registered_batch: false,
    registered_months_count: null,
    registered_total_amount: null,
    registered_cause: null,
    registered_notes: null,
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

    // Regression guard (bug fix): the backend returns 409 for TWO distinct
    // cases — stale expected_count/expected_total (data.count/data.total_amount)
    // AND "a batch already exists for this campus+year+month" (data.batch_id).
    // Collapsing both into "stale" shows a misleading count 0 / $0.00 result,
    // so "already_processed" MUST be surfaced distinctly whenever the 409
    // body carries a numeric batch_id.
    it('returns a distinct "already_processed" result on 409 when the body carries batch_id', async () => {
      mockAxiosPost.mockRejectedValueOnce({
        response: {
          status: 409,
          data: { res: false, msg: 'Este lote ya fue procesado anteriormente.', data: { batch_id: 42 } },
        },
      })

      const store = usePaymentsStore()
      const result = await store.processBatch(buildKey(), 1, '1000.00')

      expect(result).toEqual({ status: 'already_processed', batchId: 42 })
    })

    // Regression guard: a 409 WITHOUT batch_id must still map to "stale",
    // exactly as before — this is the case this fix must not break.
    it('still returns "stale" on 409 when the body has no batch_id', async () => {
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

  describe('processBatch EMPTY_BATCH', () => {
    it('returns a distinct "empty_batch" result (with the server msg) on 422 EMPTY_BATCH, not "blocking"', async () => {
      mockAxiosPost.mockRejectedValueOnce({
        response: {
          status: 422,
          data: {
            res: false,
            msg: 'No hay becarios con pago por transferencia en este lote.',
            code: 'EMPTY_BATCH',
            data: {},
          },
        },
      })

      const store = usePaymentsStore()
      const result = await store.processBatch(buildKey(), 0, '0.00')

      expect(result).toEqual({
        status: 'empty_batch',
        msg: 'No hay becarios con pago por transferencia en este lote.',
      })
    })
  })

  describe('fetchBatch concept totals', () => {
    const zero = { beca: '0.00', apoyo: '0.00', total: '0.00' }
    const conceptTotals = {
      channels: {
        bbva: { ready: { beca: '1000.00', apoyo: '0.00', total: '1000.00' }, paid: zero },
        manual_transfer: { ready: zero, paid: zero },
        cheque: { ready: zero, paid: zero },
      },
      overall: { ready: { beca: '1000.00', apoyo: '0.00', total: '1000.00' }, paid: zero },
    }

    it('stores concept_totals from the index response', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          res: true,
          data: { rows: [], summary: buildSummary(), concept_totals: conceptTotals, batch: { batch_id: null, is_paid: false } },
        },
      })

      const store = usePaymentsStore()
      await store.fetchBatch(buildKey())

      expect(store.conceptTotals).toEqual(conceptTotals)
    })

    it('defaults conceptTotals to null when the response omits it', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { res: true, data: { rows: [], summary: buildSummary(), batch: { batch_id: null, is_paid: false } } },
      })

      const store = usePaymentsStore()
      await store.fetchBatch(buildKey())

      expect(store.conceptTotals).toBeNull()
    })
  })

  describe('fetchBatch cheque state', () => {
    it('stores cheque_rows and cheque_summary from the index response', async () => {
      const chequeRow = { ...buildRow({ refrend_id: 7 }), ...buildChequeFields() }
      const chequeSummary = buildChequeSummary()
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          res: true,
          data: {
            rows: [buildRow()],
            summary: buildSummary(),
            cheque_rows: [chequeRow],
            cheque_summary: chequeSummary,
            batch: { batch_id: null, is_paid: false },
          },
        },
      })

      const store = usePaymentsStore()
      await store.fetchBatch(buildKey())

      expect(store.chequeRows).toEqual([chequeRow])
      expect(store.chequeSummary).toEqual(chequeSummary)
    })

    it('defaults chequeRows to [] and chequeSummary to null when the response omits them', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { res: true, data: { rows: [], summary: buildSummary(), batch: { batch_id: null, is_paid: false } } },
      })

      const store = usePaymentsStore()
      await store.fetchBatch(buildKey())

      expect(store.chequeRows).toEqual([])
      expect(store.chequeSummary).toBeNull()
    })
  })

  describe('markChequePaid', () => {
    const payload = buildMarkPayload()
    const reject = (status: number, data: Record<string, unknown>): void => {
      mockAxiosPost.mockRejectedValueOnce({ response: { status, data } })
    }

    it('POSTs the payload to cheque-payment and returns success with the data on 200', async () => {
      const data = buildChequePaymentData()
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data } })

      const store = usePaymentsStore()
      const result = await store.markChequePaid(7, payload)

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/scholarship-payments/7/cheque-payment', payload)
      expect(result).toEqual({ status: 'success', data })
    })

    it.each([
      [409, 'ALREADY_PAID', 'already_paid'],
      [422, 'NOT_CHEQUE_METHOD', 'not_cheque'],
      [409, 'CONCEPT_SPLIT_CHANGED', 'concept_split_changed'],
    ])('maps %i %s to %s carrying the server msg', async (httpStatus, code, expected) => {
      reject(httpStatus, { res: false, msg: `msg ${code}`, code, data: {} })

      const store = usePaymentsStore()
      const result = await store.markChequePaid(7, payload)

      expect(result).toEqual({ status: expected, msg: `msg ${code}` })
    })

    it.each(['beca', 'apoyo'])('maps CHEQUE_REFERENCE_TAKEN for %s carrying the concept', async (concept) => {
      reject(422, { res: false, msg: 'Referencia repetida', code: 'CHEQUE_REFERENCE_TAKEN', data: { concept } })

      const store = usePaymentsStore()
      const result = await store.markChequePaid(7, payload)

      expect(result).toEqual({ status: 'cheque_reference_taken', msg: 'Referencia repetida', concept })
    })

    it('maps CHEQUE_REFERENCE_TAKEN without a concept to a null concept', async () => {
      reject(422, { res: false, msg: 'Referencia repetida', code: 'CHEQUE_REFERENCE_TAKEN', data: {} })

      const store = usePaymentsStore()
      const result = await store.markChequePaid(7, payload)

      expect(result).toEqual({ status: 'cheque_reference_taken', msg: 'Referencia repetida', concept: null })
    })

    it('maps 422 NOT_PAYABLE to not_payable with the reasons', async () => {
      const reasons = [{ code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' }]
      reject(422, { res: false, msg: 'No es pagable', code: 'NOT_PAYABLE', data: { reasons } })

      const store = usePaymentsStore()
      const result = await store.markChequePaid(7, payload)

      expect(result).toEqual({ status: 'not_payable', msg: 'No es pagable', reasons })
    })

    it('maps a Laravel 422 validation body to validation with field errors', async () => {
      const errors = { 'references.beca': ['La referencia de Beca es obligatoria.'] }
      reject(422, { message: 'The given data was invalid.', errors })

      const store = usePaymentsStore()
      const result = await store.markChequePaid(7, payload)

      expect(result).toEqual({ status: 'validation', msg: 'The given data was invalid.', errors })
    })

    it('maps 404 and 403 to error carrying the server msg', async () => {
      reject(404, { res: false, msg: 'Pago no encontrado', code: 'NOT_FOUND', data: null })

      const store = usePaymentsStore()
      const result = await store.markChequePaid(7, payload)

      expect(result).toEqual({ status: 'error', msg: 'Pago no encontrado' })
    })

    it('maps a network failure to error with a null msg', async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error('network error'))

      const store = usePaymentsStore()
      const result = await store.markChequePaid(7, payload)

      expect(result).toEqual({ status: 'error', msg: null })
    })
  })

  describe('revertChequePayment', () => {
    const reject = (status: number, data: Record<string, unknown>): void => {
      mockAxiosPost.mockRejectedValueOnce({ response: { status, data } })
    }

    it('POSTs the reason to cheque-payment/revert and returns success on 200', async () => {
      const data = buildChequePaymentData({ status: 'DRAFT', manual_payments: [] })
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data } })

      const store = usePaymentsStore()
      const result = await store.revertChequePayment(7, 'Cheque devuelto por el banco')

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/scholarship-payments/7/cheque-payment/revert', {
        reason: 'Cheque devuelto por el banco',
      })
      expect(result).toEqual({ status: 'success', data })
    })

    it.each([
      [422, 'NOT_CHEQUE_PAID', 'not_cheque'],
      [409, 'CYCLE_CLOSED', 'cycle_closed'],
      [409, 'TELMEX_REPAYMENT_EXISTS', 'telmex_repayment_exists'],
    ])('maps %i %s to %s carrying the server msg', async (httpStatus, code, expected) => {
      reject(httpStatus, { res: false, msg: `msg ${code}`, code, data: {} })

      const store = usePaymentsStore()
      const result = await store.revertChequePayment(7, 'Motivo suficientemente largo')

      expect(result).toEqual({ status: expected, msg: `msg ${code}` })
    })

    it('maps CHEQUE_LOG_MISSING to error with the server msg', async () => {
      reject(422, { res: false, msg: 'Falta el registro', code: 'CHEQUE_LOG_MISSING', data: {} })

      const store = usePaymentsStore()
      const result = await store.revertChequePayment(7, 'Motivo suficientemente largo')

      expect(result).toEqual({ status: 'error', msg: 'Falta el registro' })
    })

    it('maps a Laravel 422 validation body to validation', async () => {
      const errors = { reason: ['El motivo debe tener al menos 10 caracteres.'] }
      reject(422, { message: 'The given data was invalid.', errors })

      const store = usePaymentsStore()
      const result = await store.revertChequePayment(7, 'corto')

      expect(result).toEqual({ status: 'validation', msg: 'The given data was invalid.', errors })
    })
  })

  describe('fetchBatch manual transfer state', () => {
    it('stores manual_transfer_rows and manual_transfer_summary from the index response', async () => {
      const manualRow: PaymentBatchRow & ManualTransferRowFields = {
        ...buildRow({ refrend_id: 9 }),
        payment_method: 'MANUAL_TRANSFER',
        paid_payment_method: null,
        bank_code: '072',
        manual_payments: [],
      }
      const manualSummary: ManualTransferSummary = buildChequeSummary()
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          res: true,
          data: {
            rows: [],
            summary: buildSummary(),
            manual_transfer_rows: [manualRow],
            manual_transfer_summary: manualSummary,
            batch: { batch_id: null, is_paid: false },
          },
        },
      })

      const store = usePaymentsStore()
      await store.fetchBatch(buildKey())

      expect(store.manualTransferRows).toEqual([manualRow])
      expect(store.manualTransferSummary).toEqual(manualSummary)
    })

    it('defaults to [] / null when the response omits them', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { res: true, data: { rows: [], summary: buildSummary(), batch: { batch_id: null, is_paid: false } } },
      })

      const store = usePaymentsStore()
      await store.fetchBatch(buildKey())

      expect(store.manualTransferRows).toEqual([])
      expect(store.manualTransferSummary).toBeNull()
    })
  })

  describe('markManualTransferPaid', () => {
    const payload: MarkManualTransferPayload = {
      references: { beca: 'SPEI-0001', apoyo: 'SPEI-0002' },
      expected_amounts: { beca: '800.00', apoyo: '200.00' },
      paid_at: '2026-10-20',
      notes: 'Banorte',
    }
    const reject = (status: number, data: Record<string, unknown>): void => {
      mockAxiosPost.mockRejectedValueOnce({ response: { status, data } })
    }
    const buildData = (overrides: Partial<ManualTransferPaymentData> = {}): ManualTransferPaymentData => ({
      refrend_id: 7,
      status: 'PAID',
      workflow_status: 'CLOSED',
      paid_payment_method: 'MANUAL_TRANSFER',
      manual_payments: [
        { concept: 'beca', method: 'MANUAL_TRANSFER', reference: 'SPEI-0001', amount: '800.00', paid_at: '2026-10-20', notes: 'Banorte' },
        { concept: 'apoyo', method: 'MANUAL_TRANSFER', reference: 'SPEI-0002', amount: '200.00', paid_at: '2026-10-20', notes: 'Banorte' },
      ],
      locked_at: '2026-10-20T10:00:00Z',
      ...overrides,
    })

    it('POSTs the payload to manual-transfer-payment and returns success with the data', async () => {
      const data = buildData()
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data } })

      const store = usePaymentsStore()
      const result = await store.markManualTransferPaid(7, payload)

      expect(mockAxiosPost).toHaveBeenCalledWith(
        'api/admin/scholarship-payments/7/manual-transfer-payment',
        payload,
      )
      expect(result).toEqual({ status: 'success', data })
    })

    it.each([
      [409, 'ALREADY_PAID', 'already_paid'],
      [422, 'NOT_MANUAL_TRANSFER_METHOD', 'not_manual_transfer'],
      [409, 'CYCLE_CLOSED', 'cycle_closed'],
      [409, 'TELMEX_REPAYMENT_EXISTS', 'telmex_repayment_exists'],
      [409, 'CONCEPT_SPLIT_CHANGED', 'concept_split_changed'],
    ])('maps %i %s to %s carrying the server msg', async (httpStatus, code, expected) => {
      reject(httpStatus, { res: false, msg: `msg ${code}`, code, data: {} })

      const store = usePaymentsStore()
      const result = await store.markManualTransferPaid(7, payload)

      expect(result).toEqual({ status: expected, msg: `msg ${code}` })
    })

    it('maps TRANSFER_REFERENCE_TAKEN carrying the concept', async () => {
      reject(422, { res: false, msg: 'Folio repetido', code: 'TRANSFER_REFERENCE_TAKEN', data: { concept: 'apoyo' } })

      const store = usePaymentsStore()
      const result = await store.markManualTransferPaid(7, payload)

      expect(result).toEqual({ status: 'transfer_reference_taken', msg: 'Folio repetido', concept: 'apoyo' })
    })

    it('maps 422 NOT_PAYABLE to not_payable with the reasons', async () => {
      const reasons = [{ code: 'MISSING_BANK', message: 'Falta seleccionar banco' }]
      reject(422, { res: false, msg: 'No es pagable', code: 'NOT_PAYABLE', data: { reasons } })

      const store = usePaymentsStore()
      const result = await store.markManualTransferPaid(7, payload)

      expect(result).toEqual({ status: 'not_payable', msg: 'No es pagable', reasons })
    })

    it('maps a Laravel 422 validation body to validation with field errors', async () => {
      const errors = { 'references.apoyo': ['La referencia de Apoyo es obligatoria.'] }
      reject(422, { message: 'The given data was invalid.', errors })

      const store = usePaymentsStore()
      const result = await store.markManualTransferPaid(7, payload)

      expect(result).toEqual({ status: 'validation', msg: 'The given data was invalid.', errors })
    })

    it('maps a network failure to error with a null msg', async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error('network error'))

      const store = usePaymentsStore()
      const result = await store.markManualTransferPaid(7, payload)

      expect(result).toEqual({ status: 'error', msg: null })
    })
  })

  describe('revertManualTransferPayment', () => {
    const reject = (status: number, data: Record<string, unknown>): void => {
      mockAxiosPost.mockRejectedValueOnce({ response: { status, data } })
    }

    it('POSTs the reason to manual-transfer-payment/revert and returns success', async () => {
      const data = {
        refrend_id: 7,
        status: 'DRAFT',
        workflow_status: 'OPEN',
        paid_payment_method: null,
        manual_payments: [],
        locked_at: null,
      }
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data } })

      const store = usePaymentsStore()
      const result = await store.revertManualTransferPayment(7, 'Transferencia rechazada')

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/scholarship-payments/7/manual-transfer-payment/revert', {
        reason: 'Transferencia rechazada',
      })
      expect(result).toEqual({ status: 'success', data })
    })

    it.each([
      [422, 'NOT_MANUAL_TRANSFER_PAID', 'not_manual_transfer'],
      [409, 'CYCLE_CLOSED', 'cycle_closed'],
    ])('maps %i %s to %s carrying the server msg', async (httpStatus, code, expected) => {
      reject(httpStatus, { res: false, msg: `msg ${code}`, code, data: {} })

      const store = usePaymentsStore()
      const result = await store.revertManualTransferPayment(7, 'Motivo suficientemente largo')

      expect(result).toEqual({ status: expected, msg: `msg ${code}` })
    })

    it('maps TRANSFER_LOG_MISSING to error with the server msg', async () => {
      reject(422, { res: false, msg: 'Falta el registro', code: 'TRANSFER_LOG_MISSING', data: {} })

      const store = usePaymentsStore()
      const result = await store.revertManualTransferPayment(7, 'Motivo suficientemente largo')

      expect(result).toEqual({ status: 'error', msg: 'Falta el registro' })
    })
  })

  describe('fetchExportSummary', () => {
    const buildExportSummary = (overrides: Partial<ExportSummary> = {}): ExportSummary => ({
      count: 4,
      total_amount: '2600.02',
      batch_type: 'NORMAL',
      files: {
        beca: { count: 4, total_amount: '2400.02', filename: 'PAGO_MERIDA_202609_42_BECA.TXT' },
        apoyo: { count: 3, total_amount: '200.00', filename: 'PAGO_MERIDA_202609_42_APOYO.TXT' },
      },
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
        headers: { 'content-disposition': 'attachment; filename=PAGO_MERIDA_202609_42_APOYO.TXT' },})
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      const store = usePaymentsStore()
      const result = await store.downloadExportFile(42, 'apoyo')

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'api/admin/scholarship-payments/batches/42/export/apoyo',
        expect.objectContaining({ responseType: 'blob' }),
      )
      expect(result).toEqual({ status: 'success' })
      expect(createObjectURL).toHaveBeenCalledWith(blob)
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      expect(clickSpy.mock.contexts[0]).toHaveProperty('download', 'PAGO_MERIDA_202609_42_APOYO.TXT')

      clickSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    it('requests the beca file from its own concept route', async () => {
      stubUrlApi()
      mockAxiosGet.mockResolvedValueOnce({ data: new Blob(['x']), headers: {} })
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      const store = usePaymentsStore()
      await store.downloadExportFile(42, 'beca')

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'api/admin/scholarship-payments/batches/42/export/beca',
        expect.objectContaining({ responseType: 'blob' }),
      )

      clickSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    it('falls back to a concept-suffixed filename when Content-Disposition is missing', async () => {
      stubUrlApi()
      mockAxiosGet.mockResolvedValueOnce({ data: new Blob(['x']), headers: {} })
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      const store = usePaymentsStore()
      await store.downloadExportFile(42, 'apoyo')

      expect(clickSpy.mock.contexts[0]).toHaveProperty('download', 'PAGO_42_APOYO.TXT')

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
      const result = await store.downloadExportFile(42, 'beca')

      expect(result).toEqual({ status: 'blocked', invalidRows })
    })

    it('returns a generic "error" result on an unrelated failure, without throwing', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = usePaymentsStore()
      const result = await store.downloadExportFile(42, 'apoyo')

      expect(result).toEqual({ status: 'error' })
    })
  })
})
