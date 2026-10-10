// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VBtn } from 'vuetify/components'
import CoverageStatement from '@/components/telmex/CoverageStatement.vue'
import type { TelmexCoverageMonth, TelmexCoveragePayment } from '@/interfaces/telmexCoverage'

// v-data-table's pagination footer relies on ResizeObserver — same jsdom
// shim as every other *Table.test.ts in this project.
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

const buildMonth = (overrides: Partial<TelmexCoverageMonth> = {}): TelmexCoverageMonth => ({
  period: '2026-01-01',
  covered_amount: 500,
  is_paid: true,
  payment_batch_id: 3,
  ...overrides,
})

const buildPayment = (overrides: Partial<TelmexCoveragePayment> = {}): TelmexCoveragePayment => ({
  id: 1,
  coverage_id: 5,
  amount: 400,
  paid_at: '2026-02-01',
  reference: 'DEP-001',
  notes: 'Primer abono',
  is_voided: false,
  voided_at: null,
  void_reason: null,
  created_at: '2026-02-01T00:00:00Z',
  ...overrides,
})

const mountStatement = (
  props: {
    months?: TelmexCoverageMonth[]
    payments?: TelmexCoveragePayment[]
    coverageStatus?: 'ACTIVA' | 'EN_COBRO' | 'LIQUIDADA' | 'CANCELADA'
    canManageRepayments?: boolean
  } = {},
) =>
  mount(CoverageStatement, {
    props: {
      months: [buildMonth()],
      payments: [buildPayment()],
      coverageStatus: 'EN_COBRO',
      canManageRepayments: true,
      ...props,
    },
    global: { plugins: [vuetify] },
  })

describe('CoverageStatement — months table', () => {
  it('renders periodo, lote, monto adelantado and estado del pago', () => {
    const wrapper = mountStatement({ months: [buildMonth({ period: '2026-01-01', payment_batch_id: 3 })] })

    expect(wrapper.text()).toContain('01/2026')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('$500.00')
    expect(wrapper.text()).toContain('Pagado')
  })

  it('shows "Pendiente" for an unpaid month with no batch', () => {
    const wrapper = mountStatement({ months: [buildMonth({ is_paid: false, payment_batch_id: null })] })

    expect(wrapper.text()).toContain('Pendiente')
  })

  it('shows a warning chip when the month overlaps an active temporary increase', () => {
    const wrapper = mountStatement({ months: [buildMonth({ has_temporary_increase: true })] })

    expect(wrapper.find('[data-testid="coverage-increase-overlap-chip"]').exists()).toBe(true)
  })

  it('explains that the temporary increase is not part of the debt', () => {
    const wrapper = mountStatement({ months: [buildMonth({ has_temporary_increase: true })] })

    const tooltip = wrapper.findAllComponents({ name: 'VTooltip' }).find((t) =>
      String(t.props('text')).includes('aumento temporal'),
    )
    expect(tooltip?.props('text')).toBe(
      'Este mes también se pagó un aumento temporal. Ese aumento es dinero de IU y no forma parte de lo que el becario debe devolver.',
    )
  })

  it('renders no overlap chip when has_temporary_increase is false/absent', () => {
    const wrapper = mountStatement({ months: [buildMonth({ has_temporary_increase: false })] })

    expect(wrapper.find('[data-testid="coverage-increase-overlap-chip"]').exists()).toBe(false)
  })
})

describe('CoverageStatement — payments table', () => {
  it('renders fecha, monto, referencia and notas', () => {
    const wrapper = mountStatement({
      payments: [buildPayment({ paid_at: '2026-02-15', amount: 400, reference: 'DEP-001', notes: 'Primer abono' })],
    })

    expect(wrapper.text()).toContain('$400.00')
    expect(wrapper.text()).toContain('DEP-001')
    expect(wrapper.text()).toContain('Primer abono')
  })

  it('falls back to a dash when reference/notes are null', () => {
    const wrapper = mountStatement({ payments: [buildPayment({ reference: null, notes: null })] })

    expect(wrapper.text()).toContain('—')
  })

  it('shows the void reason for a voided payment', () => {
    const wrapper = mountStatement({
      payments: [buildPayment({ is_voided: true, void_reason: 'Depósito duplicado por error' })],
    })

    expect(wrapper.text()).toContain('Depósito duplicado por error')
  })

  it('shows an "Anular" button for a non-voided payment when canManageRepayments and status !== CANCELADA', () => {
    const wrapper = mountStatement({ payments: [buildPayment({ is_voided: false })], coverageStatus: 'EN_COBRO' })

    const voidButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Anular'))
    expect(voidButtons).toHaveLength(1)
  })

  it('hides "Anular" for an already-voided payment', () => {
    const wrapper = mountStatement({ payments: [buildPayment({ is_voided: true })], coverageStatus: 'EN_COBRO' })

    const voidButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Anular'))
    expect(voidButtons).toHaveLength(0)
  })

  it('hides "Anular" when canManageRepayments is false', () => {
    const wrapper = mountStatement({
      payments: [buildPayment({ is_voided: false })],
      canManageRepayments: false,
    })

    const voidButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Anular'))
    expect(voidButtons).toHaveLength(0)
  })

  it('hides "Anular" when the coverage is CANCELADA', () => {
    const wrapper = mountStatement({
      payments: [buildPayment({ is_voided: false })],
      coverageStatus: 'CANCELADA',
    })

    const voidButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Anular'))
    expect(voidButtons).toHaveLength(0)
  })

  it('emits "void" with the payment when "Anular" is clicked', async () => {
    const payment = buildPayment({ id: 9, is_voided: false })
    const wrapper = mountStatement({ payments: [payment], coverageStatus: 'EN_COBRO' })

    const voidButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Anular'))
    await voidButtons[0].trigger('click')

    expect(wrapper.emitted('void')?.[0]).toEqual([payment])
  })
})

describe('CoverageStatement — Registrar abono', () => {
  it('shows "Registrar abono" only when canManageRepayments AND coverageStatus is EN_COBRO', () => {
    const wrapper = mountStatement({ canManageRepayments: true, coverageStatus: 'EN_COBRO' })

    const registerButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Registrar abono'))
    expect(registerButtons).toHaveLength(1)
  })

  it('hides "Registrar abono" for ACTIVA (decisions-2 #1926: only EN_COBRO)', () => {
    const wrapper = mountStatement({ canManageRepayments: true, coverageStatus: 'ACTIVA' })

    const registerButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Registrar abono'))
    expect(registerButtons).toHaveLength(0)
  })

  it('hides "Registrar abono" when canManageRepayments is false', () => {
    const wrapper = mountStatement({ canManageRepayments: false, coverageStatus: 'EN_COBRO' })

    const registerButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Registrar abono'))
    expect(registerButtons).toHaveLength(0)
  })

  it('emits "register" when "Registrar abono" is clicked', async () => {
    const wrapper = mountStatement({ canManageRepayments: true, coverageStatus: 'EN_COBRO' })

    const registerButtons = wrapper.findAllComponents(VBtn).filter((b) => b.text().includes('Registrar abono'))
    await registerButtons[0].trigger('click')

    expect(wrapper.emitted('register')).toHaveLength(1)
  })
})
