// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VBtn } from 'vuetify/components'
import TelmexCoveragesTable from '@/components/telmex/TelmexCoveragesTable.vue'
import type { TelmexCoverage } from '@/interfaces/telmexCoverage'

// Mirrors AccesosTable.test.ts's `vi.mock('vue-router', ...)` pattern — the
// becario-name link (sdd/telmex-cobertura-iu PR5, task 5.1) only needs
// `push` to be observable, not real navigation.
const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// v-data-table's pagination footer relies on ResizeObserver — same jsdom
// shim as AccesosTable.test.ts / RolesTable.test.ts.
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
  advanced: '1000.00',
  repaid: '400.00',
  balance: '600.00',
  has_paid_covered_month: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const mountTable = (props: { coverages?: TelmexCoverage[]; loading?: boolean; canManage?: boolean } = {}) =>
  mount(TelmexCoveragesTable, {
    props: { coverages: [buildCoverage()], loading: false, canManage: true, ...props },
    global: { plugins: [vuetify] },
  })

describe('TelmexCoveragesTable — renders rows', () => {
  it('renders becario, sede, generación, tipo, and the formatted money columns', () => {
    const wrapper = mountTable({ coverages: [buildCoverage()] })

    expect(wrapper.text()).toContain('Juan Pérez')
    expect(wrapper.text()).toContain('Mérida')
    expect(wrapper.text()).toContain('Gen 2024')
    expect(wrapper.text()).toContain('Telmex')
    expect(wrapper.text()).toContain('$1,000.00')
    expect(wrapper.text()).toContain('$400.00')
    expect(wrapper.text()).toContain('$600.00')
  })

  it('renders "Telmex - IU" for a TELMEX_IU coverage', () => {
    const wrapper = mountTable({ coverages: [buildCoverage({ scholarship_type_at_activation: 'TELMEX_IU' })] })

    expect(wrapper.text()).toContain('Telmex - IU')
  })

  it('renders the status label for each lifecycle state', () => {
    const wrapper = mountTable({ coverages: [buildCoverage({ status: 'EN_COBRO' })] })

    expect(wrapper.text()).toContain('En cobro')
  })

  it('shows "Presente" for an open-ended covered period (end_period null)', () => {
    const wrapper = mountTable({ coverages: [buildCoverage({ start_period: '2026-01-01', end_period: null })] })

    expect(wrapper.text()).toContain('01/2026')
    expect(wrapper.text()).toContain('Presente')
  })

  it('shows the empty state when there are no coverages', () => {
    const wrapper = mountTable({ coverages: [] })

    expect(wrapper.text()).toContain('No existen datos registrados')
  })
})

describe('TelmexCoveragesTable — row actions gated on canManage and status', () => {
  it('shows "Marcar inicio de pago" only for ACTIVA rows when canManage is true', async () => {
    const wrapper = mountTable({ coverages: [buildCoverage({ status: 'ACTIVA' })], canManage: true })

    const endButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-cash-check')
    expect(endButtons).toHaveLength(1)

    await endButtons[0].trigger('click')
    expect(wrapper.emitted('end')?.[0]).toEqual([buildCoverage({ status: 'ACTIVA' })])
  })

  it('hides every action button when canManage is false', () => {
    const wrapper = mountTable({ coverages: [buildCoverage({ status: 'ACTIVA' })], canManage: false })

    expect(wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-cash-check')).toHaveLength(0)
    expect(wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-close-circle-outline')).toHaveLength(0)
  })

  it('shows "Cancelar" for both ACTIVA and EN_COBRO rows, emitting cancel with the item', async () => {
    const wrapper = mountTable({ coverages: [buildCoverage({ status: 'EN_COBRO' })], canManage: true })

    const cancelButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-close-circle-outline')
    expect(cancelButtons).toHaveLength(1)

    await cancelButtons[0].trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('hides "Cancelar" and "Marcar inicio de pago" for a LIQUIDADA row', () => {
    const wrapper = mountTable({ coverages: [buildCoverage({ status: 'LIQUIDADA' })], canManage: true })

    expect(wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-cash-check')).toHaveLength(0)
    expect(wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-close-circle-outline')).toHaveLength(0)
  })

  it('shows "Reactivar" only for a CANCELADA row with no paid covered month', async () => {
    const wrapper = mountTable({
      coverages: [buildCoverage({ status: 'CANCELADA', has_paid_covered_month: false })],
      canManage: true,
    })

    const reactivateButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-restore')
    expect(reactivateButtons).toHaveLength(1)

    await reactivateButtons[0].trigger('click')
    expect(wrapper.emitted('reactivate')).toHaveLength(1)
  })

  it('hides "Reactivar" for a CANCELADA row that already had a paid covered month', () => {
    const wrapper = mountTable({
      coverages: [buildCoverage({ status: 'CANCELADA', has_paid_covered_month: true })],
      canManage: true,
    })

    expect(wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-restore')).toHaveLength(0)
  })
})

describe('TelmexCoveragesTable — becario name navigates to the detail route', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  it('navigates to /becas-telmex/:id when the becario name is clicked', async () => {
    const wrapper = mountTable({ coverages: [buildCoverage({ id: 42 })] })

    const nameLink = wrapper.find('[data-testid="telmex-coverage-name-link"]')
    expect(nameLink.exists()).toBe(true)

    await nameLink.trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/becas-telmex/42')
  })
})
