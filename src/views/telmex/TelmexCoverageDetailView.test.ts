// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { VBtn, VTextField, VTextarea } from 'vuetify/components'
import TelmexCoverageDetailView from '@/views/telmex/TelmexCoverageDetailView.vue'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { TelmexCoverageStatement } from '@/interfaces/telmexCoverage'

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

const vuetify = createVuetify()
const body = () => new DOMWrapper(document.body)

const buildStatement = (overrides: Partial<TelmexCoverageStatement> = {}): TelmexCoverageStatement => ({
  coverage: {
    id: 5,
    user_id: 10,
    becario_name: 'Juan Pérez',
    campus: 'MERIDA',
    generation: 'Gen 2024',
    scholarship_type_at_activation: 'TELMEX',
    status: 'EN_COBRO',
    start_period: '2026-01-01',
    end_period: null,
    notes: null,
    cancel_reason: null,
    advanced: 1000,
    repaid: 400,
    balance: 600,
    has_paid_covered_month: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  months: [{ period: '2026-01-01', covered_amount: 500, is_paid: true, payment_batch_id: 3 }],
  payments: [
    {
      id: 1,
      coverage_id: 5,
      amount: 400,
      paid_at: '2026-02-01',
      reference: 'DEP-001',
      notes: null,
      is_voided: false,
      voided_at: null,
      void_reason: null,
      created_at: '2026-02-01T00:00:00Z',
    },
  ],
  ...overrides,
})

const buildRouter = async (id: string): Promise<Router> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/becas-telmex/:id', component: TelmexCoverageDetailView }],
  })
  await router.push(`/becas-telmex/${id}`)
  return router
}

const mountView = async (id = '5') => {
  const router = await buildRouter(id)
  const wrapper = mount(TelmexCoverageDetailView, {
    global: { plugins: [vuetify, router] },
  })
  await flushPromises()
  return wrapper
}

describe('TelmexCoverageDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('shows a loading spinner while the statement loads', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverageStatement').mockImplementation(() => new Promise(() => {}))

    const router = await buildRouter('5')
    const wrapper = mount(TelmexCoverageDetailView, { global: { plugins: [vuetify, router] } })

    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
  })

  it('shows an error alert when the statement fails to load', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValue(null)

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('No se pudo cargar')
  })

  it('renders the header (becario, tipo, estado, periodo) and the 3 summary cards', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValue(buildStatement())

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Juan Pérez')
    expect(wrapper.text()).toContain('Telmex')
    expect(wrapper.text()).toContain('En cobro')
    expect(wrapper.text()).toContain('01/2026')
    expect(wrapper.text()).toContain('Adelantado')
    expect(wrapper.text()).toContain('Devuelto')
    expect(wrapper.text()).toContain('Saldo')
    expect(wrapper.text()).toContain('$1,000.00')
    expect(wrapper.text()).toContain('$400.00')
    expect(wrapper.text()).toContain('$600.00')
  })

  it('shows the balance as "cancelado" when the coverage is CANCELADA', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValue(
      buildStatement({
        coverage: {
          ...buildStatement().coverage,
          status: 'CANCELADA',
          cancel_reason: 'Becario egresó de IU.',
        },
      }),
    )

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('cancelado')
  })

  it('renders CoverageStatement with the loaded months and payments', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValue(buildStatement())

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Pagado')
    expect(wrapper.text()).toContain('DEP-001')
  })

  it('opens RegisterRepaymentDialog and registers a payment, then refreshes the statement', async () => {
    const store = useTelmexCoverageStore()
    const authStore = useAuthStore()
    authStore.permissions = ['ADM_MANAGE_TELMEX_REPAYMENTS']

    const first = buildStatement()
    const refreshed = buildStatement({
      coverage: { ...first.coverage, repaid: 600, balance: 400 },
    })
    vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValueOnce(first).mockResolvedValueOnce(refreshed)
    vi.spyOn(store, 'registerPayment').mockResolvedValue({
      id: 2,
      coverage_id: 5,
      amount: 200,
      paid_at: '2026-03-01',
      reference: null,
      notes: null,
      is_voided: false,
      voided_at: null,
      void_reason: null,
      created_at: '2026-03-01T00:00:00Z',
    })

    const wrapper = await mountView()

    const registerButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Registrar abono'))
    await registerButtons[0].trigger('click')
    await flushPromises()

    const amountField = wrapper
      .findAllComponents(VTextField)
      .filter((f) => f.props('label') === 'Monto *')[0]
    const paidAtField = wrapper
      .findAllComponents(VTextField)
      .filter((f) => f.props('label') === 'Fecha')[0]
    await amountField.setValue(200)
    await paidAtField.setValue('2026-03-01')

    await body().find('form').trigger('submit')
    await flushPromises()

    expect(store.registerPayment).toHaveBeenCalledWith(5, expect.objectContaining({ amount: 200 }))
    expect(store.fetchCoverageStatement).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('$400.00')
  })

  it('opens VoidRepaymentDialog and voids a payment, then refreshes the statement', async () => {
    const store = useTelmexCoverageStore()
    const authStore = useAuthStore()
    authStore.permissions = ['ADM_MANAGE_TELMEX_REPAYMENTS']

    const first = buildStatement()
    const refreshed = buildStatement({
      coverage: { ...first.coverage, repaid: 0, balance: 1000 },
    })
    vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValueOnce(first).mockResolvedValueOnce(refreshed)
    vi.spyOn(store, 'voidPayment').mockResolvedValue({
      ...first.payments[0],
      is_voided: true,
      void_reason: 'Depósito duplicado por error',
    })

    const wrapper = await mountView()

    const voidButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Anular'))
    await voidButtons[0].trigger('click')
    await flushPromises()

    await wrapper.findComponent(VTextarea).setValue('Depósito duplicado por error')
    await body().find('form').trigger('submit')
    await flushPromises()

    expect(store.voidPayment).toHaveBeenCalledWith(5, 1, { void_reason: 'Depósito duplicado por error' })
    expect(store.fetchCoverageStatement).toHaveBeenCalledTimes(2)
  })
})
