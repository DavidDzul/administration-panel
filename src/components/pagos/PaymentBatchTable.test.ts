// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VBtn } from 'vuetify/components'
import type { PaymentBatchRow } from '@/interfaces/payment'

// Same jsdom shim as PaymentsView.test.ts.
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

import PaymentBatchTable from '@/components/pagos/PaymentBatchTable.vue'

const vuetify = createVuetify()

const buildRow = (overrides: Partial<PaymentBatchRow> = {}): PaymentBatchRow => ({
  refrend_id: 1,
  user_id: 1,
  snapshot_name: 'Ada Lovelace',
  enrollment: 'A0001',
  bank_name: 'BBVA',
  account_number: '012180001234567895',
  total_to_pay: '1000.00',
  is_payable: true,
  blocking_reasons: [],
  outcome: null,
  outcome_reason: null,
  has_incident: false,
  has_pending_from_previous: false,
  ...overrides,
})

const mountTable = (rows: PaymentBatchRow[]) =>
  mount(PaymentBatchTable, {
    props: { rows },
    global: { plugins: [vuetify] },
  })

describe('PaymentBatchTable', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('never renders the full account number, only the masked last 4 digits', () => {
    const wrapper = mountTable([buildRow({ account_number: '012180001234567895' })])

    expect(wrapper.text()).not.toContain('012180001234567895')
    expect(wrapper.text()).toContain('••••7895')
  })

  it('shows a clear placeholder when the becario has no account number on file', () => {
    const wrapper = mountTable([buildRow({ account_number: null })])

    expect(wrapper.text()).toContain('Sin cuenta')
  })

  it('shows an incidencia chip only for rows with has_incident=true', () => {
    const wrapper = mountTable([
      buildRow({ refrend_id: 1, snapshot_name: 'Ada Lovelace', has_incident: true }),
      buildRow({ refrend_id: 2, snapshot_name: 'Grace Hopper', has_incident: false }),
    ])

    expect(wrapper.text()).toContain('Incidencia registrada')

    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('Incidencia registrada')
    expect(rows[1].text()).not.toContain('Incidencia registrada')
  })

  it('shows a "mes retenido" chip only for rows with has_pending_from_previous=true', () => {
    const wrapper = mountTable([
      buildRow({ refrend_id: 1, snapshot_name: 'Ada Lovelace', has_pending_from_previous: true }),
      buildRow({ refrend_id: 2, snapshot_name: 'Grace Hopper', has_pending_from_previous: false }),
    ])

    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('Incluye mes retenido')
    expect(rows[1].text()).not.toContain('Incluye mes retenido')
  })

  it('emits "view" with the refrend_id instead of navigating when "Ver" is clicked', async () => {
    const wrapper = mountTable([buildRow({ refrend_id: 7 })])

    const viewButton = wrapper.findAllComponents(VBtn).find((b) => b.text() === 'Ver')
    await viewButton?.trigger('click')

    expect(wrapper.emitted('view')).toEqual([[7]])
  })

  it('shows the blocking reasons in the "Motivo" column, not under the Estado chip', () => {
    const wrapper = mountTable([
      buildRow({
        refrend_id: 2,
        is_payable: false,
        blocking_reasons: [{ code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' }],
      }),
    ])

    const cells = wrapper.findAll('tbody tr')[0].findAll('td')
    const estadoCell = cells[cells.length - 3]
    const motivoCell = cells[cells.length - 2]

    expect(estadoCell.text()).not.toContain('Sin matrícula registrada')
    expect(motivoCell.text()).toContain('Sin matrícula registrada')
  })

  it('shows a dash in "Motivo" for a payable row with nothing to report', () => {
    const wrapper = mountTable([buildRow({ refrend_id: 3, is_payable: true, blocking_reasons: [] })])

    const cells = wrapper.findAll('tbody tr')[0].findAll('td')
    const motivoCell = cells[cells.length - 2]

    expect(motivoCell.text()).toBe('—')
  })
})
