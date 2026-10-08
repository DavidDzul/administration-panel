// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VSelect } from 'vuetify/components'

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// usePaymentsByGenerationPage is deliberately NOT mocked — same rationale as
// PaymentsView.test.ts: only the network boundary (axiosConfig) is mocked,
// so the real reactive chain (store -> composable -> view) is exercised.
const { mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
}))
vi.mock('@/axiosConfig', () => ({
  default: { get: mockAxiosGet },
}))

import PaymentsByGenerationView from '@/views/pagos/PaymentsByGenerationView.vue'
import { useAuthStore } from '@/stores/api/authStore'

const vuetify = createVuetify()

const buildSummary = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  total: 1,
  paid: 1,
  pending: 0,
  blocked: 0,
  beca_amount: '1000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  paid_amount: '1000.00',
  pending_amount: '0.00',
  total_amount: '1000.00',
  difference_amount: '0.00',
  ...overrides,
})

const buildGeneration = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  generation_name: 'Generación B',
  campus: 'MERIDA',
  ...overrides,
})

const mountView = () =>
  mount(PaymentsByGenerationView, {
    global: { plugins: [vuetify] },
  })

const selectByLabel = (wrapper: ReturnType<typeof mountView>, label: string) =>
  wrapper.findAllComponents(VSelect).find((s) => s.props('label') === label)

const setAllFilters = async (wrapper: ReturnType<typeof mountView>): Promise<void> => {
  await selectByLabel(wrapper, 'Sede')?.vm.$emit('update:modelValue', 'MERIDA')
  await flushPromises()
  await selectByLabel(wrapper, 'Generación')?.vm.$emit('update:modelValue', 1)
  await selectByLabel(wrapper, 'Año')?.vm.$emit('update:modelValue', 2026)
  await selectByLabel(wrapper, 'Mes')?.vm.$emit('update:modelValue', 9)
  await flushPromises()
}

const mockGenerationsAndSummary = (
  summary: Record<string, unknown> | null,
  generation: Record<string, unknown> | null = buildGeneration(),
): void => {
  mockAxiosGet.mockImplementation((url: string) => {
    if (url === 'api/admin/generations') {
      return Promise.resolve({ data: { res: true, generations: [buildGeneration()] } })
    }
    if (url === 'api/admin/scholarship-payments/by-generation') {
      return Promise.resolve({ data: { res: true, data: { summary, generation } } })
    }
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

describe('PaymentsByGenerationView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    useAuthStore().permissions = ['ADM_READ_PAYMENTS']
    useAuthStore().userProfile = {
      id: 1,
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@iu.org.mx',
      campus: 'MERIDA',
      roles: [{ id: 1, name: 'ROOT_ADMINISTRATION' }],
    }
    mockGenerationsAndSummary(buildSummary())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a neutral prompt, not the empty state, before all 3 filters are set', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Selecciona')
    expect(wrapper.text()).not.toContain('Sin refrendos para esta generación')
    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(false)
  })

  it('fetches the summary with the exact key once all 3 filters are chosen, and renders GenerationPaymentSummary (not PaymentBatchSummary)', async () => {
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    expect(mockAxiosGet).toHaveBeenCalledWith(
      'api/admin/scholarship-payments/by-generation',
      expect.objectContaining({
        params: { generation_id: 1, period_year: 2026, period_month: 9 },
      }),
    )
    expect(wrapper.text()).toContain('Total becarios')
    expect(wrapper.findComponent({ name: 'GenerationPaymentSummary' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'PaymentBatchSummary' }).exists()).toBe(false)
  })

  // User decision 2026-10-08 (follow-up): the standalone generación/sede
  // label row above the cards is removed — the filters already show the
  // chosen sede and generación, so it was redundant. The store/composable
  // `generation` ref and the API contract are unchanged; this view just
  // stops rendering it.
  it('does not render a standalone generación/sede label above the cards', async () => {
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    expect(wrapper.text()).toContain('Total becarios')
    expect(wrapper.text()).not.toContain('Generación B — MERIDA')
  })

  it('shows the empty-state message alongside the zeroed cards when the summary is all zeros', async () => {
    mockGenerationsAndSummary(buildSummary({ total: 0, paid: 0, pending: 0, blocked: 0 }))
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    expect(wrapper.text()).toContain('Sin refrendos para esta generación en el periodo seleccionado.')
    expect(wrapper.text()).toContain('Total becarios')
  })

  it('shows an error alert and hides the cards when the fetch fails, even if a stale summary exists', async () => {
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)
    expect(wrapper.text()).toContain('Total becarios')

    mockAxiosGet.mockImplementation((url: string) => {
      if (url === 'api/admin/generations') {
        return Promise.resolve({ data: { res: true, generations: [buildGeneration()] } })
      }
      return Promise.reject(new Error('network error'))
    })

    await selectByLabel(wrapper, 'Mes')?.vm.$emit('update:modelValue', 10)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Total becarios')
    expect(wrapper.text()).toContain('Error al cargar')
  })

  it('hides the previous cards and shows the neutral prompt again when a filter is cleared', async () => {
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)
    expect(wrapper.text()).toContain('Total becarios')

    await selectByLabel(wrapper, 'Generación')?.vm.$emit('update:modelValue', null)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Total becarios')
    expect(wrapper.text()).not.toContain('Generación B — MERIDA')
    expect(wrapper.text()).toContain('Selecciona')
  })

  // Sede → Generación cascade (user decision 2026-10-08): clearing the sede
  // clears the selected generación too, which hides the cards via the
  // existing filtersComplete guard (no separate sede check needed).
  it('hides the previous cards and shows the neutral prompt again when the sede is cleared', async () => {
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)
    expect(wrapper.text()).toContain('Total becarios')

    await selectByLabel(wrapper, 'Sede')?.vm.$emit('update:modelValue', null)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Total becarios')
    expect(wrapper.text()).not.toContain('Generación B — MERIDA')
    expect(wrapper.text()).toContain('Selecciona')
  })

  it('narrows the generación options to the selected sede, dropping the "— sede" suffix', async () => {
    mockAxiosGet.mockImplementation((url: string) => {
      if (url === 'api/admin/generations') {
        return Promise.resolve({
          data: {
            res: true,
            generations: [
              buildGeneration({ id: 1, generation_name: 'Generación B', campus: 'MERIDA' }),
              buildGeneration({ id: 2, generation_name: 'Generación C', campus: 'VALLADOLID' }),
            ],
          },
        })
      }
      if (url === 'api/admin/scholarship-payments/by-generation') {
        return Promise.resolve({ data: { res: true, data: { summary: buildSummary(), generation: buildGeneration() } } })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    const wrapper = mountView()
    await flushPromises()

    expect(selectByLabel(wrapper, 'Generación')?.props('disabled')).toBe(true)

    await selectByLabel(wrapper, 'Sede')?.vm.$emit('update:modelValue', 'MERIDA')
    await flushPromises()

    expect(selectByLabel(wrapper, 'Generación')?.props('items')).toEqual([{ title: 'Generación B', value: 1 }])
  })
})
