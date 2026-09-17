// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { usePaymentDocumentPage } from '@/composables/usePaymentDocumentPage'
import { usePaymentsStore } from '@/stores/api/paymentsStore'
import type { PaymentDocument } from '@/interfaces/payment'

// sdd/becario-payment-batch-indicators: the document view moved from a
// routed page to a dialog (PaymentDocumentDialog.vue), so this composable no
// longer reads `:refrendId` from `useRoute()` — it now takes a reactive
// `refrendId` source directly from its caller (the dialog's `refrendId`
// prop), watched the same way the old route param was. Mirrors
// useAccesoDetailPage.test.ts's withSetup helper (D4: lifecycle lives in the
// composable, only fires against a real mounted component instance).
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

const buildDocument = (overrides: Partial<PaymentDocument> = {}): PaymentDocument => ({
  refrend_id: 5,
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

describe('usePaymentDocumentPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not call fetchDocument and stays idle when refrendId starts as null (dialog closed)', () => {
    const paymentsStore = usePaymentsStore()
    const fetchDocumentSpy = vi.spyOn(paymentsStore, 'fetchDocument')

    const refrendId: Ref<number | null> = ref(null)
    const result = withSetup(() => usePaymentDocumentPage(refrendId))

    expect(fetchDocumentSpy).not.toHaveBeenCalled()
    expect(result.loading.value).toBe(false)
    expect(result.loadError.value).toBe(false)
    expect(result.document.value).toBe(null)
  })

  it('loads the document for the initial refrendId on mount', async () => {
    const document = buildDocument()
    const paymentsStore = usePaymentsStore()
    const fetchDocumentSpy = vi.spyOn(paymentsStore, 'fetchDocument').mockImplementation(async () => {
      paymentsStore.document = document
      return true
    })

    const refrendId: Ref<number | null> = ref(5)
    const result = withSetup(() => usePaymentDocumentPage(refrendId))

    expect(result.loading.value).toBe(true)
    await flushPromises()

    expect(fetchDocumentSpy).toHaveBeenCalledWith(5)
    expect(result.document.value).toEqual(document)
    expect(result.loadError.value).toBe(false)
    expect(result.loading.value).toBe(false)
  })

  it('sets loadError=true when fetchDocument resolves false (e.g. a 404)', async () => {
    const paymentsStore = usePaymentsStore()
    vi.spyOn(paymentsStore, 'fetchDocument').mockResolvedValue(false)

    const refrendId: Ref<number | null> = ref(5)
    const result = withSetup(() => usePaymentDocumentPage(refrendId))
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.loading.value).toBe(false)
  })

  it('reloads the document when refrendId changes to a different becario', async () => {
    const paymentsStore = usePaymentsStore()
    const fetchDocumentSpy = vi.spyOn(paymentsStore, 'fetchDocument').mockResolvedValue(true)

    const refrendId: Ref<number | null> = ref(5)
    withSetup(() => usePaymentDocumentPage(refrendId))
    await flushPromises()

    refrendId.value = 9
    await flushPromises()

    expect(fetchDocumentSpy).toHaveBeenNthCalledWith(1, 5)
    expect(fetchDocumentSpy).toHaveBeenNthCalledWith(2, 9)
  })

  it('resets the document and clears error state when refrendId goes back to null (dialog closed)', async () => {
    const document = buildDocument()
    const paymentsStore = usePaymentsStore()
    vi.spyOn(paymentsStore, 'fetchDocument').mockImplementation(async () => {
      paymentsStore.document = document
      return true
    })

    const refrendId: Ref<number | null> = ref(5)
    const result = withSetup(() => usePaymentDocumentPage(refrendId))
    await flushPromises()
    expect(result.document.value).toEqual(document)

    refrendId.value = null
    await flushPromises()

    expect(result.document.value).toBe(null)
    expect(result.loading.value).toBe(false)
    expect(result.loadError.value).toBe(false)
  })
})
