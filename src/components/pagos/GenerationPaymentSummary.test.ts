// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VTooltip } from 'vuetify/components'
import GenerationPaymentSummary from '@/components/pagos/GenerationPaymentSummary.vue'
import type { GenerationPaymentSummary as GenerationPaymentSummaryModel } from '@/interfaces/payment'

// Same jsdom gotcha documented in UsersTable.test.ts: Vuetify's overlay
// strategy (v-tooltip) needs a ResizeObserver shim under jsdom.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const vuetify = createVuetify()

// Matches PaymentBatchService::generationSummary()'s keys (spec: "Response
// is summary-only", design D1/D4) — paid/pending/blocked partition,
// paid_amount/pending_amount money split, NOT PaymentBatchSummary's
// ready/blocking/total_amount-only shape.
const buildSummary = (overrides: Partial<GenerationPaymentSummaryModel> = {}): GenerationPaymentSummaryModel => ({
  total: 10,
  paid: 6,
  pending: 2,
  blocked: 2,
  beca_amount: '5000.00',
  apoyo_amount: '800.00',
  pago_iu_amount: '1200.00',
  paid_amount: '4500.00',
  pending_amount: '1500.00',
  total_amount: '6000.00',
  difference_amount: '0.00',
  temporary_increase_amount: '0.00',
  pending_and_advance_amount: '0.00',
  telmex_without_iu_payment: 0,
  ...overrides,
})

const mountSummary = (summary: GenerationPaymentSummaryModel | null) =>
  mount(GenerationPaymentSummary, {
    global: { plugins: [vuetify] },
    props: { summary },
  })

describe('GenerationPaymentSummary', () => {
  it('renders 12 cards across 3 rows: 4 counts, 5 nominal components, 3 payment-state totals', () => {
    const wrapper = mountSummary(buildSummary())

    const rows = wrapper.findAll('.v-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].findAll('.payment-summary-card')).toHaveLength(4)
    expect(rows[1].findAll('.payment-summary-card')).toHaveLength(5)
    expect(rows[2].findAll('.payment-summary-card')).toHaveLength(3)
    expect(wrapper.findAll('.payment-summary-card')).toHaveLength(12)
  })

  it('renders the row 1 count labels with their values', () => {
    const wrapper = mountSummary(buildSummary())
    const text = wrapper.text()

    expect(text).toContain('Total becarios')
    expect(text).toContain('Pagados')
    expect(text).toContain('Por pagar')
    expect(text).toContain('Bloqueados')
  })

  it('renders the row 2 nominal money labels', () => {
    const wrapper = mountSummary(buildSummary())
    const text = wrapper.text()

    expect(text).toContain('Monto total de beca')
    expect(text).toContain('Monto total de apoyo')
    expect(text).toContain('Monto total Pago IU')
    expect(text).toContain('Aumentos temporales')
    expect(text).toContain('Pendientes y adelantos')
  })

  it('renders the formatted temporary increase and pending/advance amounts', () => {
    const wrapper = mountSummary(
      buildSummary({ temporary_increase_amount: '800.00', pending_and_advance_amount: '250.00' }),
    )
    const cards = wrapper.findAll('.v-row')[1].findAll('.payment-summary-card')

    expect(cards[3].text()).toContain('Aumentos temporales')
    expect(cards[3].text()).toContain('$800.00')
    expect(cards[4].text()).toContain('Pendientes y adelantos')
    expect(cards[4].text()).toContain('$250.00')
  })

  it('renders the row 3 payment-state money labels, including the difference card', () => {
    const wrapper = mountSummary(buildSummary())
    const text = wrapper.text()

    expect(text).toContain('Monto pagado')
    expect(text).toContain('Monto por pagar')
    expect(text).toContain('Diferencia por descuentos y retenciones')
  })

  it('renders card 9 (Monto pagado) and card 10... with the formatted paid/pending amounts', () => {
    const wrapper = mountSummary(buildSummary({ paid_amount: '4500.00', pending_amount: '1500.00' }))
    const text = wrapper.text()

    expect(text).toContain('$4,500.00')
    expect(text).toContain('$1,500.00')
  })

  it('renders the difference card with a correctly signed negative value, never the $-amount form', () => {
    const wrapper = mountSummary(buildSummary({ difference_amount: '-500.00' }))
    const text = wrapper.text()

    expect(text).toContain('-$500.00')
    expect(text).not.toContain('$-500.00')
  })

  it('exposes a help tooltip on the difference card with the plain-language copy', () => {
    const wrapper = mountSummary(buildSummary())
    const tooltip = wrapper.findComponent(VTooltip)

    expect(tooltip.exists()).toBe(true)
    expect(tooltip.props('text')).toBe('Descuentos académicos, penalizaciones y retenciones aplicadas')
  })

  it('renders nothing when summary is null', () => {
    const wrapper = mountSummary(null)

    expect(wrapper.findAll('.payment-summary-card')).toHaveLength(0)
  })

  it('formats money cards with thousands separators and the peso sign (es-MX MXN)', () => {
    const wrapper = mountSummary(buildSummary({ beca_amount: '12345.67' }))

    expect(wrapper.text()).toContain('$12,345.67')
  })

  describe('Telmex sin pago IU card', () => {
    it('is hidden when telmex_without_iu_payment is 0', () => {
      const wrapper = mountSummary(buildSummary({ telmex_without_iu_payment: 0 }))

      expect(wrapper.text()).not.toContain('Telmex sin pago IU')
    })

    it('shows the count with its help tooltip in the counts row when > 0', () => {
      const wrapper = mountSummary(buildSummary({ telmex_without_iu_payment: 3 }))

      const countsRow = wrapper.findAll('.v-row')[0]
      expect(countsRow.findAll('.payment-summary-card')).toHaveLength(5)
      expect(countsRow.text()).toContain('Telmex sin pago IU')
      expect(countsRow.text()).toContain('3')
      const tooltips = wrapper.findAllComponents(VTooltip).map((t) => t.props('text'))
      expect(tooltips).toContain('Becarios Telmex a quienes IU no realiza pago este mes')
    })
  })

  // sdd/telmex-cobertura-iu PR5, task 5.6: "Adelanto Telmex" card, shown
  // only when telmex_coverage_amount is present AND > 0 — optional field, so
  // the pre-existing "10 cards / 3 rows" assertion above must keep passing
  // unchanged when it's absent.
  describe('Adelanto Telmex card', () => {
    it('renders no extra card when telmex_coverage_amount is absent', () => {
      const wrapper = mountSummary(buildSummary())

      expect(wrapper.text()).not.toContain('Adelanto Telmex')
      expect(wrapper.findAll('.payment-summary-card')).toHaveLength(12)
    })

    it('renders no extra card when telmex_coverage_amount is "0.00"', () => {
      const wrapper = mountSummary(buildSummary({ telmex_coverage_amount: '0.00' }))

      expect(wrapper.text()).not.toContain('Adelanto Telmex')
      expect(wrapper.findAll('.payment-summary-card')).toHaveLength(12)
    })

    it('renders a 13th card with the formatted amount when telmex_coverage_amount > 0', () => {
      const wrapper = mountSummary(buildSummary({ telmex_coverage_amount: '900.00' }))

      expect(wrapper.text()).toContain('Adelanto Telmex')
      expect(wrapper.text()).toContain('$900.00')
      expect(wrapper.findAll('.payment-summary-card')).toHaveLength(13)
      expect(wrapper.findAll('.v-row')).toHaveLength(4)
    })
  })
})
