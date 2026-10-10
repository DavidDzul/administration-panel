// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VSelect, VTextField, VTextarea } from 'vuetify/components'

// v-data-table's pagination footer relies on ResizeObserver — same jsdom
// shim as AccesosView.test.ts.
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

// useTelmexCoveragesPage is deliberately NOT mocked — mirrors AccesosView's
// real-reactive-chain convention: mocking the composable only proves the
// store's Map changed, never that the table actually re-renders from it.
const { mockAxiosGet, mockAxiosPost } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
}))
vi.mock('@/axiosConfig', () => ({
  default: { get: mockAxiosGet, post: mockAxiosPost },
}))

import TelmexCoveragesView from '@/views/telmex/TelmexCoveragesView.vue'
import { useAuthStore } from '@/stores/api/authStore'
import type { TelmexCoverage, EligibleTelmexBecario } from '@/interfaces/telmexCoverage'

const vuetify = createVuetify()

const buildCoverage = (overrides: Partial<TelmexCoverage> = {}): TelmexCoverage => ({
  id: 1,
  user_id: 10,
  becario_name: 'Juan Pérez',
  campus: 'MERIDA',
  generation: 'Gen 2024',
  scholarship_type_at_activation: 'TELMEX',
  status: 'ACTIVA',
  start_period: '2026-01-01',
  end_period: null,
  notes: null,
  cancel_reason: null,
  advanced: 0,
  repaid: 0,
  balance: 0,
  has_paid_covered_month: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const buildEligible = (overrides: Partial<EligibleTelmexBecario> = {}): EligibleTelmexBecario => ({
  id: 20,
  name: 'Ada Lovelace',
  campus: 'MERIDA',
  generation: 'Gen 2024',
  scholarship_type: 'TELMEX',
  ...overrides,
})

const mountView = () => mount(TelmexCoveragesView, { global: { plugins: [vuetify] } })

// Dialog content teleports to `document.body`, same gotcha as
// AccesosView.test.ts.
const body = () => new DOMWrapper(document.body)

const fieldByLabelPrefix = (wrapper: ReturnType<typeof mountView>, label: string) =>
  wrapper.findAllComponents(VTextField).find((f) => (f.props('label') as string | undefined)?.startsWith(label))

const submitOpenForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

const setManageTelmexCoverage = (canManage: boolean): void => {
  useAuthStore().permissions = canManage
    ? ['ADM_READ_TELMEX_COVERAGE', 'ADM_MANAGE_TELMEX_COVERAGE']
    : ['ADM_READ_TELMEX_COVERAGE']
}

const mockGetByUrl = (coverages: TelmexCoverage[], eligible: EligibleTelmexBecario[]): void => {
  mockAxiosGet.mockImplementation((url: string) => {
    if (url === 'api/admin/telmex-coverages') return Promise.resolve({ data: { res: true, data: coverages } })
    if (url === 'api/admin/telmex-coverages/eligible')
      return Promise.resolve({ data: { res: true, data: eligible } })
    return Promise.reject(new Error(`unexpected url ${url}`))
  })
}

describe('TelmexCoveragesView — loading / error / populated states', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    mockGetByUrl([], [])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('shows a progress indicator while the initial fetch is pending', async () => {
    let resolveGet!: (value: unknown) => void
    mockAxiosGet.mockReturnValueOnce(new Promise((resolve) => (resolveGet = resolve)))
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VDataTable' }).exists()).toBe(false)

    resolveGet({ data: { res: true, data: [] } })
    await flushPromises()
  })

  it('shows an error alert instead of a silent blank table when the coverages fetch fails', async () => {
    mockAxiosGet.mockImplementation((url: string) => {
      if (url === 'api/admin/telmex-coverages') return Promise.reject(new Error('network error'))
      return Promise.resolve({ data: { res: true, data: [] } })
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VDataTable' }).exists()).toBe(false)
  })

  it('renders the populated table once loaded', async () => {
    mockGetByUrl([buildCoverage({ becario_name: 'Grace Hopper' })], [])
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Grace Hopper')
  })

  it('does not render an "Activar cobertura" button without ADM_MANAGE_TELMEX_COVERAGE', async () => {
    setManageTelmexCoverage(false)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Activar cobertura')
  })

  it('renders "Activar cobertura" with ADM_MANAGE_TELMEX_COVERAGE', async () => {
    setManageTelmexCoverage(true)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Activar cobertura')
  })

  it('warns managers when the eligible becarios fail to load, while still showing the list', async () => {
    setManageTelmexCoverage(true)
    mockAxiosGet.mockImplementation((url: string) => {
      if (url === 'api/admin/telmex-coverages')
        return Promise.resolve({ data: { res: true, data: [buildCoverage({ becario_name: 'Grace Hopper' })] } })
      return Promise.reject(new Error('network error'))
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('No se pudo cargar la lista de becarios para activar una cobertura')
    expect(wrapper.text()).toContain('Grace Hopper')
  })
})

describe('TelmexCoveragesView — activate flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    setManageTelmexCoverage(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('activates a coverage and shows it in the table without a second fetch', async () => {
    mockGetByUrl([], [buildEligible()])
    const created = buildCoverage({ id: 5, user_id: 20, becario_name: 'Ada Lovelace' })
    mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: created } })

    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Ada Lovelace')

    for (const btn of wrapper.findAll('button')) {
      if (btn.text() === 'Activar cobertura') await btn.trigger('click')
    }
    await flushPromises()

    const becarioSelect = wrapper
      .findAllComponents(VSelect)
      .find((s) => (s.props('label') as string | undefined)?.startsWith('Becario'))
    await becarioSelect?.setValue(20)
    await fieldByLabelPrefix(wrapper, 'Mes de inicio')?.setValue('2026-01')
    await submitOpenForm()
    await flushPromises()

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/telmex-coverages', {
      user_id: 20,
      start_period: '2026-01-01',
    })
    expect(mockAxiosGet).toHaveBeenCalledTimes(2) // coverages + eligible, both once at mount
    expect(wrapper.text()).toContain('Ada Lovelace')
  })
})

describe('TelmexCoveragesView — end / cancel / reactivate row actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    setManageTelmexCoverage(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('opens EndCoverageDialog from the table action and updates the row on success', async () => {
    mockGetByUrl([buildCoverage({ id: 3, status: 'ACTIVA', becario_name: 'Rosalind Franklin' })], [])
    const updated = buildCoverage({ id: 3, status: 'EN_COBRO', end_period: '2026-02-28', becario_name: 'Rosalind Franklin' })
    mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: updated } })

    const wrapper = mountView()
    await flushPromises()

    const endButtons = wrapper.findAll('button').filter((b) => b.find('.mdi-cash-check').exists())
    expect(endButtons).toHaveLength(1)
    await endButtons[0].trigger('click')
    await flushPromises()

    expect(body().text()).toContain('Rosalind Franklin')

    await fieldByLabelPrefix(wrapper, 'Telmex empezó')?.setValue('2026-03')
    await submitOpenForm()
    await flushPromises()

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/telmex-coverages/3/end', { telmex_start_period: '2026-03-01' })
    expect(wrapper.text()).toContain('En cobro')
  })

  it('opens CancelCoverageDialog from the table action and updates the row on success', async () => {
    mockGetByUrl([buildCoverage({ id: 4, status: 'EN_COBRO', becario_name: 'Marie Curie' })], [])
    const cancelled = buildCoverage({ id: 4, status: 'CANCELADA', cancel_reason: 'Egresó.', becario_name: 'Marie Curie' })
    mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: cancelled } })

    const wrapper = mountView()
    await flushPromises()

    const cancelButtons = wrapper.findAll('button').filter((b) => b.find('.mdi-close-circle-outline').exists())
    expect(cancelButtons).toHaveLength(1)
    await cancelButtons[0].trigger('click')
    await flushPromises()

    await wrapper.findComponent(VTextarea).setValue('Becario egresó de IU.')
    await submitOpenForm()
    await flushPromises()

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/telmex-coverages/4/cancel', { reason: 'Becario egresó de IU.' })
    expect(wrapper.text()).toContain('Cancelada')
  })

  it('reactivates a coverage via the confirm dialog and updates the row on success', async () => {
    mockGetByUrl(
      [buildCoverage({ id: 6, status: 'CANCELADA', has_paid_covered_month: false, becario_name: 'Chien-Shiung Wu' })],
      [],
    )
    const reactivated = buildCoverage({ id: 6, status: 'ACTIVA', cancel_reason: null, becario_name: 'Chien-Shiung Wu' })
    mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: reactivated } })

    const wrapper = mountView()
    await flushPromises()

    const reactivateButtons = wrapper.findAll('button').filter((b) => b.find('.mdi-restore').exists())
    expect(reactivateButtons).toHaveLength(1)
    await reactivateButtons[0].trigger('click')
    await flushPromises()

    const confirmButtons = body().findAll('button').filter((b) => b.text() === 'Reactivar')
    expect(confirmButtons.length).toBeGreaterThan(0)
    await confirmButtons[0].trigger('click')
    await flushPromises()

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/telmex-coverages/6/reactivate')
    expect(wrapper.text()).toContain('Activa')
  })
})
