// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import GenerationPaymentRowsTable from '@/components/pagos/GenerationPaymentRowsTable.vue'
import GenerationPaymentSummary from '@/components/pagos/GenerationPaymentSummary.vue'
import { formatAmount } from '@/utils/paymentBreakdownMeta'
import type { GenerationPaymentRow, GenerationPaymentSummary as SummaryModel } from '@/interfaces/payment'

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const vuetify = createVuetify()

let nextId = 1
const buildRow = (overrides: Partial<GenerationPaymentRow> = {}): GenerationPaymentRow => {
  const id = nextId++
  return {
    refrend_id: id,
    user_id: id,
    enrollment: `MAT-${id}`,
    full_name: `Becario ${id}`,
    scholarship_type: 'IU',
    beca: '0.00',
    apoyo: '0.00',
    pago_iu: '0.00',
    temporary_increase: '0.00',
    telmex_coverage: '0.00',
    discounts: '0.00',
    pending_and_advance: '0.00',
    total_to_pay: '0.00',
    state: 'PENDING',
    ...overrides,
  }
}

const mountTable = (rows: GenerationPaymentRow[]) =>
  mount(GenerationPaymentRowsTable, { global: { plugins: [vuetify] }, props: { rows } })

const bodyRows = (wrapper: ReturnType<typeof mountTable>) => wrapper.findAll('tbody tr')

describe('GenerationPaymentRowsTable', () => {
  it('renders the 12 columns in the specified order', () => {
    const wrapper = mountTable([buildRow()])

    const titles = wrapper.findAll('thead th').map((th) => th.text())

    expect(titles).toEqual([
      'Matrícula',
      'Nombre completo',
      'Tipo de beca',
      'Beca',
      'Apoyo',
      'Pago IU',
      'Aumento temporal',
      'Cobertura Telmex',
      'Descuentos y retenciones',
      'Pendiente / adelanto',
      'Total a pagar',
      'Estado',
    ])
  })

  it('labels scholarship types IU, Telmex-IU and Telmex', () => {
    const wrapper = mountTable([
      buildRow({ full_name: 'A', scholarship_type: 'IU' }),
      buildRow({ full_name: 'B', scholarship_type: 'TELMEX_IU' }),
      buildRow({ full_name: 'C', scholarship_type: 'TELMEX' }),
    ])

    const typeCells = bodyRows(wrapper).map((tr) => tr.findAll('td')[2].text())

    expect(typeCells).toEqual(['IU', 'Telmex-IU', 'Telmex'])
  })

  it('formats money and mutes zero values with text-disabled', () => {
    const wrapper = mountTable([buildRow({ beca: '2000.00', total_to_pay: '2000.00' })])

    const beca = wrapper.find('[data-testid="cell-beca"]')
    const apoyo = wrapper.find('[data-testid="cell-apoyo"]')

    expect(beca.text()).toBe(formatAmount('2000.00'))
    expect(beca.classes()).not.toContain('text-disabled')
    expect(apoyo.text()).toBe(formatAmount('0.00'))
    expect(apoyo.classes()).toContain('text-disabled')
  })

  it('prefixes positive discounts with a minus sign and leaves zero discounts plain and muted', () => {
    const wrapper = mountTable([
      buildRow({ full_name: 'A', discounts: '340.00' }),
      buildRow({ full_name: 'B', discounts: '0.00' }),
    ])

    const cells = wrapper.findAll('[data-testid="cell-discounts"]')

    expect(cells[0].text()).toBe(`−${formatAmount('340.00')}`)
    expect(cells[1].text()).toBe(formatAmount('0.00'))
    expect(cells[1].classes()).toContain('text-disabled')
  })

  it('renders the state chips with their label and color', () => {
    const wrapper = mountTable([
      buildRow({ full_name: 'A', state: 'PAID' }),
      buildRow({ full_name: 'B', state: 'PENDING' }),
      buildRow({ full_name: 'C', state: 'BLOCKED' }),
      buildRow({ full_name: 'D', state: 'NO_IU_PAYMENT' }),
    ])

    const chips = wrapper.findAll('[data-testid="state-chip"]')

    expect(chips.map((c) => c.text())).toEqual(['Pagado', 'Por pagar', 'Bloqueado', 'Sin pago IU'])
    expect(chips[0].classes()).toContain('text-success')
    expect(chips[1].classes()).toContain('text-info')
    expect(chips[2].classes()).toContain('text-error')
    expect(chips[3].classes()).toContain('text-grey')
  })

  it('mutes the whole NO_IU_PAYMENT row and no other', () => {
    const wrapper = mountTable([
      buildRow({ full_name: 'A', state: 'PENDING' }),
      buildRow({ full_name: 'B', state: 'NO_IU_PAYMENT' }),
    ])

    const trs = bodyRows(wrapper)

    expect(trs[0].classes()).not.toContain('generation-row-muted')
    expect(trs[1].classes()).toContain('generation-row-muted')
  })

  it('footer totals sum PAID and PENDING rows only, excluding BLOCKED and NO_IU_PAYMENT', () => {
    const wrapper = mountTable([
      buildRow({ state: 'PAID', beca: '1000.00', discounts: '100.00', total_to_pay: '900.00' }),
      buildRow({ state: 'PENDING', beca: '500.00', pending_and_advance: '50.00', total_to_pay: '550.00' }),
      buildRow({ state: 'BLOCKED', beca: '9999.00', total_to_pay: '9999.00' }),
      buildRow({ state: 'NO_IU_PAYMENT', scholarship_type: 'TELMEX' }),
    ])

    const total = (key: string) => wrapper.find(`[data-testid="total-${key}"]`).text()

    expect(wrapper.find('[data-testid="totals-row"]').text()).toContain('Totales')
    expect(total('beca')).toBe(formatAmount('1500.00'))
    expect(total('discounts')).toBe(`−${formatAmount('100.00')}`)
    expect(total('pending_and_advance')).toBe(formatAmount('50.00'))
    expect(total('total_to_pay')).toBe(formatAmount('1450.00'))
  })

  it('shows the caption explaining what the totals exclude', () => {
    const wrapper = mountTable([buildRow()])

    expect(wrapper.find('[data-testid="totals-caption"]').text()).toBe(
      'Los totales no incluyen becarios bloqueados ni Telmex sin pago IU.',
    )
  })

  it('sorts by full name by default, ignoring accents and case', () => {
    const wrapper = mountTable([
      buildRow({ full_name: 'zavala' }),
      buildRow({ full_name: 'Álvarez' }),
      buildRow({ full_name: 'bravo' }),
    ])

    const names = bodyRows(wrapper).map((tr) => tr.findAll('td')[1].text())

    expect(names).toEqual(['Álvarez', 'bravo', 'zavala'])
  })

  it('sorts a money column numerically when its header is clicked', async () => {
    const wrapper = mountTable([
      buildRow({ full_name: 'A', total_to_pay: '900.00' }),
      buildRow({ full_name: 'B', total_to_pay: '1000.00' }),
      buildRow({ full_name: 'C', total_to_pay: '95.00' }),
    ])

    const header = wrapper.findAll('thead th').find((th) => th.text() === 'Total a pagar')
    await header?.trigger('click')

    const totals = wrapper.findAll('[data-testid="cell-total_to_pay"]').map((c) => c.text())

    expect(totals).toEqual([formatAmount('95.00'), formatAmount('900.00'), formatAmount('1000.00')])
  })

  // Footer cells are laid out with colspan, so alignment is checked on the
  // starting grid column of each cell, not on the DOM child index.
  const footerColumns = (wrapper: ReturnType<typeof mountTable>) => {
    let start = 0
    return wrapper.findAll('[data-testid="totals-row"] td').map((td) => {
      const span = Number(td.attributes('colspan') ?? 1)
      const cell = { start, span, el: td }
      start += span
      return cell
    })
  }

  it('footer spans exactly the header column count', () => {
    const wrapper = mountTable([buildRow()])
    const headerCount = wrapper.findAll('thead th').length
    const cells = footerColumns(wrapper)

    expect(cells.reduce((sum, c) => sum + c.span, 0)).toBe(headerCount)
  })

  it('places every total under its own header', () => {
    const wrapper = mountTable([buildRow({ state: 'PAID', beca: '10.00', total_to_pay: '10.00' })])
    const titles = wrapper.findAll('thead th').map((th) => th.text())
    const byKey: Record<string, string> = {
      beca: 'Beca',
      apoyo: 'Apoyo',
      pago_iu: 'Pago IU',
      temporary_increase: 'Aumento temporal',
      telmex_coverage: 'Cobertura Telmex',
      discounts: 'Descuentos y retenciones',
      pending_and_advance: 'Pendiente / adelanto',
      total_to_pay: 'Total a pagar',
    }
    const cells = footerColumns(wrapper)

    for (const [key, title] of Object.entries(byKey)) {
      const cell = cells.find((c) => c.el.find(`[data-testid="total-${key}"]`).exists())
      expect(cell?.start, key).toBe(titles.indexOf(title))
    }
  })

  it('adds float-prone cents exactly', () => {
    const wrapper = mountTable([
      buildRow({ state: 'PAID', total_to_pay: '0.10' }),
      buildRow({ state: 'PAID', total_to_pay: '0.20' }),
      buildRow({ state: 'PENDING', total_to_pay: '0.70' }),
    ])

    expect(wrapper.find('[data-testid="total-total_to_pay"]').text()).toBe(formatAmount('1.00'))
  })

  it('totals a negative discounts value with a plus prefix', () => {
    const wrapper = mountTable([
      buildRow({ state: 'PAID', discounts: '-100.00' }),
      buildRow({ state: 'PENDING', discounts: '40.00' }),
    ])

    expect(wrapper.find('[data-testid="total-discounts"]').text()).toBe(`+${formatAmount('60.00')}`)
    expect(wrapper.findAll('[data-testid="cell-discounts"]').map((c) => c.text())).toContain(
      `+${formatAmount('100.00')}`,
    )
  })

  it('totals are all zero when every row is BLOCKED or NO_IU_PAYMENT', () => {
    const wrapper = mountTable([
      buildRow({ state: 'BLOCKED', beca: '500.00', discounts: '50.00', total_to_pay: '450.00' }),
      buildRow({ state: 'NO_IU_PAYMENT', scholarship_type: 'TELMEX' }),
    ])

    for (const key of ['beca', 'discounts', 'pending_and_advance', 'total_to_pay']) {
      expect(wrapper.find(`[data-testid="total-${key}"]`).text()).toBe(formatAmount('0.00'))
    }
  })

  describe('NO_IU_PAYMENT rows with pending money', () => {
    const pendingNoIu = () =>
      buildRow({
        full_name: 'Pendiente Paz',
        scholarship_type: 'TELMEX',
        state: 'NO_IU_PAYMENT',
        pending_and_advance: '250.00',
        total_to_pay: '250.00',
      })

    it('does not mute the row and shows the warning chip "Revisar pendiente"', () => {
      const wrapper = mountTable([pendingNoIu()])

      const chip = wrapper.find('[data-testid="state-chip"]')
      expect(chip.text()).toBe('Revisar pendiente')
      expect(chip.classes()).toContain('text-warning')
      expect(bodyRows(wrapper)[0].classes()).not.toContain('generation-row-muted')
    })

    it('exposes the tooltip text for the warning chip', () => {
      const wrapper = mountTable([pendingNoIu()])

      const tooltips = wrapper.findAllComponents({ name: 'VTooltip' }).map((t) => t.props('text'))
      expect(tooltips).toContain('Telmex sin pago IU con monto pendiente de meses anteriores')
    })

    it('shows a warning alert above the table when any such row exists', () => {
      const wrapper = mountTable([pendingNoIu()])

      const alert = wrapper.find('[data-testid="no-iu-pending-alert"]')
      expect(alert.exists()).toBe(true)
      expect(alert.text()).toBe(
        'Hay becarios Telmex sin pago IU con montos pendientes de meses anteriores. Revisa su situación antes de cerrar el periodo.',
      )
      expect(wrapper.html().indexOf('no-iu-pending-alert')).toBeLessThan(wrapper.html().indexOf('<table'))
    })

    it('keeps the grey "Sin pago IU" chip, muting and no alert for zero rows', () => {
      const wrapper = mountTable([buildRow({ scholarship_type: 'TELMEX', state: 'NO_IU_PAYMENT' })])

      expect(wrapper.find('[data-testid="state-chip"]').text()).toBe('Sin pago IU')
      expect(bodyRows(wrapper)[0].classes()).toContain('generation-row-muted')
      expect(wrapper.find('[data-testid="no-iu-pending-alert"]').exists()).toBe(false)
    })

    it('still excludes the pending NO_IU_PAYMENT row from the footer totals', () => {
      const wrapper = mountTable([pendingNoIu()])

      expect(wrapper.find('[data-testid="total-total_to_pay"]').text()).toBe(formatAmount('0.00'))
    })
  })

  it('footer totals equal the summary cards for a consistent fixture', () => {
    const rows = [
      buildRow({
        state: 'PAID',
        scholarship_type: 'IU',
        beca: '2000.00',
        apoyo: '100.00',
        temporary_increase: '300.00',
        discounts: '340.00',
        total_to_pay: '2060.00',
      }),
      buildRow({
        state: 'PENDING',
        scholarship_type: 'TELMEX_IU',
        pago_iu: '800.00',
        telmex_coverage: '3500.00',
        pending_and_advance: '250.00',
        total_to_pay: '4550.00',
      }),
      buildRow({ state: 'BLOCKED', beca: '1000.00', total_to_pay: '1000.00' }),
      buildRow({ state: 'NO_IU_PAYMENT', scholarship_type: 'TELMEX' }),
    ]
    const summary: SummaryModel = {
      total: 3,
      paid: 1,
      pending: 1,
      blocked: 1,
      beca_amount: '2000.00',
      apoyo_amount: '100.00',
      pago_iu_amount: '800.00',
      temporary_increase_amount: '300.00',
      telmex_coverage_amount: '3500.00',
      pending_and_advance_amount: '250.00',
      paid_amount: '2060.00',
      pending_amount: '4550.00',
      total_amount: '6610.00',
      difference_amount: '340.00',
      telmex_without_iu_payment: 1,
      telmex_without_iu_payment_pending_amount: '0.00',
    }

    const table = mountTable(rows)
    const cards = mount(GenerationPaymentSummary, { global: { plugins: [vuetify] }, props: { summary } })

    const total = (key: string) => table.find(`[data-testid="total-${key}"]`).text()
    const cardValue = (label: string): string => {
      const card = cards.findAll('.payment-summary-card').find((c) => c.text().includes(label))
      expect(card, label).toBeDefined()
      return card!.text().replace(label, '').trim()
    }

    expect(cardValue('Monto total de beca')).toBe(total('beca'))
    expect(cardValue('Monto total de apoyo')).toBe(total('apoyo'))
    expect(cardValue('Monto total Pago IU')).toBe(total('pago_iu'))
    expect(cardValue('Aumentos temporales')).toBe(total('temporary_increase'))
    expect(cardValue('Adelanto Telmex')).toBe(total('telmex_coverage'))
    expect(cardValue('Pendientes y adelantos')).toBe(total('pending_and_advance'))
    // No card shows total_amount; it is paid_amount + pending_amount.
    expect(cardValue('Monto pagado')).toBe(formatAmount(summary.paid_amount))
    expect(cardValue('Monto por pagar')).toBe(formatAmount(summary.pending_amount))
    expect(total('total_to_pay')).toBe(formatAmount(summary.total_amount))
    // The difference card shows discounts unsigned; the table prefixes the minus.
    expect(cardValue('Diferencia por descuentos y retenciones')).toBe(formatAmount(summary.difference_amount))
    expect(total('discounts')).toBe(`−${formatAmount(summary.difference_amount)}`)
  })
})
