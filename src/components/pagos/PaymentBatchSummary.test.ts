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
  it('shows the paid-amounts caption only when basis is paid', () => {
    const paid = mountSummary(buildSummary({ basis: 'paid', paid: 10 }))
    expect(paid.find('[data-testid="summary-basis-caption"]').text()).toBe('Montos pagados en este lote')

    const ready = mountSummary(buildSummary({ basis: 'ready' }))
    expect(ready.find('[data-testid="summary-basis-caption"]').exists()).toBe(false)
    expect(mountSummary(buildSummary()).find('[data-testid="summary-basis-caption"]').exists()).toBe(false)
  })

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

    expect(text).toContain('Total de beca')
    expect(text).toContain('Total de apoyo')
    expect(text).toContain('Total Pago IU')
    expect(text).toContain('Monto total a pagar')
    expect(text).toContain('Diferencia por descuentos y retenciones')
  })

  describe('net totals (sdd/descuento-beca-apoyo)', () => {
    const netSummary = (overrides: Partial<PaymentBatchSummaryModel> = {}) =>
      buildSummary({
        net_beca_amount: '4500.00',
        net_apoyo_amount: '700.00',
        net_pago_iu_amount: '1100.00',
        net_temporary_increase_amount: '0.00',
        net_telmex_coverage_amount: '0.00',
        pending_and_advance_amount: '700.00',
        ...overrides,
      })

    const card = (wrapper: ReturnType<typeof mountSummary>, label: string) =>
      wrapper.findAll('.payment-summary-card').find((c) => c.text().includes(label))

    it('shows the NET totals as the primary value and the nominal as a caption', () => {
      const wrapper = mountSummary(netSummary())

      expect(card(wrapper, 'Total de beca')?.find('.text-h5').text()).toBe('$4,500.00')
      expect(card(wrapper, 'Total de beca')?.text()).toContain('Nominal $5,000.00')
      expect(card(wrapper, 'Total de apoyo')?.find('.text-h5').text()).toBe('$700.00')
      expect(card(wrapper, 'Total de apoyo')?.text()).toContain('Nominal $800.00')
      expect(card(wrapper, 'Total Pago IU')?.find('.text-h5').text()).toBe('$1,100.00')
    })

    it('omits the nominal caption when net equals nominal', () => {
      const wrapper = mountSummary(netSummary({ net_beca_amount: '5000.00' }))

      expect(card(wrapper, 'Total de beca')?.text()).not.toContain('Nominal')
    })

    it('renders a Ret./Adelanto card from pending_and_advance_amount', () => {
      const wrapper = mountSummary(netSummary())

      expect(card(wrapper, 'Ret./Adelanto')?.find('.text-h5').text()).toBe('$700.00')
      expect(wrapper.findAll('.payment-summary-card')).toHaveLength(9)
    })

    it('renders an Aumento neto card with the nominal caption when a temporary increase exists', () => {
      const wrapper = mountSummary(
        netSummary({ temporary_increase_amount: '500.00', net_temporary_increase_amount: '450.00' }),
      )

      expect(card(wrapper, 'Aumento neto')?.find('.text-h5').text()).toBe('$450.00')
      expect(card(wrapper, 'Aumento neto')?.text()).toContain('Nominal $500.00')
    })

    it('net cards add up to Monto total a pagar (cents) when a temporary increase exists', () => {
      const wrapper = mountSummary(
        netSummary({
          net_beca_amount: '4500.00',
          net_apoyo_amount: '700.00',
          net_pago_iu_amount: '1100.00',
          temporary_increase_amount: '500.00',
          net_temporary_increase_amount: '450.00',
          telmex_coverage_amount: '300.00',
          net_telmex_coverage_amount: '250.00',
          pending_and_advance_amount: '300.00',
          total_amount: '7300.00',
        }),
      )
      const cents = (label: string): number => {
        const raw = card(wrapper, label)?.find('.text-h5').text() ?? ''
        return Math.round(Number(raw.replace(/[^0-9.-]/g, '')) * 100)
      }
      const sum = [
        'Total de beca',
        'Total de apoyo',
        'Total Pago IU',
        'Aumento neto',
        'Adelanto Telmex',
        'Ret./Adelanto',
      ].reduce((acc, label) => acc + cents(label), 0)

      expect(sum).toBe(cents('Monto total a pagar'))
    })

    it('uses the net Telmex coverage for the Adelanto Telmex card', () => {
      const wrapper = mountSummary(
        netSummary({ telmex_coverage_amount: '1500.00', net_telmex_coverage_amount: '1400.00' }),
      )

      expect(card(wrapper, 'Adelanto Telmex')?.find('.text-h5').text()).toBe('$1,400.00')
    })
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
