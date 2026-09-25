// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { usePaymentsPage } from '@/composables/usePaymentsPage'
import { usePaymentsStore } from '@/stores/api/paymentsStore'
import type { DownloadExportResult } from '@/stores/api/paymentsStore'
import { useGenerationStore } from '@/stores/api/generationStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { ExportSummary, InvalidBankRow, PaymentBatchRow, PaymentBatchSummary } from '@/interfaces/payment'
import type { Generation } from '@/interfaces/generation'

// `onBeforeMount`/`watch` inside a plain composable only register against a
// real active component instance — same rationale as usePersonsPage.test.ts's
// withSetup helper (D4).
function withSetup<T>(composable: () => T): T {
  let result!: T
  mount(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
  )
  return result
}

const buildGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 1,
  campus: 'MERIDA',
  generation_active: true,
  generation_name: 'Generación 1',
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

describe('usePaymentsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not fetch the batch until all 4 filters are set', async () => {
    const paymentsStore = usePaymentsStore()
    const fetchBatchSpy = vi.spyOn(paymentsStore, 'fetchBatch').mockResolvedValue(true)
    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const result = withSetup(() => usePaymentsPage())
    await flushPromises()

    expect(fetchBatchSpy).not.toHaveBeenCalled()

    result.campus.value = 'MERIDA'
    result.generationId.value = 1
    await flushPromises()
    expect(fetchBatchSpy).not.toHaveBeenCalled()

    result.periodYear.value = 2026
    await flushPromises()
    expect(fetchBatchSpy).not.toHaveBeenCalled()

    result.periodMonth.value = 9
    await flushPromises()

    expect(fetchBatchSpy).toHaveBeenCalledTimes(1)
    expect(fetchBatchSpy).toHaveBeenCalledWith({
      generation_id: 1,
      campus: 'MERIDA',
      period_year: 2026,
      period_month: 9,
    })
  })

  it('refetches when an already-complete filter set changes', async () => {
    const paymentsStore = usePaymentsStore()
    const fetchBatchSpy = vi.spyOn(paymentsStore, 'fetchBatch').mockResolvedValue(true)
    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const result = withSetup(() => usePaymentsPage())
    result.campus.value = 'MERIDA'
    result.generationId.value = 1
    result.periodYear.value = 2026
    result.periodMonth.value = 9
    await flushPromises()
    expect(fetchBatchSpy).toHaveBeenCalledTimes(1)

    result.periodMonth.value = 10
    await flushPromises()

    expect(fetchBatchSpy).toHaveBeenCalledTimes(2)
    expect(fetchBatchSpy).toHaveBeenLastCalledWith({
      generation_id: 1,
      campus: 'MERIDA',
      period_year: 2026,
      period_month: 10,
    })
  })

  it('canProcess is false when the summary has any blocking row', async () => {
    const paymentsStore = usePaymentsStore()
    vi.spyOn(paymentsStore, 'fetchBatch').mockImplementation(async () => {
      paymentsStore.rows = [buildRow(), buildRow({ refrend_id: 2, is_payable: false })]
      paymentsStore.summary = buildSummary({ total: 2, ready: 1, blocking: 1 })
      return true
    })
    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const result = withSetup(() => usePaymentsPage())
    result.campus.value = 'MERIDA'
    result.generationId.value = 1
    result.periodYear.value = 2026
    result.periodMonth.value = 9
    await flushPromises()

    expect(result.canProcess.value).toBe(false)
  })

  it('canProcess is true when the summary has zero blocking rows and all rows are loaded', async () => {
    const paymentsStore = usePaymentsStore()
    vi.spyOn(paymentsStore, 'fetchBatch').mockImplementation(async () => {
      paymentsStore.rows = [buildRow()]
      paymentsStore.summary = buildSummary({ total: 1, ready: 1, blocking: 0 })
      return true
    })
    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const result = withSetup(() => usePaymentsPage())
    result.campus.value = 'MERIDA'
    result.generationId.value = 1
    result.periodYear.value = 2026
    result.periodMonth.value = 9
    await flushPromises()

    expect(result.canProcess.value).toBe(true)
  })

  it('confirmProcess calls processBatch with the current key + summary totals', async () => {
    const paymentsStore = usePaymentsStore()
    vi.spyOn(paymentsStore, 'fetchBatch').mockImplementation(async () => {
      paymentsStore.rows = [buildRow()]
      paymentsStore.summary = buildSummary({ total: 1, ready: 1, blocking: 0, total_amount: '1000.00' })
      return true
    })
    const processBatchSpy = vi
      .spyOn(paymentsStore, 'processBatch')
      .mockResolvedValue({ status: 'success', batchId: 7, rows: [buildRow({ outcome: 'PAID' })] })
    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const result = withSetup(() => usePaymentsPage())
    result.campus.value = 'MERIDA'
    result.generationId.value = 1
    result.periodYear.value = 2026
    result.periodMonth.value = 9
    await flushPromises()

    const outcome = await result.confirmProcess()
    await flushPromises()

    expect(processBatchSpy).toHaveBeenCalledWith(
      { generation_id: 1, campus: 'MERIDA', period_year: 2026, period_month: 9 },
      1,
      '1000.00',
    )
    expect(outcome).toEqual({ status: 'success', batchId: 7, rows: [buildRow({ outcome: 'PAID' })] })
    expect(result.processResult.value).toEqual({ status: 'success', batchId: 7, rows: [buildRow({ outcome: 'PAID' })] })
  })

  it('exposes hasProcessPermission mirrored from authStore.processPayments', async () => {
    const paymentsStore = usePaymentsStore()
    vi.spyOn(paymentsStore, 'fetchBatch').mockResolvedValue(true)
    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const authStore = useAuthStore()
    authStore.permissions = ['ADM_READ_PAYMENTS', 'ADM_PROCESS_PAYMENTS']

    const result = withSetup(() => usePaymentsPage())
    await flushPromises()

    expect(result.hasProcessPermission.value).toBe(true)
  })

  describe('bank-file export (sdd/becario-payment-bank-file-export)', () => {
    const buildExportSummary = (overrides: Partial<ExportSummary> = {}): ExportSummary => ({
      count: 4,
      total_amount: '2600.02',
      filename: 'PAGO_1_MERIDA_202609_42.TXT',
      ...overrides,
    })

    // downloadExportFile is spied BEFORE the composable is created (same
    // convention as confirmProcess's processBatchSpy above) — usePaymentsPage
    // destructures the store's action reference once at setup time, so
    // spying after the composable already exists would silently target the
    // pre-spy reference and never be observed.
    const loadPaidBatch = async (
      downloadResult: DownloadExportResult = { status: 'success' },
    ) => {
      const paymentsStore = usePaymentsStore()
      vi.spyOn(paymentsStore, 'fetchBatch').mockImplementation(async () => {
        paymentsStore.rows = [buildRow()]
        paymentsStore.summary = buildSummary()
        paymentsStore.batchId = 42
        paymentsStore.isPaid = true
        return true
      })
      vi.spyOn(paymentsStore, 'fetchExportSummary').mockResolvedValue(buildExportSummary())
      const downloadSpy = vi.spyOn(paymentsStore, 'downloadExportFile').mockResolvedValue(downloadResult)
      const generationStore = useGenerationStore()
      vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

      const result = withSetup(() => usePaymentsPage())
      result.campus.value = 'MERIDA'
      result.generationId.value = 1
      result.periodYear.value = 2026
      result.periodMonth.value = 9
      await flushPromises()

      return { result, paymentsStore, downloadSpy }
    }

    it('exposes isPaid/batchId mirrored from the store, populated by the regular fetch (not just processBatch)', async () => {
      const { result } = await loadPaidBatch()

      expect(result.isPaid.value).toBe(true)
      expect(result.batchId.value).toBe(42)
    })

    it('loads the export summary automatically once the batch is paid', async () => {
      const { result, paymentsStore } = await loadPaidBatch()

      expect(paymentsStore.fetchExportSummary).toHaveBeenCalledWith(42)
      expect(result.exportSummary.value).toEqual(buildExportSummary())
    })

    it('does not load an export summary when the batch is not yet paid', async () => {
      const paymentsStore = usePaymentsStore()
      vi.spyOn(paymentsStore, 'fetchBatch').mockImplementation(async () => {
        paymentsStore.rows = [buildRow()]
        paymentsStore.summary = buildSummary()
        return true
      })
      const fetchExportSummarySpy = vi.spyOn(paymentsStore, 'fetchExportSummary')
      const generationStore = useGenerationStore()
      vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

      const result = withSetup(() => usePaymentsPage())
      result.campus.value = 'MERIDA'
      result.generationId.value = 1
      result.periodYear.value = 2026
      result.periodMonth.value = 9
      await flushPromises()

      expect(fetchExportSummarySpy).not.toHaveBeenCalled()
      expect(result.exportSummary.value).toBeNull()
    })

    it('confirmExport downloads the file for the current batchId and clears prior error state', async () => {
      const { result, downloadSpy } = await loadPaidBatch({ status: 'success' })

      await result.confirmExport()

      expect(downloadSpy).toHaveBeenCalledWith(42)
      expect(result.exportError.value).toBeNull()
      expect(result.invalidBankRows.value).toEqual([])
      expect(result.loadingExport.value).toBe(false)
    })

    it('confirmExport surfaces a "blocked" result distinctly, with the offending rows', async () => {
      const invalidRows: InvalidBankRow[] = [
        {
          refrend_id: 3,
          snapshot_name: 'Grace Hopper',
          account_number: 'ABC123',
          rfc: null,
          reasons: [{ code: 'INVALID_ACCOUNT_NUMBER', message: 'Número de cuenta inválido' }],
        },
      ]
      const { result } = await loadPaidBatch({ status: 'blocked', invalidRows })

      await result.confirmExport()

      expect(result.exportError.value).toBe('blocked')
      expect(result.invalidBankRows.value).toEqual(invalidRows)
    })

    it('confirmExport surfaces a generic "error" result distinctly from "blocked"', async () => {
      const { result } = await loadPaidBatch({ status: 'error' })

      await result.confirmExport()

      expect(result.exportError.value).toBe('error')
      expect(result.invalidBankRows.value).toEqual([])
    })

    it('exposes hasExportPermission mirrored from authStore.exportPayments', async () => {
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_READ_PAYMENTS', 'ADM_EXPORT_PAYMENTS']
      const { result } = await loadPaidBatch()

      expect(result.hasExportPermission.value).toBe(true)
    })
  })

  describe('showOnlyPending / visibleRows (sdd/becario-payment-review-filter)', () => {
    const loadRows = async (rows: PaymentBatchRow[]) => {
      const paymentsStore = usePaymentsStore()
      vi.spyOn(paymentsStore, 'fetchBatch').mockImplementation(async () => {
        paymentsStore.rows = rows
        paymentsStore.summary = buildSummary({ total: rows.length })
        return true
      })
      const generationStore = useGenerationStore()
      vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

      const result = withSetup(() => usePaymentsPage())
      result.campus.value = 'MERIDA'
      result.generationId.value = 1
      result.periodYear.value = 2026
      result.periodMonth.value = 9
      await flushPromises()

      return result
    }

    it('defaults showOnlyPending to false and visibleRows equals rows', async () => {
      const rows = [buildRow({ refrend_id: 1 }), buildRow({ refrend_id: 2, is_payable: false })]
      const result = await loadRows(rows)

      expect(result.showOnlyPending.value).toBe(false)
      expect(result.visibleRows.value).toEqual(rows)
    })

    it('excludes fully-ready rows (payable, no incident, no pending) when showOnlyPending is true', async () => {
      const readyRow = buildRow({ refrend_id: 1, is_payable: true, has_incident: false, has_pending_from_previous: false })
      const blockedRow = buildRow({ refrend_id: 2, is_payable: false })
      const incidentRow = buildRow({ refrend_id: 3, is_payable: true, has_incident: true })
      const pendingRow = buildRow({ refrend_id: 4, is_payable: true, has_pending_from_previous: true })
      const result = await loadRows([readyRow, blockedRow, incidentRow, pendingRow])

      result.showOnlyPending.value = true
      await flushPromises()

      expect(result.visibleRows.value).toEqual([blockedRow, incidentRow, pendingRow])
    })

    it('does not change summary when showOnlyPending toggles (all-or-nothing gate stays full-batch)', async () => {
      const readyRow = buildRow({ refrend_id: 1, is_payable: true })
      const blockedRow = buildRow({ refrend_id: 2, is_payable: false })
      const result = await loadRows([readyRow, blockedRow])
      const summaryBefore = result.summary.value

      result.showOnlyPending.value = true
      await flushPromises()

      expect(result.summary.value).toEqual(summaryBefore)
    })

    // sdd/resolution-status-visibility, task 6.1: a payable, incident-free
    // row with a non-null resolution_type IS grouped as pending review, AND
    // (in the same test) canProcess/summary stay derived exclusively from
    // the server aggregate — the client-side filter is structurally
    // incapable of reaching the payment gate. Mirrors the isolation-invariant
    // pattern already established above for has_incident/has_pending_from_previous.
    it('includes a payable row with a non-null resolution_type in visibleRows, without affecting canProcess/summary', async () => {
      const paymentsStore = usePaymentsStore()
      const resolvedRow = buildRow({
        refrend_id: 1,
        is_payable: true,
        has_incident: false,
        has_pending_from_previous: false,
        resolution_type: 'RETENIDA',
      })
      const plainReadyRow = buildRow({ refrend_id: 2, is_payable: true })
      vi.spyOn(paymentsStore, 'fetchBatch').mockImplementation(async () => {
        paymentsStore.rows = [resolvedRow, plainReadyRow]
        paymentsStore.summary = buildSummary({ total: 2, ready: 2, blocking: 0 })
        return true
      })
      const generationStore = useGenerationStore()
      vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

      const result = withSetup(() => usePaymentsPage())
      result.campus.value = 'MERIDA'
      result.generationId.value = 1
      result.periodYear.value = 2026
      result.periodMonth.value = 9
      await flushPromises()

      result.showOnlyPending.value = true
      await flushPromises()

      expect(result.visibleRows.value).toEqual([resolvedRow])
      expect(result.canProcess.value).toBe(true)
      expect(result.summary.value?.blocking).toBe(0)
    })
  })
})
