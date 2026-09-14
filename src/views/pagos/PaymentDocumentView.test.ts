// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import type { PaymentDocument } from '@/interfaces/payment'

// Same jsdom shim as AccesoDetailView.test.ts / PaymentsView.test.ts.
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

// usePaymentDocumentPage is deliberately NOT mocked in this file — same
// convention as PaymentsView.test.ts/AccesosView.test.ts: mocking it would
// only assert the store's internal state changed, never that the real
// reactive chain (store -> composable -> component) actually re-renders.
// Only the network boundary (axiosConfig) is mocked. A REAL router (not a
// mocked vue-router module) provides the `:refrendId` route param, since
// this view's composable calls the real `useRoute()`.
const { mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
}))
vi.mock('@/axiosConfig', () => ({
  default: { get: mockAxiosGet },
}))

import PaymentDocumentView from '@/views/pagos/PaymentDocumentView.vue'

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

const buildRouter = async (refrendId: string): Promise<Router> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/pagos/:refrendId', component: PaymentDocumentView }],
  })
  await router.push(`/pagos/${refrendId}`)
  await router.isReady()
  return router
}

const mountView = async (refrendId = '5') => {
  const router = await buildRouter(refrendId)
  return mount(PaymentDocumentView, {
    global: { plugins: [vuetify, router] },
  })
}

describe('PaymentDocumentView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('shows a progress indicator while loading, and no document content', async () => {
    mockAxiosGet.mockImplementation(() => new Promise(() => {}))
    const wrapper = await mountView()

    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Ada Lovelace')
  })

  it('shows an error alert instead of a broken view when the document fails to load', async () => {
    mockAxiosGet.mockRejectedValue(new Error('network error'))
    const wrapper = await mountView()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
  })

  it('renders matrícula and nombre once loaded', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = await mountView()
    await flushPromises()

    expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/scholarship-payments/5/document')
    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('MAT-123456')
  })

  it('renders incidencias with category, type and description', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = await mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Faltó a clase sin justificación.')
    expect(wrapper.text()).toContain('ACADEMICO')
    expect(wrapper.text()).toContain('INASISTENCIA')
  })

  it('renders meses retenidos (count + detail) and % retenido', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = await mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('04/2026: 300.00; 03/2026: 150.00')
    expect(wrapper.text()).toContain('50.00')
  })

  it('renders the 3 comentario fields separately, clearly labeled, never merged into one block', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = await mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Atención')
    expect(wrapper.text()).toContain('Llegó tarde dos veces.')
    expect(wrapper.text()).toContain('Pedagogía')
    expect(wrapper.text()).toContain('Bajo rendimiento en cálculo.')
    expect(wrapper.text()).toContain('Resolución')
    expect(wrapper.text()).toContain('Aprobado tras revisión.')
  })

  it('renders the monto breakdown down to the final total', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = await mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('1000.00')
    expect(wrapper.text()).toContain('450.00')
    expect(wrapper.text()).toContain('1450.00')
  })

  it('does not render any edit control (read-only view)', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = await mountView()
    await flushPromises()

    expect(wrapper.findAll('input').length).toBe(0)
    expect(wrapper.findAll('textarea').length).toBe(0)
    expect(wrapper.findAll('button').filter((b) => /guardar/i.test(b.text())).length).toBe(0)
  })
})
