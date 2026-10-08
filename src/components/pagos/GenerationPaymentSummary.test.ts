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
  ...overrides,
})

const mountSummary = (summary: GenerationPaymentSummaryModel | null) =>
  mount(GenerationPaymentSummary, {
    global: { plugins: [vuetify] },
    props: { summary },
  })

describe('GenerationPaymentSummary', () => {
  it('renders 10 cards across 3 rows: 4 counts, 3 nominal components, 3 payment-state totals', () => {
    const wrapper = mountSummary(buildSummary())

    const rows = wrapper.findAll('.v-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].findAll('.payment-summary-card')).toHaveLength(4)
    expect(rows[1].findAll('.payment-summary-card')).toHaveLength(3)
    expect(rows[2].findAll('.payment-summary-card')).toHaveLength(3)
    expect(wrapper.findAll('.payment-summary-card')).toHaveLength(10)
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
    expect(tooltip.props('text')).toBe(
      'Diferencia entre lo que corresponde por beca y apoyo, y lo que se paga. Positiva: descuentos y retenciones aplicadas. Negativa: se pagó de más este mes por aumentos temporales, meses retenidos liberados, reembolsos o adelantos.',
    )
  })

  it('renders nothing when summary is null', () => {
    const wrapper = mountSummary(null)

    expect(wrapper.findAll('.payment-summary-card')).toHaveLength(0)
  })

  it('formats money cards with thousands separators and the peso sign (es-MX MXN)', () => {
    const wrapper = mountSummary(buildSummary({ beca_amount: '12345.67' }))

    expect(wrapper.text()).toContain('$12,345.67')
  })
})
