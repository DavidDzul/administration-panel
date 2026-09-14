// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { usePaymentDocumentPage } from '@/composables/usePaymentDocumentPage'
import { usePaymentsStore } from '@/stores/api/paymentsStore'
import type { PaymentDocument } from '@/interfaces/payment'

// Mirrors useAccesoDetailPage.test.ts's withSetup helper (D4: lifecycle
// lives in the composable, only fires against a real mounted component
// instance) — extended with a router plugin since this composable reads the
// `:refrendId` route param, simpler than useAccesoDetailPage (one fetch, no
// secondary catalog fetch).
function withSetup<T>(composable: () => T, router: Router): T {
  let result!: T
  mount(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
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

const buildRouter = async (refrendId: string): Promise<Router> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/pagos/:refrendId', component: { template: '<div />' } }],
  })
  await router.push(`/pagos/${refrendId}`)
  return router
}

describe('usePaymentDocumentPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads the document for the route refrendId on mount', async () => {
    const document = buildDocument()
    const paymentsStore = usePaymentsStore()
    const fetchDocumentSpy = vi.spyOn(paymentsStore, 'fetchDocument').mockImplementation(async () => {
      paymentsStore.document = document
      return true
    })

    const router = await buildRouter('5')
    const result = withSetup(() => usePaymentDocumentPage(), router)

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

    const router = await buildRouter('5')
    const result = withSetup(() => usePaymentDocumentPage(), router)
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.loading.value).toBe(false)
  })

  it('sets loadError=true for an invalid route refrendId without calling the store', async () => {
    const paymentsStore = usePaymentsStore()
    const fetchDocumentSpy = vi.spyOn(paymentsStore, 'fetchDocument').mockResolvedValue(true)

    const router = await buildRouter('not-a-number')
    const result = withSetup(() => usePaymentDocumentPage(), router)
    await flushPromises()

    expect(fetchDocumentSpy).not.toHaveBeenCalled()
    expect(result.loadError.value).toBe(true)
  })

  it('reloads the document when the route refrendId changes', async () => {
    const paymentsStore = usePaymentsStore()
    const fetchDocumentSpy = vi.spyOn(paymentsStore, 'fetchDocument').mockResolvedValue(true)

    const router = await buildRouter('5')
    withSetup(() => usePaymentDocumentPage(), router)
    await flushPromises()

    await router.push('/pagos/9')
    await flushPromises()

    expect(fetchDocumentSpy).toHaveBeenNthCalledWith(2, 9)
  })
})
