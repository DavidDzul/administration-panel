// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import type { ChequeRow, ChequeSummary } from '@/interfaces/payment'

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

import ChequePaymentSection from '@/components/pagos/ChequePaymentSection.vue'

const vuetify = createVuetify()

const buildRow = (overrides: Partial<ChequeRow> = {}): ChequeRow =>
  ({
    refrend_id: 1,
    user_id: 1,
    snapshot_name: 'Ada Lovelace',
    enrollment: 'A0001',
    bank_name: null,
    account_number: null,
    total_to_pay: '1000.00',
    is_payable: true,
    blocking_reasons: [],
    status: 'DRAFT',
    payment_method: 'CHEQUE',
    paid_payment_method: null,
    cheque_number: null,
    cheque_delivered_at: null,
    cheque_notes: null,
    cheque_beneficiary: null,
    ...overrides,
  }) as ChequeRow

const summary: ChequeSummary = {
  total: 3,
  ready: 1,
  paid: 1,
  blocking: 1,
  ready_amount: '1000.00',
  paid_amount: '2500.50',
}

const mountSection = (rows: ChequeRow[], canManage = true, sum: ChequeSummary | null = summary) =>
  mount(ChequePaymentSection, {
    props: { rows, summary: sum, canManage },
    global: { plugins: [vuetify] },
  })

const paidRow = buildRow({
  refrend_id: 2,
  snapshot_name: 'Grace Hopper',
  status: 'PAID',
  is_payable: false,
  paid_payment_method: 'CHEQUE',
  cheque_number: 'CH-77',
  cheque_delivered_at: '2026-10-05',
  cheque_notes: 'Entregado a la madre',
  cheque_beneficiary: 'María Hopper',
})
const blockedRow = buildRow({
  refrend_id: 3,
  snapshot_name: 'Alan Turing',
  is_payable: false,
  blocking_reasons: [{ code: 'MISSING_PAYMENT_DATA', message: 'Faltan datos de pago' }],
})

const buttonsByText = (wrapper: ReturnType<typeof mountSection>, text: string) =>
  wrapper.findAll('button').filter((b) => b.text() === text)

describe('ChequePaymentSection', () => {
  it('renders nothing when there are no cheque rows', () => {
    const wrapper = mountSection([])
    expect(wrapper.find('[data-testid="cheque-section"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Cheques')
  })

  it('keeps rendering when the visible rows are empty but the full group source is not', () => {
    const wrapper = mount(ChequePaymentSection, {
      props: { rows: [], groupSourceRows: [buildRow(), paidRow], summary, canManage: true },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('[data-testid="cheque-section"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Monto por emitir')
    expect(wrapper.text()).toContain('No hay becarios en este lote')
  })

  it('forwards emptyText to the table', () => {
    const wrapper = mount(ChequePaymentSection, {
      props: {
        rows: [],
        groupSourceRows: [buildRow()],
        summary,
        emptyText: 'No hay becarios pendientes de revisar.',
      },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.text()).toContain('No hay becarios pendientes de revisar.')
  })

  it('builds group headers from groupSourceRows, not from the visible rows', () => {
    const wrapper = mount(ChequePaymentSection, {
      props: { rows: [blockedRow], groupSourceRows: [buildRow(), paidRow, blockedRow], summary, canManage: true },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('[data-testid="payment-group-header"]').text()).toContain('3 becarios')
  })

  it('composes heading, summary cards and the batch table in cheque mode', () => {
    const wrapper = mountSection([buildRow(), paidRow, blockedRow])
    expect(wrapper.find('[data-testid="cheque-heading"]').text()).toContain('Cheques')
    expect(wrapper.findAll('.payment-summary-card')).toHaveLength(6)
    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers).toContain('A nombre de')
    expect(headers).not.toContain('Cuenta')
    expect(wrapper.text()).toContain('Monto por emitir')
    expect(wrapper.text()).toContain('$2,500.50')
  })

  it('re-emits mark, revert and view from the table', async () => {
    const row = buildRow()
    const wrapper = mountSection([row, paidRow])
    await buttonsByText(wrapper, 'Marcar como pagado')[0].trigger('click')
    await buttonsByText(wrapper, 'Revertir')[0].trigger('click')
    await wrapper.find('.payment-name-link').trigger('click')
    expect(wrapper.emitted('mark')?.[0]).toEqual([row])
    expect(wrapper.emitted('revert')?.[0]).toEqual([paidRow])
    expect(wrapper.emitted('view')?.[0]).toEqual([row.refrend_id])
  })

  it('hides action buttons without permission', () => {
    const wrapper = mountSection([buildRow(), paidRow], false)
    expect(buttonsByText(wrapper, 'Marcar como pagado')).toHaveLength(0)
    expect(buttonsByText(wrapper, 'Revertir')).toHaveLength(0)
  })
})
