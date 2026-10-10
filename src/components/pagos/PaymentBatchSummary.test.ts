// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import PaymentBatchSummary from '@/components/pagos/PaymentBatchSummary.vue'
import type { PaymentBatchSummary as PaymentBatchSummaryModel } from '@/interfaces/payment'

const vuetify = createVuetify()

// 5 money totals (sdd/pagos-batch-sede-totals, design D9-D14): the server now
// always emits beca_amount/apoyo_amount/pago_iu_amount/difference_amount
// alongside the existing total_amount — all required, never optional.
const buildSummary = (overrides: Partial<PaymentBatchSummaryModel> = {}): PaymentBatchSummaryModel => ({
  total: 10,
  ready: 8,
  blocking: 2,
  beca_amount: '5000.00',
  apoyo_amount: '800.00',
  pago_iu_amount: '1200.00',
  total_amount: '7000.00',
  difference_amount: '0.00',
  ...overrides,
})

const mountSummary = (summary: PaymentBatchSummaryModel) =>
  mount(PaymentBatchSummary, {
    global: { plugins: [vuetify] },
    props: { summary },
  })

describe('PaymentBatchSummary', () => {
  it('renders 8 cards across 3 rows at the sm breakpoint: 3 counts, 3 nominal components, 2 aggregates', () => {
    const wrapper = mountSummary(buildSummary())

    const rows = wrapper.findAll('.v-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].findAll('.payment-summary-card')).toHaveLength(3)
    expect(rows[1].findAll('.payment-summary-card')).toHaveLength(3)
    expect(rows[2].findAll('.payment-summary-card')).toHaveLength(2)
    expect(wrapper.findAll('.payment-summary-card')).toHaveLength(8)
  })

  it('renders the 5 money card labels with their design-specified copy', () => {
    const wrapper = mountSummary(buildSummary())
    const text = wrapper.text()

    expect(text).toContain('Monto total de beca')
    expect(text).toContain('Monto total de apoyo')
    expect(text).toContain('Monto total Pago IU')
    expect(text).toContain('Monto total a pagar')
    expect(text).toContain('Diferencia por descuentos y retenciones')
  })

  it('renders card 5 with a correctly signed negative value, never the $-amount form', () => {
    const wrapper = mountSummary(buildSummary({ difference_amount: '-500.00' }))
    const text = wrapper.text()

    expect(text).toContain('-$500.00')
    expect(text).not.toContain('$-500.00')
  })

  it('renders card 5 as $0.00 when the difference is zero', () => {
    const wrapper = mountSummary(buildSummary({ difference_amount: '0.00' }))

    expect(wrapper.text()).toContain('$0.00')
  })

  it('formats money cards with thousands separators and the peso sign', () => {
    const wrapper = mountSummary(buildSummary({ beca_amount: '12345.67' }))

    expect(wrapper.text()).toContain('$12,345.67')
  })

  it('renders nothing when summary is null', () => {
    const wrapper = mount(PaymentBatchSummary, {
      global: { plugins: [vuetify] },
      props: { summary: null },
    })

    expect(wrapper.findAll('.payment-summary-card')).toHaveLength(0)
  })

  // sdd/telmex-cobertura-iu PR5, task 5.6: "Adelanto Telmex" card, shown
  // only when telmex_coverage_amount is present AND > 0 — optional field
  // (mirrors PR6's precedent of not forcing every unrelated fixture to
  // supply new Telmex fields), so the pre-existing "8 cards / 3 rows"
  // assertion above must keep passing unchanged when it's absent.
  describe('Adelanto Telmex card', () => {
    it('renders no extra card when telmex_coverage_amount is absent', () => {
      const wrapper = mountSummary(buildSummary())

      expect(wrapper.text()).not.toContain('Adelanto Telmex')
      expect(wrapper.findAll('.payment-summary-card')).toHaveLength(8)
    })

    it('renders no extra card when telmex_coverage_amount is "0.00"', () => {
      const wrapper = mountSummary(buildSummary({ telmex_coverage_amount: '0.00' }))

      expect(wrapper.text()).not.toContain('Adelanto Telmex')
      expect(wrapper.findAll('.payment-summary-card')).toHaveLength(8)
    })

    it('renders a 9th card with the formatted amount when telmex_coverage_amount > 0', () => {
      const wrapper = mountSummary(buildSummary({ telmex_coverage_amount: '1500.00' }))

      expect(wrapper.text()).toContain('Adelanto Telmex')
      expect(wrapper.text()).toContain('$1,500.00')
      expect(wrapper.findAll('.payment-summary-card')).toHaveLength(9)
      expect(wrapper.findAll('.v-row')).toHaveLength(4)
    })
  })
})
