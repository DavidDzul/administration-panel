// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTab } from 'vuetify/components'
import type { PaymentDocument } from '@/interfaces/payment'

// Same jsdom shim as PaymentsView.test.ts / AccesoDetailView.test.ts.
if (!('visualViewport' in window)) {
  Object.defineProperty(window, 'visualViewport', { value: null, writable: true })
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// usePaymentDocumentPage is deliberately NOT mocked — same convention as
// PaymentsView.test.ts / AccesosView.test.ts: mocking it would only assert
// the store's internal state changed, never that the real reactive chain
// (store -> composable -> component) actually re-renders. Only the network
// boundary (axiosConfig) is mocked. No router is involved anymore — the
// dialog receives `refrendId` as a prop, not a route param.
const { mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
}))
vi.mock('@/axiosConfig', () => ({
  default: { get: mockAxiosGet },
}))

import PaymentDocumentDialog from '@/components/pagos/PaymentDocumentDialog.vue'

const vuetify = createVuetify()

const buildDocument = (overrides: Partial<PaymentDocument> = {}): PaymentDocument => ({
  refrend_id: 5,
  user_id: 1,
  enrollment: 'MAT-123456',
  snapshot_name: 'Ada Lovelace',
  incidents: [
    {
      id: 1,
      incident_category: 'ACADEMICO',
      incident_type: 'INASISTENCIA',
      description: 'Faltó a clase sin justificación.',
      is_resolved: false,
    },
  ],
  carryover_months_count: 2,
  carryover_months_detail: '04/2026: 300.00; 03/2026: 150.00',
  carryover_percentage: '50.00',
  atencion_observations: 'Llegó tarde dos veces.',
  pedagogia_observations: 'Bajo rendimiento en cálculo.',
  resolution_notes: 'Aprobado tras revisión.',
  amount_breakdown: {
    base_amount: '1000.00',
    discount_percentage: '0.00',
    discount_amount: '0.00',
    amount_pending_from_previous: '450.00',
    refund_amount_from_previous: '0.00',
    final_amount: '1000.00',
    total_to_pay: '1450.00',
  },
  ...overrides,
})

const mountDialog = (refrendId: number | null = 5, modelValue = true) =>
  mount(PaymentDocumentDialog, {
    props: { modelValue, refrendId },
    global: { plugins: [vuetify] },
    attachTo: document.body,
  })

const clickTab = async (wrapper: ReturnType<typeof mountDialog>, label: string): Promise<void> => {
  const tab = wrapper.findAllComponents(VTab).find((t) => t.text() === label)
  await tab?.trigger('click')
  await flushPromises()
}

// v-dialog teleports its content to document.body, so `wrapper.text()`/
// `wrapper.find()` (DOM-scoped to the mount root) never see it — same
// convention as PaymentsView.test.ts's `body()` helper for
// ProcessPaymentDialog's teleported content.
const body = () => new DOMWrapper(document.body)

describe('PaymentDocumentDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not fetch anything while closed with no refrendId selected', async () => {
    mountDialog(null, false)
    await flushPromises()

    expect(mockAxiosGet).not.toHaveBeenCalled()
  })

  it('shows a progress indicator while loading, and no document content', async () => {
    mockAxiosGet.mockImplementation(() => new Promise(() => {}))
    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    expect(body().text()).not.toContain('Ada Lovelace')
  })

  it('shows an error alert instead of a broken dialog when the document fails to load', async () => {
    mockAxiosGet.mockRejectedValue(new Error('network error'))
    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
  })

  it('fetches the document for the given refrendId and renders nombre + matrícula in the Resumen tab', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()

    expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/scholarship-payments/5/document')
    expect(body().text()).toContain('Ada Lovelace')
    expect(body().text()).toContain('MAT-123456')
  })

  it('renders incidencias with category, type and description under the Incidencias tab', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()
    await clickTab(wrapper, 'Incidencias')

    expect(body().text()).toContain('Faltó a clase sin justificación.')
    expect(body().text()).toContain('ACADEMICO')
    expect(body().text()).toContain('INASISTENCIA')
  })

  it('renders the 3 comentario fields separately, clearly labeled, never merged into one block', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()
    await clickTab(wrapper, 'Comentarios')

    expect(body().text()).toContain('Atención')
    expect(body().text()).toContain('Llegó tarde dos veces.')
    expect(body().text()).toContain('Pedagogía')
    expect(body().text()).toContain('Bajo rendimiento en cálculo.')
    expect(body().text()).toContain('Resolución')
    expect(body().text()).toContain('Aprobado tras revisión.')
  })

  it('renders the monto breakdown down to the final total under the Desglose tab', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()
    await clickTab(wrapper, 'Desglose de monto')

    expect(body().text()).toContain('1000.00')
    expect(body().text()).toContain('450.00')
    expect(body().text()).toContain('1450.00')
  })

  it('does not render any edit control (read-only dialog)', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()

    expect(body().findAll('input').length).toBe(0)
    expect(body().findAll('textarea').length).toBe(0)
  })

  it('emits update:modelValue false when the close button is clicked', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()

    await body().find('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })
})
