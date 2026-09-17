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
  only_pending_from_previous: false,
  resolution_type: null,
  resolution_cause: null,
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

  it('says "Solo mes retenido" when the current month pays nothing, not "Incluye"', () => {
    const wrapper = mountTable([
      buildRow({ refrend_id: 1, has_pending_from_previous: true, only_pending_from_previous: true }),
    ])

    expect(wrapper.text()).toContain('Solo mes retenido')
    expect(wrapper.text()).not.toContain('Incluye mes retenido')
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

  it('does not style "Motivo" as an error when the only blocking reason is ALREADY_PAID', () => {
    const wrapper = mountTable([
      buildRow({
        refrend_id: 4,
        is_payable: false,
        blocking_reasons: [{ code: 'ALREADY_PAID', message: 'Pago ya realizado' }],
      }),
    ])

    const cells = wrapper.findAll('tbody tr')[0].findAll('td')
    const motivoCell = cells[cells.length - 2]

    expect(motivoCell.text()).toContain('Pago ya realizado')
    expect(motivoCell.find('.text-error').exists()).toBe(false)
  })

  it('still styles "Motivo" as an error when ALREADY_PAID appears alongside a real blocking reason', () => {
    const wrapper = mountTable([
      buildRow({
        refrend_id: 5,
        is_payable: false,
        blocking_reasons: [
          { code: 'ALREADY_PAID', message: 'Pago ya realizado' },
          { code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' },
        ],
      }),
    ])

    const cells = wrapper.findAll('tbody tr')[0].findAll('td')
    const motivoCell = cells[cells.length - 2]

    expect(motivoCell.find('.text-error').exists()).toBe(true)
  })

  // ── Resolution indicator chip (sdd/resolution-status-visibility) ─────────

  describe('resolution indicator chip', () => {
    it.each([
      ['RETENIDA', 'mdi-lock-outline', 'amber-darken-2', 'Beca retenida'],
      ['SIN_PAGO', 'mdi-cash-remove', 'red', 'Sin pago'],
      ['DESCUENTO_DEFINITIVO', 'mdi-cash-minus', 'purple-darken-2', 'Descuento definitivo'],
      // BECA_MES must chip too, not hide — user override of proposal D5.
      ['BECA_MES', 'mdi-cash-check', 'green', 'Pago sin penalización'],
    ])('renders the correct icon/color/aria-label for resolution_type=%s', (resolutionType, icon, color, label) => {
      const wrapper = mountTable([buildRow({ resolution_type: resolutionType, resolution_cause: null })])

      const chip = wrapper.find('[data-testid="resolution-chip"]')
      expect(chip.exists()).toBe(true)
      expect(chip.attributes('aria-label')).toBe(label)
      expect(chip.find('.v-icon').classes()).toContain(icon)
      expect(chip.classes().join(' ')).toContain(`text-${color}`)
    })

    it('shows the label as visible chip text, not only on hover', () => {
      const wrapper = mountTable([buildRow({ resolution_type: 'DESCUENTO_DEFINITIVO', resolution_cause: null })])

      const chip = wrapper.find('[data-testid="resolution-chip"]')
      expect(chip.text()).toContain('Descuento definitivo')
    })

    it('renders no resolution chip when resolution_type is null', () => {
      const wrapper = mountTable([buildRow({ resolution_type: null })])

      expect(wrapper.find('[data-testid="resolution-chip"]').exists()).toBe(false)
    })

    it('coexists with has_incident and has_pending_from_previous chips without displacing either', () => {
      const wrapper = mountTable([
        buildRow({
          has_incident: true,
          has_pending_from_previous: true,
          resolution_type: 'RETENIDA',
        }),
      ])

      expect(wrapper.text()).toContain('Incidencia registrada')
      expect(wrapper.text()).toContain('Incluye mes retenido')
      expect(wrapper.find('[data-testid="resolution-chip"]').exists()).toBe(true)
    })

    it('appends "· Motivo: {resolution_cause}" to the aria-label when resolution_cause is non-null', () => {
      const wrapper = mountTable([buildRow({ resolution_type: 'RETENIDA', resolution_cause: 'FALTAS_FI' })])

      const chip = wrapper.find('[data-testid="resolution-chip"]')
      expect(chip.attributes('aria-label')).toBe('Beca retenida · Motivo: FALTAS_FI')
    })

    it('aria-label is the label alone when resolution_cause is null', () => {
      const wrapper = mountTable([buildRow({ resolution_type: 'RETENIDA', resolution_cause: null })])

      const chip = wrapper.find('[data-testid="resolution-chip"]')
      expect(chip.attributes('aria-label')).toBe('Beca retenida')
    })
  })
})
