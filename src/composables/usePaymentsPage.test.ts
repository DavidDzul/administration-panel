// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { usePaymentsPage } from '@/composables/usePaymentsPage'
import { usePaymentsStore } from '@/stores/api/paymentsStore'
import { useGenerationStore } from '@/stores/api/generationStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { PaymentBatchRow, PaymentBatchSummary } from '@/interfaces/payment'
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
})
