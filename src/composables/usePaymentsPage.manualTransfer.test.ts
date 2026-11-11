// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { usePaymentsPage } from '@/composables/usePaymentsPage'
import { usePaymentsStore } from '@/stores/api/paymentsStore'
import { useAlertStore } from '@/stores/alert'
import type {
  ManualTransferPaymentData,
  ManualTransferRow,
  MarkManualTransferPayload,
  PaymentBatchRow,
  PaymentBatchSummary,
} from '@/interfaces/payment'

// sdd/catalogo-bancos R7: manual transfer actions of the payments page.
// Same harness as usePaymentsPage.test.ts.
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

const buildRow = (overrides: Partial<PaymentBatchRow> = {}): PaymentBatchRow =>
  ({
    refrend_id: 1,
    user_id: 1,
    snapshot_name: 'Ada Lovelace',
    total_to_pay: '1000.00',
    is_payable: true,
    blocking_reasons: [],
    status: 'DRAFT',
    ...overrides,
  }) as PaymentBatchRow

const buildSummary = (): PaymentBatchSummary =>
  ({ total: 1, ready: 1, blocking: 0, total_amount: '1000.00' }) as PaymentBatchSummary

const paymentData: ManualTransferPaymentData = {
  refrend_id: 7,
  status: 'PAID',
  workflow_status: 'CLOSED',
  paid_payment_method: 'MANUAL_TRANSFER',
  manual_payments: [
    { concept: 'beca', method: 'MANUAL_TRANSFER', reference: 'SPEI-1', amount: '500.00', paid_at: '2026-10-20', notes: null },
  ],
  locked_at: '2026-10-20T10:00:00Z',
}

const markPayload: MarkManualTransferPayload = {
  references: { beca: 'SPEI-1' },
  expected_amounts: { beca: '500.00', apoyo: '0.00' },
}

const manualSummary = { total: 1, ready: 1, paid: 0, blocking: 0, ready_amount: '500.00', paid_amount: '0.00', ready_beca_amount: '500.00', ready_apoyo_amount: '0.00', paid_beca_amount: '0.00', paid_apoyo_amount: '0.00' }

describe('usePaymentsPage manual transfers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Store actions are destructured at composable setup, so spies must be
  // installed BEFORE the composable mounts (via `arrange`).
  const setupLoaded = async (arrange: (store: ReturnType<typeof usePaymentsStore>) => void = () => {}) => {
    const paymentsStore = usePaymentsStore()
    arrange(paymentsStore)
    const fetchBatchSpy = vi.spyOn(paymentsStore, 'fetchBatch').mockImplementation(async () => {
      paymentsStore.rows = [buildRow()]
      paymentsStore.summary = buildSummary()
      paymentsStore.manualTransferRows = [
        { ...buildRow({ refrend_id: 7 }), payment_method: 'MANUAL_TRANSFER' } as ManualTransferRow,
      ]
      paymentsStore.manualTransferSummary = manualSummary
      return true
    })
    const result = withSetup(() => usePaymentsPage())
    result.campus.value = 'MERIDA'
    result.periodYear.value = 2026
    result.periodMonth.value = 9
    result.batchType.value = 'NORMAL'
    await flushPromises()
    return { fetchBatchSpy, result }
  }

  it('exposes manualTransferRows/manualTransferSummary', async () => {
    const { result } = await setupLoaded()

    expect(result.manualTransferRows.value).toHaveLength(1)
    expect(result.manualTransferSummary.value).toEqual(manualSummary)
    expect(result.canProcess.value).toBe(true)
  })

  it('markManualTransfer reloads the batch and shows a success alert on success', async () => {
    let markSpy!: MockInstance
    const { fetchBatchSpy, result } = await setupLoaded((store) => {
      markSpy = vi.spyOn(store, 'markManualTransferPaid').mockResolvedValue({ status: 'success', data: paymentData })
    })
    const calls = fetchBatchSpy.mock.calls.length

    const outcome = await result.markManualTransfer(7, markPayload)
    await flushPromises()

    expect(markSpy).toHaveBeenCalledWith(7, markPayload)
    expect(outcome.status).toBe('success')
    expect(fetchBatchSpy.mock.calls.length).toBe(calls + 1)
    expect(useAlertStore().config.status).toBe('success')
    expect(useAlertStore().config.title).toBe('Transferencia registrada.')
    expect(result.savingManualTransfer.value).toBe(false)
  })

  it.each([['already_paid'], ['not_manual_transfer'], ['cycle_closed'], ['telmex_repayment_exists']] as const)(
    'markManualTransfer reloads and alerts the server msg on %s',
    async (status) => {
      const { fetchBatchSpy, result } = await setupLoaded((store) => {
        vi.spyOn(store, 'markManualTransferPaid').mockResolvedValue({ status, msg: 'Server says no' })
      })
      const calls = fetchBatchSpy.mock.calls.length

      await result.markManualTransfer(7, markPayload)
      await flushPromises()

      expect(fetchBatchSpy.mock.calls.length).toBe(calls + 1)
      expect(useAlertStore().config).toEqual({ title: 'Server says no', status: 'error' })
    },
  )

  it('markManualTransfer alerts but does not reload on transfer_reference_taken', async () => {
    const { fetchBatchSpy, result } = await setupLoaded((store) => {
      vi.spyOn(store, 'markManualTransferPaid').mockResolvedValue({
        status: 'transfer_reference_taken',
        msg: 'Esa referencia de transferencia ya fue registrada.',
        concept: 'apoyo',
      })
    })
    const calls = fetchBatchSpy.mock.calls.length

    const outcome = await result.markManualTransfer(7, markPayload)
    await flushPromises()

    expect(outcome.status).toBe('transfer_reference_taken')
    expect(fetchBatchSpy.mock.calls.length).toBe(calls)
    expect(useAlertStore().config.title).toBe('Esa referencia de transferencia ya fue registrada.')
  })

  it('markManualTransfer falls back to a generic alert when the server sent no msg', async () => {
    const { result } = await setupLoaded((store) => {
      vi.spyOn(store, 'markManualTransferPaid').mockResolvedValue({ status: 'error', msg: null })
    })

    await result.markManualTransfer(7, markPayload)
    await flushPromises()

    expect(useAlertStore().config.status).toBe('error')
    expect(useAlertStore().config.title).toBe(
      'No se pudo completar la operación con la transferencia, intenta nuevamente.',
    )
  })

  it('revertManualTransfer reloads and shows a success alert on success', async () => {
    let revertSpy!: MockInstance
    const { fetchBatchSpy, result } = await setupLoaded((store) => {
      revertSpy = vi
        .spyOn(store, 'revertManualTransferPayment')
        .mockResolvedValue({ status: 'success', data: { ...paymentData, status: 'DRAFT' } })
    })
    const calls = fetchBatchSpy.mock.calls.length

    await result.revertManualTransfer(7, 'Transferencia rechazada')
    await flushPromises()

    expect(revertSpy).toHaveBeenCalledWith(7, 'Transferencia rechazada')
    expect(fetchBatchSpy.mock.calls.length).toBe(calls + 1)
    expect(useAlertStore().config.title).toBe('Pago por transferencia revertido.')
  })

  it('revertManualTransfer alerts the server msg without reloading on a generic error', async () => {
    const { fetchBatchSpy, result } = await setupLoaded((store) => {
      vi.spyOn(store, 'revertManualTransferPayment').mockResolvedValue({
        status: 'error',
        msg: 'No se encontró un registro válido del estado previo al pago por transferencia.',
      })
    })
    const calls = fetchBatchSpy.mock.calls.length

    await result.revertManualTransfer(7, 'Motivo suficientemente largo')
    await flushPromises()

    expect(fetchBatchSpy.mock.calls.length).toBe(calls)
    expect(useAlertStore().config.title).toBe(
      'No se encontró un registro válido del estado previo al pago por transferencia.',
    )
  })
})
