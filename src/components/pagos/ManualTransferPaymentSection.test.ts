// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import type { ManualTransferRow, ManualTransferSummary } from '@/interfaces/payment'

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

import ManualTransferPaymentSection from '@/components/pagos/ManualTransferPaymentSection.vue'

const vuetify = createVuetify()

const buildRow = (overrides: Partial<ManualTransferRow> = {}): ManualTransferRow =>
  ({
    refrend_id: 1,
    user_id: 1,
    snapshot_name: 'Ada Lovelace',
    enrollment: 'A0001',
    bank_name: 'Banorte',
    bank_code: '072',
    account_number: '072180001234567895',
    total_to_pay: '1000.00',
    is_payable: true,
    blocking_reasons: [],
    status: 'DRAFT',
    payment_method: 'MANUAL_TRANSFER',
    paid_payment_method: null,
    transfer_reference: null,
    transfer_paid_at: null,
    transfer_notes: null,
    ...overrides,
  }) as ManualTransferRow

const summary: ManualTransferSummary = {
  total: 3,
  ready: 1,
  paid: 1,
  blocking: 1,
  ready_amount: '1000.00',
  paid_amount: '2500.50',
}

const mountSection = (rows: ManualTransferRow[], canManage = true, sum: ManualTransferSummary | null = summary) =>
  mount(ManualTransferPaymentSection, {
    props: { rows, summary: sum, canManage },
    global: { plugins: [vuetify] },
  })

const paidRow = buildRow({
  refrend_id: 2,
  snapshot_name: 'Grace Hopper',
  bank_name: 'Santander',
  status: 'PAID',
  is_payable: false,
  paid_payment_method: 'MANUAL_TRANSFER',
  transfer_reference: 'SPEI-77',
  transfer_paid_at: '2026-10-05',
  transfer_notes: 'Confirmado',
})
const blockedRow = buildRow({
  refrend_id: 3,
  snapshot_name: 'Alan Turing',
  is_payable: false,
  blocking_reasons: [{ code: 'CLABE_BANK_MISMATCH', message: 'La CLABE no corresponde al banco' }],
})

const buttonsByText = (wrapper: ReturnType<typeof mountSection>, text: string) =>
  wrapper.findAll('button').filter((b) => b.text() === text)

describe('ManualTransferPaymentSection', () => {
  it('renders nothing when there are no manual transfer rows', () => {
    const wrapper = mountSection([])
    expect(wrapper.find('[data-testid="manual-transfer-section"]').exists()).toBe(false)
  })

  it('keeps rendering when the visible rows are empty but the full group source is not', () => {
    const wrapper = mount(ManualTransferPaymentSection, {
      props: { rows: [], groupSourceRows: [buildRow(), paidRow], summary, canManage: true },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('[data-testid="manual-transfer-section"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No hay becarios en este lote')
  })

  it('composes heading, summary cards and the table with bank, CLABE and folio columns', () => {
    const wrapper = mountSection([buildRow(), paidRow, blockedRow])
    expect(wrapper.find('[data-testid="manual-transfer-heading"]').text()).toContain('Transferencias a otros bancos')
    expect(wrapper.findAll('.payment-summary-card')).toHaveLength(6)
    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers).toContain('Banco')
    expect(headers).toContain('CLABE')
    expect(headers).toContain('Folio')
    expect(headers).not.toContain('Cuenta')
    expect(wrapper.text()).toContain('Monto por pagar')
    expect(wrapper.text()).toContain('$2,500.50')
  })

  it('shows bank, full CLABE, reference and the paid chip', () => {
    const wrapper = mountSection([buildRow(), paidRow])
    const text = wrapper.text()
    expect(text).toContain('Banorte')
    expect(text).toContain('072180001234567895')
    expect(text).toContain('Pagado (transferencia)')
    expect(wrapper.find('[data-testid="transfer-info"]').text()).toContain('SPEI-77')
    expect(wrapper.find('[data-testid="transfer-info"]').text()).toContain('05/10/2026')
  })

  it('shows the blocking reason of a blocked row', () => {
    const wrapper = mountSection([blockedRow])
    expect(wrapper.text()).toContain('La CLABE no corresponde al banco')
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

  it('uses transfer wording in the action aria-labels', () => {
    const wrapper = mountSection([buildRow(), paidRow])
    const labels = wrapper.findAll('button').map((b) => b.attributes('aria-label') ?? '')
    expect(labels).toContain('Marcar como pagado por transferencia a Ada Lovelace')
    expect(labels).toContain('Revertir pago por transferencia de Grace Hopper')
  })

  it('hides action buttons without permission', () => {
    const wrapper = mountSection([buildRow(), paidRow], false)
    expect(buttonsByText(wrapper, 'Marcar como pagado')).toHaveLength(0)
    expect(buttonsByText(wrapper, 'Revertir')).toHaveLength(0)
  })
})
