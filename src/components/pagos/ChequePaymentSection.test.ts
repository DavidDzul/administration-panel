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
    status: 'AUTHORIZED',
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

  it('shows the title, summary line and amounts', () => {
    const wrapper = mountSection([buildRow(), paidRow, blockedRow])
    const text = wrapper.text()
    expect(text).toContain('Cheques')
    expect(text).toContain('3 becarios · 1 por emitir · 1 pagados')
    expect(text).toContain('Por emitir:')
    expect(text).toContain('$1,000.00')
    expect(text).toContain('Pagado:')
    expect(text).toContain('$2,500.50')
  })

  it('shows Becario when the beneficiary is empty and the beneficiary otherwise', () => {
    const wrapper = mountSection([buildRow(), paidRow])
    const text = wrapper.text()
    expect(text).toContain('Becario')
    expect(text).toContain('María Hopper')
  })

  it('renders the status chips per row state', () => {
    const text = mountSection([buildRow(), paidRow, blockedRow]).text()
    expect(text).toContain('Por emitir')
    expect(text).toContain('Pagado (cheque)')
    expect(text).toContain('Bloqueado')
  })

  it('shows blocking reason messages for blocked rows', () => {
    expect(mountSection([blockedRow]).text()).toContain('Faltan datos de pago')
  })

  it('shows cheque number and DD/MM/YYYY delivery date for paid rows', () => {
    const text = mountSection([paidRow]).text()
    expect(text).toContain('CH-77')
    expect(text).toContain('05/10/2026')
  })

  it('shows "Marcar como pagado" only for payable unpaid rows and emits mark(row)', async () => {
    const row = buildRow()
    const wrapper = mountSection([row, paidRow, blockedRow])
    const buttons = buttonsByText(wrapper, 'Marcar como pagado')
    expect(buttons).toHaveLength(1)
    await buttons[0].trigger('click')
    expect(wrapper.emitted('mark')?.[0]).toEqual([row])
  })

  it('shows "Revertir" only for paid cheque rows and emits revert(row)', async () => {
    const wrapper = mountSection([buildRow(), paidRow])
    const buttons = buttonsByText(wrapper, 'Revertir')
    expect(buttons).toHaveLength(1)
    await buttons[0].trigger('click')
    expect(wrapper.emitted('revert')?.[0]).toEqual([paidRow])
  })

  it('hides every action button without permission', () => {
    const wrapper = mountSection([buildRow(), paidRow], false)
    expect(buttonsByText(wrapper, 'Marcar como pagado')).toHaveLength(0)
    expect(buttonsByText(wrapper, 'Revertir')).toHaveLength(0)
  })
})
